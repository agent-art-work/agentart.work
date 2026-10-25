"""Check the explicitly retained SDK against its immutable source archive."""

import hashlib
import json
from pathlib import Path
import re
import tarfile

BROWSER_FILES = ("index.mjs", "clients.mjs", "reading.mjs", "reading-ui.mjs", "reading.css")


def check_retained_sdk(root, output):
    errors, public_paths = [], set()
    try:
        policy = json.loads((root / "site/sdk-asset-retention.json").read_text())
        previous = policy["previous"]
        if (policy.get("policy") != "current-and-one-predecessor"
                or not isinstance(previous, list) or len(previous) > 1):
            raise ValueError("SDK retention is bounded to one predecessor")
        for entry in previous:
            version, archive, digest, notices = (entry[key] for key in ("version", "archive", "sha256", "notices"))
            if (not re.fullmatch(r"[0-9][0-9A-Za-z.-]*", version)
                    or archive != f"vendor/agent-art-protocol-{version}.tgz"
                    or not re.fullmatch(r"[a-f0-9]{64}", digest)
                    or not isinstance(notices, list) or len(notices) > 2
                    or any(name not in ("README.md", "LICENSE") for name in notices)
                    or len(set(notices)) != len(notices)):
                raise ValueError("invalid retained SDK archive declaration")
            source = root / archive
            if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
                raise ValueError(f"retained SDK archive digest mismatch: {version}")
            directory = Path("assets/agent-art-sdk") / version
            names = (*BROWSER_FILES, *notices)
            public_paths.update(directory / name for name in names)
            with tarfile.open(source, "r:gz") as package:
                def member(name):
                    item = package.getmember(f"package/{name}")
                    if not item.isfile():
                        raise ValueError(f"retained SDK member is not a regular file: {name}")
                    return package.extractfile(item).read()

                metadata = json.loads(member("package.json"))
                if metadata.get("name") != "@agent-art/protocol" or metadata.get("version") != version:
                    raise ValueError(f"retained SDK package identity mismatch: {version}")
                for name in names:
                    target = output / directory / name
                    if not target.is_file():
                        errors.append(f"missing retained SDK asset: {directory / name}")
                    elif target.is_symlink() or target.read_bytes() != member(name):
                        errors.append(f"retained SDK bytes differ from archive: {directory / name}")
            target_dir = output / directory
            if target_dir.is_dir():
                for target in target_dir.rglob("*"):
                    if target.is_file() and target.relative_to(output) not in public_paths:
                        errors.append(f"unexpected retained SDK asset: {target.relative_to(output)}")
    except (OSError, ValueError, TypeError, KeyError, tarfile.TarError) as exc:
        errors.append(f"cannot verify retained SDK: {exc}")
    return errors, public_paths
