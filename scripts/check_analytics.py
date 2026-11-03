"""Verify the small site-owned analytics artifact and its default-off shell."""

import hashlib
import json
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
        if set(config) != {"enabled", "siteToken"} or config["enabled"] is not False or config["siteToken"] is not None:
            raise ValueError("checked-in analytics configuration must remain disabled and unset")
        expected = {"enabled": False, "siteToken": None, "production": False}
        if re.search(r"googletagmanager|google-analytics|gtag\(|beacon\.min\.js|cloudflareinsights", module):
            errors.append("unqualified vendor loader in module")
        for file in output.rglob("*.html"):
            html = file.read_text()
            if 'class="site-footer"' not in html:
                continue  # Isolated historical design demos do not load analytics.
            matches = re.findall(r'<script type="application/json" id="analytics-config">(.*?)</script>', html)
            if len(matches) != 1 or json.loads(matches[0]) != expected:
                errors.append(f"unexpected analytics config: {file.relative_to(output)}")
            if any(token in html for token in ['id="analytics-notice"', 'id="analytics-settings"', 'data-analytics-action="allow"', 'data-analytics-action="reject"']):
                errors.append(f"obsolete consent UI: {file.relative_to(output)}")
            for relative in public_files:
                if f'{base}/{relative}' not in html:
                    errors.append(f"missing analytics asset reference: {file.relative_to(output)}: {relative}")
            for token in ['id="site-privacy"', 'data-analytics-action="exclude"', 'data-analytics-action="include"']:
                if token not in html:
                    errors.append(f"missing privacy control: {file.relative_to(output)}: {token}")
            if re.search(r'<(?:script|link|iframe)[^>]+(?:src|href)=["\']https?://[^"\']*(?:google-analytics|googletagmanager|cloudflareinsights)', html):
                errors.append(f"unconditional vendor resource: {file.relative_to(output)}")
    except (OSError, UnicodeError, ValueError, TypeError, KeyError) as exc:
        errors.append(f"analytics build check: {exc}")
    return errors, public_files
