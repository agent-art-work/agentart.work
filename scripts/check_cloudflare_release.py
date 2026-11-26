"""Verify the OFF Pages artifact, provider settings, and served file bytes."""
import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

PROJECT = "agentart-work"
PAGES_HOST = f"{PROJECT}.pages.dev"
SITE = "https://agentart.work"
ACTIVATION_KEYS = {
    "AGENTART_HOME_COUNTRY_MODE", "AGENTART_HOME_MEASUREMENT_MODE",
    "AGENTART_HOME_MEASUREMENT_POLICY", "AGENTART_HOME_BEACON_TOKEN",
}
OFF_CONFIG = b'{"enabled":false,"siteToken":null,"production":false,"policy":"home-native-v1"}'
REHEARSAL_HEADER = "x-agentart-off-rehearsal"
ANALYTICS_MARKERS = (b"data-cf-beacon", b"cloudflareinsights.com", b"site-privacy", b"data-analytics-action")
UUID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
CREATION_MODULE = re.compile(r"assets/agent-art-create(-work)?\.[0-9a-f]{64}\.mjs")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def require(condition, message):
    if not condition:
        raise ValueError(message)


def verify_artifact(directory, expected_hash):
    data = (directory / "manifest.json").read_bytes()
    require(sha256(data).hexdigest() == expected_hash, "Artifact manifest digest mismatch")
    manifest = json.loads(data)
    require(manifest.get("schema") == "agentart.pages-off.local.v1"
            and manifest.get("collection") == "OFF", "Invalid OFF release manifest")
    root = directory / "_site"
    require(root.is_dir() and not root.is_symlink(), "Missing or linked Pages directory")
    actual = {}
    for file in root.rglob("*"):
        require(not file.is_symlink(), "Linked file in Pages artifact")
        if file.is_file():
            actual[file.relative_to(root).as_posix()] = sha256(file.read_bytes()).hexdigest()
    require(actual == manifest.get("files"), "Pages file set or file digest changed")
    require({"index.html", "404.html", "create/index.html", "agent-index.json",
             "_worker.js", "_routes.json", "_headers", ".nojekyll"} <= actual.keys(),
            "Incomplete Pages artifact")
    home = (root / "index.html").read_bytes()
    require(OFF_CONFIG in home and b'{"countryEligible":false}' in home,
            "Packaged Home measurement is not OFF")
    require(REHEARSAL_HEADER.encode() not in (root / "_worker.js").read_bytes().lower(),
            "Recovery rehearsal Worker supplied to the release workflow")
    for name in actual:
        if name.endswith(".html"):
            html = (root / name).read_bytes()
            require(not any(mark in html for mark in ANALYTICS_MARKERS),
                    f"Unexpected public analytics marker in {name}")
    print(f"OFF artifact verified: {len(actual)} files, manifest {expected_hash}", file=sys.stderr)
    return actual


