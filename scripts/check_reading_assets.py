"""Verify the reading module graph and its bounded, byte-exact predecessors."""

import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit


HASH = r"[a-f0-9]{64}"
VERSION = r"[0-9][0-9A-Za-z.-]*"


def asset_name(kind, revision):
    return f"agent-art-reading{'-work' if kind == 'work' else ''}.{revision}.mjs"


def legacy_router(versions, kind):
    mapping = json.dumps(versions, separators=(",", ":"))
    select = (
        "// Compatibility for previously published query-hash URLs. Never select latest.\n"
        f"const versions = {mapping};\n"
        "const revision = new URL(import.meta.url).searchParams.get('v');\n"
        f"if (!Object.hasOwn(versions, revision)) throw new Error('Unknown reading {kind} revision; use the manual prompt or reload the page.');\n"
    )
    return (select + ("export default (await import(versions[revision])).default;\n"
                      if kind == "work" else "await import(versions[revision]);\n")).encode()


class ModuleScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("type") == "module":
            self.sources.append(attrs.get("src", ""))


def check_reading_assets(root, output):
    errors, allowed = [], set()
    try:
        policy = json.loads((root / "site/reading-asset-retention.json").read_text())
        previous = policy["previous"]
        if (policy.get("policy") != "current-and-two-reading-predecessors"
                or not isinstance(previous, list) or len(previous) > 2):
            raise ValueError("reading retention is bounded to two predecessors")
        current_sdk = json.loads((root / "site/ask-your-agent-design.json").read_text())["integration"]["version"]
        sdk_policy = json.loads((root / "site/sdk-asset-retention.json").read_text())
        sdk_versions = [current_sdk, *(entry["version"] for entry in sdk_policy["previous"])]
        if any(not isinstance(version, str) or not re.fullmatch(VERSION, version) for version in sdk_versions):
            raise ValueError("invalid available SDK version")
        versions = {"adapter": {}, "work": {}}

        def read_regular(path):
            if path.is_symlink() or not path.is_file():
                raise ValueError(f"missing or non-regular reading asset: {path.relative_to(root) if path.is_relative_to(root) else path.name}")
            return path.read_bytes()

        def verify_output(name, expected):
            relative = Path("assets") / name
            allowed.add(relative)
            target = output / relative
            if not target.is_file():
                errors.append(f"missing reading asset: {relative}")
            elif target.is_symlink() or target.read_bytes() != expected:
                errors.append(f"reading asset bytes differ from source: {relative}")

        def imports_match(source, sdk, work, legacy=False):
            sdk_imports = re.findall(r"from ['\"]\./agent-art-sdk/([^'\"]+)/reading-ui\.mjs['\"]", source)
            work_imports = re.findall(r"from ['\"](\./agent-art-reading-work[^'\"]*)['\"]", source)
            valid_work = {f"./{asset_name('work', work)}"}
            if legacy:
                valid_work.add(f"./agent-art-reading-work.mjs?v={work}")
            return sdk_imports == [sdk] and len(work_imports) == 1 and work_imports[0] in valid_work

        for entry in previous:
            if (not isinstance(entry, dict)
                    or any(not isinstance(entry.get(key), str) for key in ("revision", "sdk", "adapter", "work"))
                    or not re.fullmatch(r"[a-f0-9]{40}", entry["revision"])
                    or entry["sdk"] not in sdk_versions
                    or any(not re.fullmatch(HASH, entry[kind]) for kind in ("adapter", "work"))
                    or entry["adapter"] in versions["adapter"]):
                raise ValueError("invalid retained reading snapshot declaration")
            for kind in ("adapter", "work"):
                revision = entry[kind]
                source = root / "site/reading-snapshots" / f"{kind}.{revision}.mjs"
                content = read_regular(source)
                if hashlib.sha256(content).hexdigest() != revision:
                    raise ValueError(f"retained reading {kind} bytes do not match their hash")
                if kind == "adapter" and not imports_match(content.decode("utf-8"), entry["sdk"], entry["work"], legacy=True):
                    raise ValueError("retained reading adapter does not match its declared SDK and Work")
                name = asset_name(kind, revision)
                verify_output(name, content)
                versions[kind][revision] = f"./{name}"

        page = ModuleScripts()
        page.feed((output / "index.html").read_text())
        entries = [urlsplit(source) for source in page.sources
                   if re.search(r"(?:^|/)agent-art-reading(?:\.|$)", urlsplit(source).path)]
        if (len(entries) != 1 or entries[0].scheme or entries[0].netloc
                or entries[0].query or entries[0].fragment):
            raise ValueError("homepage must select one immutable reading adapter")
        match = re.fullmatch(rf"(?:[^?#]*/)?assets/agent-art-reading\.({HASH})\.mjs", entries[0].path)
        if not match:
            raise ValueError("homepage must select one immutable reading adapter")
        adapter_revision = match[1]
        adapter_name = asset_name("adapter", adapter_revision)
        adapter = read_regular(output / "assets" / adapter_name)
        if hashlib.sha256(adapter).hexdigest() != adapter_revision:
            raise ValueError("current reading adapter bytes do not match their filename")
        adapter_text = adapter.decode("utf-8")
        work_imports = re.findall(rf"from ['\"]\./agent-art-reading-work\.({HASH})\.mjs['\"]", adapter_text)
        if len(work_imports) != 1 or not imports_match(adapter_text, current_sdk, work_imports[0]):
            raise ValueError("current reading adapter must import its immutable Work and current SDK")
        work_revision = work_imports[0]
        work_name = asset_name("work", work_revision)
        work = read_regular(output / "assets" / work_name)
        if hashlib.sha256(work).hexdigest() != work_revision:
            raise ValueError("current reading Work bytes do not match their filename")
        source = read_regular(root / "site/assets/agent-art-reading.mjs").decode("utf-8")
        if source.count("'./agent-art-reading-work.mjs'") != 1:
            raise ValueError("current reading adapter source must import one Work")
        expected = source.replace("'./agent-art-reading-work.mjs'", f"'./{work_name}'", 1).encode()
        verify_output(adapter_name, expected)
        verify_output(work_name, work)
        for kind in ("adapter", "work"):
            name = "agent-art-reading-work.mjs" if kind == "work" else "agent-art-reading.mjs"
            verify_output(name, legacy_router(versions[kind], kind))
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        errors.append(f"cannot verify reading assets: {exc}")
    return errors, allowed
