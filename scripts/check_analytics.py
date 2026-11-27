"""Check collector-free/OFF output without public preference controls."""

import json
import re


def check_analytics(root, output, base):
    errors, public_files = [], set()
    try:
        config = json.loads((root / 'site/analytics.json').read_text())
        if set(config) != {'enabled', 'siteToken'} or config['enabled'] is not False or config['siteToken'] is not None:
            raise ValueError('checked-in analytics configuration must remain disabled and unset')
        expected = {'enabled': False, 'siteToken': None, 'production': False}
        for file in (output / 'assets').iterdir():
            if re.match(r'analytics[.-].*\.(?:mjs|js|css)$', file.name):
                errors.append(f'public analytics asset is not allowed: {file.relative_to(output)}')
        for file in output.rglob('*.html'):
            html = file.read_text()
            if re.search(r'site-privacy|privacy-information|analytics-(?:notice|settings|status)|data-analytics-action', html):
                errors.append(f'public measurement control: {file.relative_to(output)}')
            if re.search(r'''(?:src|href)=["'][^"']*(?:assets/analytics[.-]|\#site-privacy)''', html):
                errors.append(f'public measurement binding: {file.relative_to(output)}')
            if re.search(r'''<(?:script|link|iframe)[^>]+(?:src|href)=["']https?://[^"']*(?:google-analytics|googletagmanager|cloudflareinsights)''', html):
                errors.append(f'unconditional vendor resource: {file.relative_to(output)}')
            if 'class="site-footer"' not in html:
                continue  # Isolated historical demos/redirects do not load analytics.
            matches = re.findall(r'<script type="application/json" id="analytics-config">(.*?)</script>', html)
            if len(matches) != 1 or json.loads(matches[0]) != expected:
                errors.append(f'unexpected analytics config: {file.relative_to(output)}')
    except (OSError, UnicodeError, ValueError, TypeError, KeyError) as exc:
        errors.append(f'analytics build check: {exc}')
    return errors, public_files
