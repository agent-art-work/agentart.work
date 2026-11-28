"""Offline checks for the release workflow's artifact and environment boundaries."""
from contextlib import redirect_stderr
import hashlib
from io import StringIO
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import call, patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import check_cloudflare_release as release


class CloudflareReleaseTests(unittest.TestCase):
    prior_id = "00000000-0000-4000-8000-000000000001"
    fixture_origin = "https://abcdabcd.agentart-work.pages.dev"
    cloudflare = {"Server": "cloudflare", "CF-Ray": "0123456789abcdef-SEA"}

    def setUp(self):
        self.project = {
            "name": release.PROJECT, "subdomain": release.PAGES_HOST,
            "production_branch": "main", "domains": ["agentart.work"],
            "canonical_deployment": {"id": self.prior_id},
            "deployment_configs": {"preview": {}, "production": {}},
        }

    def test_project_preflight_rejects_wrong_target_and_enabled_measurement(self):
        self.assertEqual(release.verify_project(self.project, "preview", "ci-12-1"), self.prior_id)
        self.assertEqual(release.verify_project(self.project, "production", "main"), self.prior_id)
        with self.assertRaisesRegex(ValueError, "target or branch"):
            release.verify_project(self.project, "preview", "main")
        self.project["deployment_configs"]["production"]["env_vars"] = {
            "AGENTART_HOME_MEASUREMENT_MODE": {"type": "plain_text", "value": "inert"},
        }
        with self.assertRaisesRegex(ValueError, "activation keys"):
            release.verify_project(self.project, "production", "main")
        self.project["build_config"] = {"web_analytics_token": "fixture"}
        with self.assertRaisesRegex(ValueError, "Analytics injection"):
            release.verify_project(self.project, "preview", "ci-12-1")

    def test_preview_accepts_only_null_entries_left_by_cloudflare_variable_deletion(self):
        deleted = dict.fromkeys(release.ACTIVATION_KEYS)
        self.project["deployment_configs"]["preview"]["env_vars"] = deleted.copy()
        self.assertEqual(release.verify_project(self.project, "preview", "ci-12-1"), self.prior_id)
        self.project["deployment_configs"]["production"]["env_vars"] = deleted.copy()
        with self.assertRaisesRegex(ValueError, "activation keys"):
            release.verify_project(self.project, "production", "main")

        key = "AGENTART_HOME_MEASUREMENT_MODE"
        for value in ({"type": "plain_text", "value": ""}, {"type": "secret_text"}, False, ""):
            with self.subTest(value=value):
                self.project["deployment_configs"]["preview"]["env_vars"] = {**deleted, key: value}
                with self.assertRaisesRegex(ValueError, "activation keys"):
                    release.verify_project(self.project, "preview", "ci-12-1")
        with self.assertRaisesRegex(ValueError, "Invalid environment variables"):
            release.check_off({"env_vars": []}, None, "preview", allow_deleted_keys=True)
        with self.assertRaisesRegex(ValueError, "Analytics injection"):
            release.check_off({"env_vars": deleted}, {"web_analytics_tag": "fixture"},
                              "preview", allow_deleted_keys=True)

    def test_verified_artifact_rejects_manifest_file_and_inventory_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            root = directory / "_site"
            assets = {
                "index.html": release.OFF_CONFIG + b'{"countryEligible":false}',
                "404.html": b"missing", "create/index.html": b"create",
                "agent-index.json": b"{}", "_worker.js": b"", "_routes.json": b"{}",
                "_headers": b"", ".nojekyll": b"",
            }
            for name, data in assets.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
            inventory = {name: hashlib.sha256(data).hexdigest() for name, data in assets.items()}
            manifest = json.dumps({"schema": "agentart.pages-off.local.v1",
                                   "collection": "OFF", "files": inventory}).encode()
            (directory / "manifest.json").write_bytes(manifest)
            digest = hashlib.sha256(manifest).hexdigest()
            self.assertEqual(release.verify_artifact(directory, digest), inventory)
            with self.assertRaisesRegex(ValueError, "manifest digest"):
                release.verify_artifact(directory, "0" * 64)
            (root / ".nojekyll").unlink()
            with self.assertRaisesRegex(ValueError, "file set or file digest"):
                release.verify_artifact(directory, digest)
            (root / ".nojekyll").write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "file set or file digest"):
                release.verify_artifact(directory, digest)

    def test_request_identifies_the_release_verifier(self):
        with patch.object(release, "build_opener") as build_opener:
            open_request = build_opener.return_value.open
            response = open_request.return_value
            response.status = 200
            response.read.return_value = b"preview"
            release.request("https://preview.example.test/create/")

        request = open_request.call_args.args[0]
        self.assertEqual(request.get_header("User-agent"), "AgentArtWork-ReleaseVerifier/1.0")

    def test_first_immutable_production_alias_rechecks_one_cloudflare_404(self):
        url = self.fixture_origin + "/index.html"
        failed = HTTPError(url, 404, "Not Found", self.cloudflare, None)
        log = StringIO()
        with (patch.object(release, "build_opener") as opener,
              patch.object(release, "sleep") as wait,
              patch.object(release, "monotonic", side_effect=[100, 105, 106]),
              redirect_stderr(log)):
            response = opener.return_value.open.return_value
            response.status = 308
            response.headers = {"Location": "/"}
            response.read.return_value = b""
            opener.return_value.open.side_effect = [failed, response]
            self.assertEqual(release.read_home_redirect(self.fixture_origin, True), {"Location": "/"})

        wait.assert_called_once_with(5)
        self.assertEqual([entry.args[0].full_url for entry in opener.return_value.open.call_args_list],
                         [url, url])
        self.assertRegex(log.getvalue(), r"\d{4}-\d\d-\d\dT\S+ HTTP 404")
        self.assertIn("CF-Ray 0123456789abcdef-SEA", log.getvalue())

    def test_alias_does_not_retry_other_status_unrecognized_edge_or_other_origins(self):
        url = self.fixture_origin + "/index.html"
        for enabled, status, headers in (
            (True, 503, self.cloudflare),
            (True, 404, {"Server": "cloudflare"}),
            (True, 404, {**self.cloudflare, "Server": "other"}),
            (False, 404, self.cloudflare),
        ):
            with HTTPError(url, status, "", headers, None) as response:
                failed = release.UnexpectedHTTPStatus(url, response)
            with (self.subTest(enabled=enabled, status=status, headers=headers),
                  patch.object(release, "request", side_effect=failed) as read,
                  patch.object(release, "sleep") as wait,
                  self.assertRaisesRegex(ValueError, f"HTTP {status}")):
                release.read_home_redirect(self.fixture_origin, enabled)
            read.assert_called_once_with(url, 308)
            wait.assert_not_called()

    def test_alias_retry_still_fails_on_persistent_404_or_after_deadline(self):
        url = self.fixture_origin + "/index.html"
        with HTTPError(url, 404, "", self.cloudflare, None) as response:
            failed = release.UnexpectedHTTPStatus(url, response)
        accepted = ({"Location": "/"}, b"")
        for responses, times, attempts, message in (
            ([failed, failed], [100, 105], 2, "HTTP 404"),
            ([failed, accepted], [100, 118], 1, "retry deadline exceeded"),
            ([failed, accepted], [100, 105, 119], 2, "retry deadline exceeded"),
        ):
            with (self.subTest(times=times, message=message),
                  patch.object(release, "request", side_effect=responses) as read,
                  patch.object(release, "sleep") as wait,
                  patch.object(release, "monotonic", side_effect=times),
                  redirect_stderr(StringIO()),
                  self.assertRaisesRegex(ValueError, message)):
                release.read_home_redirect(self.fixture_origin, True)
            self.assertEqual(read.call_count, attempts)
            wait.assert_called_once_with(5)

    def test_only_immutable_production_receives_the_alias_recheck(self):
        deployment_id = "abcdabcd-0000-4000-8000-000000000002"
        for target, branch in (("preview", "ci-12-1"), ("production", "main")):
            args = SimpleNamespace(
                target=target, branch=branch, deployment_environment=target,
                prior_production=self.prior_id, deployment_id=deployment_id,
                deployment_url=self.fixture_origin, commit="fixture", manifest_sha256="fixture",
            )
            deployed = {"id": deployment_id, "environment": target, "deployment_trigger": {
                "metadata": {"branch": branch, "commit_hash": args.commit},
            }}
            active = deployment_id if target == "production" else self.prior_id
            project = {**self.project, "canonical_deployment": {"id": active}}
            files = {}
            with (self.subTest(target=target),
                  patch.object(release, "pages_api", side_effect=[deployed, project]),
                  patch.object(release, "check_served") as check):
                release.verify_deployment(args, files)

            expected = [call(self.fixture_origin, files, production=False,
                             retry_initial_alias_404=target == "production")]
            if target == "production":
                expected.append(call(release.SITE, files, production=True))
            self.assertEqual(check.call_args_list, expected)

    def test_served_version_requires_exact_bytes_and_off_cache_headers(self):
        common = {"CF-Ray": "fixture", "Server": "cloudflare",
                  "CDN-Cache-Control": "no-store", "CF-Cache-Status": "DYNAMIC",
                  "Cache-Control": "private, no-store, no-transform"}
        home = release.OFF_CONFIG + b'{"countryEligible":false}'
        modules = [f"assets/agent-art-create.{64 * 'a'}.mjs",
                   f"assets/agent-art-create-work.{64 * 'b'}.mjs"]
        data = {"index.html": home, "create/index.html": b"create", "404.html": b"missing",
                "agent-index.json": b"{}", **dict.fromkeys(modules, b"work")}
        inventory = {name: hashlib.sha256(content).hexdigest() for name, content in data.items()}

        def respond(url, status):
            route = url.removeprefix(release.SITE)
            if route == "/index.html":
                self.assertEqual(status, 308)
                return {**common, "Location": "/"}, b""
            file = {"": "index.html", "create/": "create/index.html",
                    "agentart-ci-missing/": "404.html"}.get(route.split("?")[0][1:], route[1:])
            if route.startswith("/index.html?"):
                file = "index.html"
            self.assertEqual(status, 404 if file == "404.html" else 200)
            return common, data[file]

        with patch.object(release, "request", side_effect=respond) as read:
            release.check_served(release.SITE, inventory, production=True)
            self.assertEqual(read.call_count, 9)
            common["CF-Cache-Status"] = "HIT"
            with self.assertRaisesRegex(ValueError, "cache status"):
                release.check_served(release.SITE, inventory, production=True)
            common["CF-Cache-Status"] = "DYNAMIC"

        create_url = release.SITE + "/create/"
        for cache_status, age, create_body in (
            ("HIT", "60", b"older version"),
            ("DYNAMIC", "", b"modified html"),
        ):
            def respond_with_mismatch(url, status):
                if url == create_url:
                    return {**common, "CF-Cache-Status": cache_status, "Age": age,
                            "ETag": '"old"', "Content-Type": "text/html",
                            "Set-Cookie": "private=fixture"}, create_body
                return respond(url, status)

            with (self.subTest(cache_status=cache_status),
                  patch.object(release, "request", side_effect=respond_with_mismatch) as read,
                  patch.object(release, "monotonic", side_effect=[100, 100.125]),
                  self.assertRaisesRegex(ValueError, "Served bytes differ for /create/:") as failure):
                release.check_served(release.SITE, inventory, production=True)
            self.assertEqual(read.call_count, 5)
            self.assertEqual(read.call_args, call(create_url, 200))
            message = str(failure.exception)
            evidence = json.loads(message.split(": ", 1)[1])
            self.assertEqual(evidence["url"], create_url)
            self.assertEqual(evidence["status"], 200)
            self.assertRegex(evidence["observed_at"], r"\d{4}-\d\d-\d\dT.*\+00:00$")
            self.assertEqual(evidence["elapsed_ms"], 125)
            self.assertEqual(evidence["expected_sha256"], inventory["create/index.html"])
            self.assertEqual(evidence["actual_sha256"], hashlib.sha256(create_body).hexdigest())
            self.assertEqual(evidence["actual_bytes"], len(create_body))
            self.assertEqual(evidence["headers"]["CF-Cache-Status"], cache_status)
            self.assertEqual(evidence["headers"]["CF-Ray"], common["CF-Ray"])
            self.assertEqual(evidence["headers"]["Age"], age)
            self.assertEqual(evidence["headers"]["ETag"], '"old"')
            self.assertNotIn("Set-Cookie", evidence["headers"])
            self.assertNotIn(create_body.decode(), message)

        url = self.fixture_origin + "/index.html"
        with HTTPError(url, 404, "", self.cloudflare, None) as response:
            failed = release.UnexpectedHTTPStatus(url, response)
        with (patch.object(release, "request",
                           side_effect=[failed, ({**common, "Location": "/wrong"}, b"")]) as read,
              patch.object(release, "sleep"),
              redirect_stderr(StringIO()),
              self.assertRaisesRegex(ValueError, "Unexpected Home alias redirect")):
            release.check_served(self.fixture_origin, inventory, production=False,
                                 retry_initial_alias_404=True)
        self.assertEqual(read.call_count, 2)
