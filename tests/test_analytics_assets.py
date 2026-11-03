"""Integrity and fail-closed generated analytics checks, entirely offline."""

import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_analytics import check_analytics


class AnalyticsAssetChecks(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.output = self.root / "_site"
        for folder in [self.root / "site/assets", self.output / "assets"]:
            folder.mkdir(parents=True)
        self.write("site/analytics.json", '{"enabled":false,"siteToken":null}')
        core, ui, css = "export const disabled = true;\n", "void disabled;\n", "dialog{color:inherit}\n"
        self.write("site/assets/analytics-core.mjs", core)
        self.write("site/assets/analytics-ui.mjs", "import { createAnalytics } from './analytics-core.mjs';\n" + ui)
        self.write("site/assets/analytics.css", css)
        self.names = []
        for content, suffix in [(core + "\n" + ui, "mjs"), (css, "css")]:
            name = f'assets/analytics.{hashlib.sha256(content.encode()).hexdigest()}.{suffix}'
            self.names.append(name)
            self.write("_site/" + name, content)
        self.html = ('<footer class="site-footer"></footer><div id="site-privacy"></div>'
                     '<button data-analytics-action="exclude"></button>'
                     '<button data-analytics-action="include"></button>'
                     '<script type="application/json" id="analytics-config">'
                     '{"enabled":false,"siteToken":null,"production":false}</script>'
                     f'<script src="/{self.names[0]}"></script><link href="/{self.names[1]}">')
        self.write("_site/index.html", self.html)

    def write(self, file, text):
        (self.root / file).write_text(text)

    def errors(self, env=None):
        with patch.dict("os.environ", env or {}, clear=True):
            return check_analytics(self.root, self.output, "")[0]

    def production_env(self):
        return {"CI": "true", "GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": "agent-art-work/agentart.work",
                "GITHUB_REF": "refs/heads/main", "GITHUB_EVENT_NAME": "push",
                "GITHUB_WORKFLOW_REF": "agent-art-work/agentart.work/.github/workflows/pages.yml@refs/heads/main",
                "AGENTART_DEPLOYMENT": "production", "AGENTART_ANALYTICS_ENABLED": "true",
                "AGENTART_ANALYTICS_MEASUREMENT_ID": "G-0000000000"}

    def test_disabled_fixture_passes(self):
        self.assertEqual(self.errors(), [])

    def test_changed_or_missing_module_rejected(self):
        self.write("_site/" + self.names[0], "changed")
        self.assertTrue(any("changed analytics asset" in error for error in self.errors()))

    def test_unexpected_enablement_rejected(self):
        self.write("_site/index.html", self.html.replace('"enabled":false', '"enabled":true'))
        self.assertTrue(any("unexpected analytics config" in error for error in self.errors()))

    def test_direct_vendor_loader_rejected(self):
        self.write("_site/index.html", self.html + '<script src="https://www.googletagmanager.com/gtag/js"></script>')
        self.assertTrue(any("unconditional vendor resource" in error for error in self.errors()))

    def test_refusal_control_required(self):
        self.write("_site/index.html", self.html.replace('data-analytics-action="exclude"', 'data-analytics-action="other"'))
        self.assertTrue(any("missing privacy control" in error for error in self.errors()))

    def test_production_hints_cannot_activate_unqualified_collection(self):
        self.assertEqual(self.errors(self.production_env()), [])
        self.write("_site/index.html", self.html.replace('"enabled":false', '"enabled":true'))
        self.assertTrue(any("unexpected analytics config" in e for e in self.errors(self.production_env())))

    def test_enabled_source_rejected(self):
        self.write("site/analytics.json", '{"enabled":true,"siteToken":null}')
        self.assertTrue(any("disabled and unset" in e for e in self.errors()))

    def test_obsolete_notice_rejected(self):
        self.write("_site/index.html", self.html + '<aside id="analytics-notice"></aside>')
        self.assertTrue(any("obsolete consent UI" in e for e in self.errors()))
