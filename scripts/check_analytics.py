"""Verify the small site-owned analytics artifact and its default-off shell."""

import hashlib
import json
import os
from pathlib import Path
import re


def check_analytics(root, output, base):
    errors, public_files = [], set()
    try:
        assets = root / "site/assets"
        ui = (assets / "analytics-ui.mjs").read_text()
        marker = "import { createAnalytics } from './analytics-core.mjs';\n"
        if not ui.startswith(marker):
            raise ValueError("unexpected analytics entry import")
        module = (assets / "analytics-core.mjs").read_text() + "\n" + ui[len(marker):]
        for content, suffix in [(module, "mjs"), ((assets / "analytics.css").read_text(), "css")]:
            data = content.encode("utf-8")
            relative = Path(f"assets/analytics.{hashlib.sha256(data).hexdigest()}.{suffix}")
            public_files.add(relative)
            if not (output / relative).is_file() or (output / relative).read_bytes() != data:
                errors.append(f"missing or changed analytics asset: {relative}")
        config = json.loads((root / "site/analytics.json").read_text())
        if set(config) != {"enabled", "measurementId"} or config["enabled"] is not False or config["measurementId"] is not None:
            raise ValueError("checked-in analytics configuration must remain disabled and unset")
        env = os.environ
        production = (not base and env.get("AGENTART_DEPLOYMENT") == "production"
                      and env.get("AGENTART_ANALYTICS_ENABLED") == "true"
                      and env.get("CI") == "true" and env.get("GITHUB_ACTIONS") == "true"
                      and env.get("GITHUB_REPOSITORY") == "agent-art-work/agentart.work"
                      and env.get("GITHUB_REF") == "refs/heads/main"
                      and env.get("GITHUB_EVENT_NAME") in {"push", "workflow_dispatch"}
                      and env.get("GITHUB_WORKFLOW_REF") == "agent-art-work/agentart.work/.github/workflows/pages.yml@refs/heads/main")
        measurement_id = env.get("AGENTART_ANALYTICS_MEASUREMENT_ID") if production else None
        if production and (not measurement_id or not re.fullmatch(r"G-[A-Z0-9]{6,20}", measurement_id) or "TEST" in measurement_id):
            raise ValueError("explicit production analytics requires a valid measurement ID")
        expected = {"enabled": bool(production), "measurementId": measurement_id,
                    "production": bool(production)}
        for file in output.rglob("*.html"):
            html = file.read_text()
            if 'class="site-footer"' not in html:
                continue  # Isolated historical design demos do not load analytics.
            matches = re.findall(r'<script type="application/json" id="analytics-config">(.*?)</script>', html)
            if len(matches) != 1 or json.loads(matches[0]) != expected:
                errors.append(f"unexpected analytics config: {file.relative_to(output)}")
            for relative in public_files:
                if f'{base}/{relative}' not in html:
                    errors.append(f"missing analytics asset reference: {file.relative_to(output)}: {relative}")
            for token in ['id="analytics-settings"', 'id="analytics-notice"', 'data-analytics-action="reject"', 'data-analytics-action="open"']:
                if token not in html:
                    errors.append(f"missing consent control: {file.relative_to(output)}: {token}")
            if re.search(r'<(?:script|link|iframe)[^>]+(?:src|href)=["\']https?://[^"\']*(?:google-analytics|googletagmanager)', html):
                errors.append(f"unconditional Google resource: {file.relative_to(output)}")
    except (OSError, UnicodeError, ValueError, TypeError, KeyError) as exc:
        errors.append(f"analytics build check: {exc}")
    return errors, public_files
