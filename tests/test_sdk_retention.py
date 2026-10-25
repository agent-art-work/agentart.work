"""Retained SDK archive/output corruption checks without a build or network."""

import hashlib
import io
import json
from pathlib import Path
import shutil
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_retained_sdk import check_retained_sdk


VERSION = "0.1.5-flat-label.1"
BROWSER_FILES = ("index.mjs", "clients.mjs", "reading.mjs", "reading-ui.mjs", "reading.css")
PUBLIC_FILES = (*BROWSER_FILES, "README.md")
DIRECTORY = Path("assets/agent-art-sdk") / VERSION


class RetainedSDKChecks(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="Agent-Art-Work-sdk-retention-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.output = self.root / "_site"
        self.metadata = {"name": "@agent-art/protocol", "version": VERSION, "private": True}
        self.members = {
            name: f"// Synthetic retained SDK member: {name}\n".encode()
            for name in BROWSER_FILES
        }
        self.members["README.md"] = (
            b"# Synthetic archived SDK attribution\n\n"
            b"Keep this original package notice unchanged.\n"
        )
        self.policy = {
            "policy": "current-and-one-predecessor",
            "previous": [{
                "version": VERSION,
                "archive": f"vendor/agent-art-protocol-{VERSION}.tgz",
                "sha256": "",
                "notices": ["README.md"],
            }],
        }
        self.write_archive()
        for name in PUBLIC_FILES:
            self.put(Path("_site") / DIRECTORY / name, self.members[name])

    def put(self, relative, content):
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return target

    def write_policy(self):
        self.put("site/sdk-asset-retention.json", json.dumps(self.policy).encode())

    def write_archive(self):
        self.members["package.json"] = json.dumps(self.metadata).encode()
        entry = self.policy["previous"][0]
        archive = self.root / entry["archive"]
        archive.parent.mkdir(parents=True, exist_ok=True)
        with tarfile.open(archive, "w:gz") as package:
            for name, content in self.members.items():
                member = tarfile.TarInfo(f"package/{name}")
                member.size = len(content)
                package.addfile(member, io.BytesIO(content))
        entry["sha256"] = hashlib.sha256(archive.read_bytes()).hexdigest()
        self.write_policy()

    def errors(self):
        return check_retained_sdk(self.root, self.output)[0]

    def test_exact_browser_assets_and_original_readme_pass(self):
        errors, public_paths = check_retained_sdk(self.root, self.output)
        self.assertEqual(errors, [])
        self.assertEqual(public_paths, {DIRECTORY / name for name in PUBLIC_FILES})
        self.assertNotIn(DIRECTORY / "LICENSE", public_paths)
        self.assertNotIn(DIRECTORY / "package.json", public_paths)

    def test_missing_previous_version_directory_is_rejected(self):
        shutil.rmtree(self.output / DIRECTORY)
        self.assertCountEqual(
            self.errors(),
            [f"missing retained SDK asset: {DIRECTORY / name}" for name in PUBLIC_FILES],
        )

    def test_missing_browser_dependency_or_attribution_is_rejected(self):
        for name in PUBLIC_FILES:
            with self.subTest(name=name):
                target = self.output / DIRECTORY / name
                target.unlink()
                self.assertEqual(self.errors(), [f"missing retained SDK asset: {DIRECTORY / name}"])
                target.write_bytes(self.members[name])

    def test_changed_asset_or_attribution_bytes_are_rejected(self):
        for name in ("reading-ui.mjs", "README.md"):
            with self.subTest(name=name):
                target = self.output / DIRECTORY / name
                target.write_bytes(self.members[name] + b"Changed after release.\n")
                self.assertEqual(
                    self.errors(),
                    [f"retained SDK bytes differ from archive: {DIRECTORY / name}"],
                )
                target.write_bytes(self.members[name])

    def test_wrong_archive_digest_is_rejected(self):
        self.policy["previous"][0]["sha256"] = "0" * 64
        self.write_policy()
        self.assertEqual(
            self.errors(),
            [f"cannot verify retained SDK: retained SDK archive digest mismatch: {VERSION}"],
        )

    def test_more_than_one_predecessor_is_rejected(self):
        self.policy["previous"].append({
            "version": "0.1.2",
            "archive": "vendor/agent-art-protocol-0.1.2.tgz",
            "sha256": "0" * 64,
            "notices": [],
        })
        self.write_policy()
        errors, public_paths = check_retained_sdk(self.root, self.output)
        self.assertEqual(errors, ["cannot verify retained SDK: SDK retention is bounded to one predecessor"])
        self.assertEqual(public_paths, set())

    def test_archive_package_name_and_version_must_match_declaration(self):
        for key, incorrect in (("name", "@other/protocol"), ("version", "0.1.2")):
            with self.subTest(key=key):
                original = self.metadata[key]
                self.metadata[key] = incorrect
                self.write_archive()
                self.assertEqual(
                    self.errors(),
                    [f"cannot verify retained SDK: retained SDK package identity mismatch: {VERSION}"],
                )
                self.metadata[key] = original
                self.write_archive()

    def test_unlisted_files_and_newer_license_are_rejected(self):
        for name in ("extra.mjs", "nested/extra.css", "LICENSE"):
            with self.subTest(name=name):
                target = self.put(Path("_site") / DIRECTORY / name, b"Unexpected output.\n")
                self.assertEqual(self.errors(), [f"unexpected retained SDK asset: {DIRECTORY / name}"])
                target.unlink()


if __name__ == "__main__":
    unittest.main()