def request(url, expected_status=200, token=None):
    headers = {"Accept-Encoding": "identity"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    opener = build_opener(NoRedirect())
    try:
        response = opener.open(Request(url, headers=headers), timeout=12)
    except HTTPError as error:
        if error.code != expected_status:
            error.close()
            raise ValueError(f"HTTP {error.code} for {url}") from None
        response = error
    with response:
        require(response.status == expected_status, f"Expected HTTP {expected_status} for {url}")
        data = response.read(2_000_001)
        require(len(data) <= 2_000_000, f"Response exceeds verification limit for {url}")
        return response.headers, data


def pages_api(suffix=""):
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    require(token and re.fullmatch(r"[0-9a-f]{32}", account),
            "Configure the scoped Cloudflare token and account ID in this GitHub environment")
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/{PROJECT}{suffix}"
    _, data = request(url, token=token)
    response = json.loads(data)
    require(response.get("success") is True and isinstance(response.get("result"), dict),
            "Cloudflare Pages API did not return a successful record")
    return response["result"]


def check_off(settings, build_config, label):
    variables = settings.get("env_vars") or {}
    require(isinstance(variables, dict) and not ACTIVATION_KEYS.intersection(variables),
            f"Measurement activation keys found in {label}")
    build_config = build_config or {}
    require(not any(build_config.get(key) for key in ("web_analytics_tag", "web_analytics_token")),
            f"Cloudflare Web Analytics injection configured in {label}")


def verify_project(project, target, branch):
    require(project.get("name") == PROJECT and project.get("subdomain") == PAGES_HOST
            and project.get("production_branch") == "main" and "agentart.work" in project.get("domains", []),
            "Unexpected Pages project, domain or production branch")
    require((target == "production" and branch == "main")
            or (target == "preview" and re.fullmatch(r"ci-[0-9]+-[0-9]+", branch)),
            "Unexpected release target or branch")
    settings = (project.get("deployment_configs") or {}).get(target)
    require(isinstance(settings, dict), f"No Pages configuration for {target}")
    check_off(settings, project.get("build_config"), target)
    active = (project.get("canonical_deployment") or {}).get("id", "")
    require(UUID.fullmatch(active), "Cannot read the existing Production deployment ID")
    return active


def check_served(origin, files, production):
    routes = {
        "/": ("index.html", 200), "/?ops_m72_off=1": ("index.html", 200),
        "/index.html?ops_m72_off=1": ("index.html", 200),
        "/create/": ("create/index.html", 200), "/agent-index.json": ("agent-index.json", 200),
        "/agentart-ci-missing/": ("404.html", 404),
    }
    modules = [name for name in sorted(files) if CREATION_MODULE.fullmatch(name)]
    require(len(modules) == 2 and {CREATION_MODULE.fullmatch(name)[1] for name in modules}
            == {None, "-work"}, "Missing or extra immutable Create modules")
    routes.update({f"/{name}": (name, 200) for name in modules})
    headers, _ = request(origin + "/index.html", 308)
    require(headers.get("Location") == "/" and headers.get("CF-Ray")
            and headers.get("CDN-Cache-Control", "").lower() == "no-store",
            "Unexpected Home alias redirect")
    print("- `/index.html` returned the no-store Home redirect")
    for route, (file, status) in routes.items():
        headers, body = request(origin + route, status)
        require(headers.get("CF-Ray") and headers.get("Server", "").lower() == "cloudflare",
                f"Missing Cloudflare provenance for {route}")
        require(sha256(body).hexdigest() == files[file], f"Served bytes differ for {route}")
        require(not headers.get(REHEARSAL_HEADER), f"Rehearsal marker present for {route}")
        if file == "index.html":
            require(OFF_CONFIG in body and b'{"countryEligible":false}' in body,
                    f"Home is not OFF on {route}")
            require(headers.get("Cache-Control", "").lower() == "private, no-store, no-transform"
                    and headers.get("CDN-Cache-Control", "").lower() == "no-store",
                    f"Home no-store policy differs on {route}")
            if production:
                require(headers.get("CF-Cache-Status", "").upper() in {"DYNAMIC", "BYPASS"},
                        f"Unexpected canonical Home cache status for {route}")
        print(f"- `{route}` returned HTTP {status} with exact artifact bytes")


def verify_deployment(args, files):
    require(UUID.fullmatch(args.deployment_id)
            and args.deployment_environment.lower() == args.target, "Unexpected deployment receipt")
    origin = f"https://{args.deployment_id[:8]}.{PAGES_HOST}"
    require(args.deployment_url.rstrip("/") == origin, "Expected an immutable Pages URL")
    deployed = pages_api(f"/deployments/{args.deployment_id}")
    metadata = (deployed.get("deployment_trigger") or {}).get("metadata") or {}
    require(deployed.get("id") == args.deployment_id and deployed.get("environment") == args.target
            and metadata.get("branch") == args.branch and metadata.get("commit_hash") == args.commit,
            "Deployment does not match the approved branch and commit")
    check_off(deployed, deployed.get("build_config"), "the deploy snapshot")
    expected_active = args.deployment_id if args.target == "production" else args.prior_production
    require(verify_project(pages_api(), args.target, args.branch) == expected_active,
            "Unexpected active Production deployment")
    print(f"{args.target.title()} deployment: {origin} (`{args.deployment_id}`)")
    print(f"Source: `{args.commit}` · manifest: `{args.manifest_sha256}`")
    check_served(origin, files, production=False)
    if args.target == "production":
        check_served(SITE, files, production=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("artifact", "verify"):
        sub = commands.add_parser(command)
        sub.add_argument("directory", type=Path)
        sub.add_argument("manifest_sha256")
        if command == "verify":
            for name in ("target", "branch", "prior_production", "deployment_id",
                         "deployment_url", "deployment_environment", "commit"):
                sub.add_argument(name)
    preflight = commands.add_parser("preflight")
    for name in ("target", "branch", "expected_production"):
        preflight.add_argument(name)
    args = parser.parse_args()
    try:
        if args.command == "preflight":
            active = verify_project(pages_api(), args.target, args.branch)
            if args.target == "production":
                require(active == args.expected_production, "Production has moved from the approved rollback ID")
            print(active)
        else:
            files = verify_artifact(args.directory, args.manifest_sha256)
            if args.command == "verify":
                verify_deployment(args, files)
    except (ValueError, OSError, URLError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
