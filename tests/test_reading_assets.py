"""Reading cache-boundary corruption checks without a build or network."""

import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_reading_assets import asset_name, check_reading_assets, legacy_router


CURRENT = "0.1.5-alpha.2"
PREVIOUS = "0.1.5-flat-label.1"


def digest(content):
    return hashlib.sha256(content).hexdigest()


def adapter(sdk, work):
    return (f"import {{ mountReading }} from './agent-art-sdk/{sdk}/reading-ui.mjs';\n"
            f"import work from './{work}';\n"
            "mountReading(document.querySelector('#ask-your-agent'), { work });\n").encode()


class ReadingAssetChecks(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="Agent-Art-Work-reading-retention-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.output = self.root / "_site"
        self.old_work = b'export default {"prompt":"previous prompt"};\n'
        self.new_work = b'export default {"prompt":"current prompt"};\n'
        self.old_adapter = adapter(PREVIOUS, f"agent-art-reading-work.mjs?v={digest(self.old_work)}")
        self.policy = {
            "policy": "current-and-two-reading-predecessors",
            "previous": [{"revision": "1" * 40, "sdk": PREVIOUS,
                          "adapter": digest(self.old_adapter), "work": digest(self.old_work)}],
        }
        self.put("site/ask-your-agent-design.json", json.dumps({"integration": {"version": CURRENT}}))
        self.put("site/sdk-asset-retention.json", json.dumps({"previous": [{"version": PREVIOUS}]}))
        self.put("site/assets/agent-art-reading.mjs", adapter(CURRENT, "agent-art-reading-work.mjs"))
        self.write_snapshot("adapter", self.old_adapter)
        self.write_snapshot("work", self.old_work)
        self.write_policy_and_routers()
        self.put(Path("_site/assets") / asset_name("work", digest(self.new_work)), self.new_work)
        self.write_current_adapter(adapter(CURRENT, asset_name("work", digest(self.new_work))))

    def put(self, relative, content):
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content.encode() if isinstance(content, str) else content)
        return target

    def write_snapshot(self, kind, content):
        revision = digest(content)
        self.put(f"site/reading-snapshots/{kind}.{revision}.mjs", content)
        self.put(Path("_site/assets") / asset_name(kind, revision), content)

    def write_current_adapter(self, content):
        self.current_adapter_name = asset_name("adapter", digest(content))
        self.put(Path("_site/assets") / self.current_adapter_name, content)
        self.put("_site/index.html", f'<script src="/assets/{self.current_adapter_name}" type="module"></script>')

    def write_policy_and_routers(self):
        self.put("site/reading-asset-retention.json", json.dumps(self.policy))
        for kind in ("adapter", "work"):
            versions = {entry[kind]: f"./{asset_name(kind, entry[kind])}" for entry in self.policy["previous"]}
            name = "agent-art-reading-work.mjs" if kind == "work" else "agent-art-reading.mjs"
            self.put(Path("_site/assets") / name, legacy_router(versions, kind))

    def errors(self):
        return check_reading_assets(self.root, self.output)[0]

    def test_exact_graph_and_routers_pass_with_distinct_old_and_current_work(self):
        errors, allowed = check_reading_assets(self.root, self.output)
        self.assertEqual(errors, [])
        self.assertEqual(allowed, {
            Path("assets") / name for name in (
                self.current_adapter_name, asset_name("work", digest(self.new_work)),
                asset_name("adapter", digest(self.old_adapter)), asset_name("work", digest(self.old_work)),
                "agent-art-reading.mjs", "agent-art-reading-work.mjs",
            )
        })
        self.assertNotIn(Path("assets/agent-art-reading.unlisted.mjs"), allowed)

    def test_project_base_path_is_supported(self):
        self.put("_site/index.html", f'<script type="module" src="/agentart.work/assets/{self.current_adapter_name}"></script>')
        self.assertEqual(self.errors(), [])

    def test_two_snapshots_can_share_work_and_use_current_sdk(self):
        retained = adapter(CURRENT, f"agent-art-reading-work.mjs?v={digest(self.old_work)}")
        self.policy["previous"].append({"revision": "2" * 40, "sdk": CURRENT,
                                        "adapter": digest(retained), "work": digest(self.old_work)})
        self.write_snapshot("adapter", retained)
        self.write_policy_and_routers()
        errors, allowed = check_reading_assets(self.root, self.output)
        self.assertEqual(errors, [])
        self.assertEqual(len(allowed), 7)

    def test_retained_immutable_work_import_is_supported(self):
        retained = adapter(PREVIOUS, asset_name("work", digest(self.old_work)))
        self.policy["previous"][0]["adapter"] = digest(retained)
        self.write_snapshot("adapter", retained)
        self.write_policy_and_routers()
        self.assertEqual(self.errors(), [])

    def test_missing_outputs_are_rejected_including_unlinked_predecessors(self):
        _, allowed = check_reading_assets(self.root, self.output)
        for relative in allowed:
            with self.subTest(relative=relative):
                target = self.output / relative
                content = target.read_bytes()
                target.unlink()
                self.assertTrue(self.errors())
                target.write_bytes(content)

    def test_missing_or_changed_snapshot_source_is_rejected(self):
        target = self.root / f"site/reading-snapshots/adapter.{digest(self.old_adapter)}.mjs"
        target.unlink()
        self.assertTrue(self.errors())
        target.write_bytes(self.old_adapter + b"// changed\n")
        self.assertIn("retained reading adapter bytes do not match their hash", " ".join(self.errors()))

    def test_changed_retained_output_is_rejected(self):
        for kind, content in (("adapter", self.old_adapter), ("work", self.old_work)):
            with self.subTest(kind=kind):
                target = self.output / "assets" / asset_name(kind, digest(content))
                target.write_bytes(content + b"// changed\n")
                self.assertIn(f"reading asset bytes differ from source: assets/{target.name}", self.errors())
                target.write_bytes(content)

    def test_current_assets_must_match_filename_hashes(self):
        for name in (self.current_adapter_name, asset_name("work", digest(self.new_work))):
            with self.subTest(name=name):
                target = self.output / "assets" / name
                content = target.read_bytes()
                target.write_bytes(content + b"// changed\n")
                self.assertIn("bytes do not match their filename", " ".join(self.errors()))
                target.write_bytes(content)

    def test_routers_must_not_select_latest_or_change_exports(self):
        for name in ("agent-art-reading.mjs", "agent-art-reading-work.mjs"):
            with self.subTest(name=name):
                target = self.output / "assets" / name
                original = target.read_bytes()
                target.write_bytes(b"export default {}; // latest fallback\n")
                self.assertIn(f"reading asset bytes differ from source: assets/{name}", self.errors())
                target.write_bytes(original)

    def test_bad_manifest_and_unavailable_sdk_are_rejected(self):
        original = json.loads(json.dumps(self.policy))
        cases = [
            {"policy": "unbounded", "previous": []},
            {"policy": original["policy"], "previous": original["previous"] * 3},
            {"policy": original["policy"], "previous": original["previous"] * 2},
        ]
        for key, value in (("revision", "bad"), ("adapter", "../bad"), ("work", None), ("sdk", "9.9.9")):
            malformed = json.loads(json.dumps(original))
            malformed["previous"][0][key] = value
            cases.append(malformed)
        for policy in cases:
            with self.subTest(policy=policy):
                self.put("site/reading-asset-retention.json", json.dumps(policy))
                self.assertTrue(self.errors())

    def test_snapshot_imports_must_match_its_declared_sdk_and_work(self):
        for content in (adapter(CURRENT, f"agent-art-reading-work.mjs?v={digest(self.old_work)}"),
                        adapter(PREVIOUS, f"agent-art-reading-work.mjs?v={digest(self.new_work)}")):
            with self.subTest(content=content):
                self.policy["previous"][0]["adapter"] = digest(content)
                self.write_snapshot("adapter", content)
                self.write_policy_and_routers()
                self.assertIn("retained reading adapter does not match its declared SDK and Work", " ".join(self.errors()))

    def test_current_adapter_requires_pinned_sdk_and_immutable_work(self):
        for content in (adapter(PREVIOUS, asset_name("work", digest(self.new_work))),
                        adapter(CURRENT, f"agent-art-reading-work.mjs?v={digest(self.new_work)}")):
            with self.subTest(content=content):
                self.write_current_adapter(content)
                self.assertIn("current reading adapter must import its immutable Work and current SDK", " ".join(self.errors()))

    def test_current_adapter_must_equal_authored_source(self):
        content = adapter(CURRENT, asset_name("work", digest(self.new_work))) + b"// divergent build\n"
        self.write_current_adapter(content)
        self.assertIn(f"reading asset bytes differ from source: assets/{self.current_adapter_name}", self.errors())

    def test_homepage_cannot_select_fixed_query_or_external_entry(self):
        for src in ("/assets/agent-art-reading.mjs?v=" + digest(self.old_adapter),
                    f"/assets/{self.current_adapter_name}?v=anything",
                    f"https://example.com/assets/{self.current_adapter_name}"):
            with self.subTest(src=src):
                self.put("_site/index.html", f'<script type="module" src="{src}"></script>')
                self.assertIn("homepage must select one immutable reading adapter", " ".join(self.errors()))


if __name__ == "__main__":
    unittest.main()
