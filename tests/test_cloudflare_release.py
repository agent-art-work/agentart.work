"""Offline checks for the release workflow's artifact and environment boundaries."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import check_cloudflare_release as release


class CloudflareReleaseTests(unittest.TestCase):
    prior_id = "00000000-0000-4000-8000-000000000001"

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
            data["create/index.html"] = b"older version"
            with self.assertRaisesRegex(ValueError, "Served bytes differ"):
                release.check_served(release.SITE, inventory, production=True)
