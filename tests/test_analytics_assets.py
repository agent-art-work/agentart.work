"""Integrity and fail-closed generated analytics checks, entirely offline."""

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
        self.html = ('<footer class="site-footer"></footer>'
                     '<script type="application/json" id="analytics-config">'
                     '{"enabled":false,"siteToken":null,"production":false}</script>')
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

    def test_public_helper_or_handler_rejected(self):
        self.write("_site/assets/analytics-core.mjs", "export const excluded = false;")
        self.assertTrue(any("public analytics asset" in error for error in self.errors()))

    def test_unexpected_enablement_rejected(self):
        self.write("_site/index.html", self.html.replace('"enabled":false', '"enabled":true'))
        self.assertTrue(any("unexpected analytics config" in error for error in self.errors()))

    def test_direct_vendor_loader_rejected(self):
        self.write("_site/index.html", self.html + '<script src="https://www.googletagmanager.com/gtag/js"></script>')
        self.assertTrue(any("unconditional vendor resource" in error for error in self.errors()))

    def test_public_controls_and_replacement_binding_rejected(self):
        for control in ['<details id="site-privacy"></details>',
                        '<button data-analytics-action="exclude"></button>',
                        '<button data-analytics-action="include"></button>',
                        '<a href="#site-privacy">Privacy</a>',
                        '<script src="/assets/analytics.any.mjs"></script>']:
            with self.subTest(control=control):
                self.write("_site/index.html", self.html + control)
                self.assertTrue(self.errors())

    def test_production_hints_cannot_activate_unqualified_collection(self):
        self.assertEqual(self.errors(self.production_env()), [])
        self.write("_site/index.html", self.html.replace('"enabled":false', '"enabled":true'))
        self.assertTrue(any("unexpected analytics config" in e for e in self.errors(self.production_env())))

    def test_enabled_source_rejected(self):
        self.write("site/analytics.json", '{"enabled":true,"siteToken":null}')
        self.assertTrue(any("disabled and unset" in e for e in self.errors()))

    def test_obsolete_notice_rejected(self):
        self.write("_site/index.html", self.html + '<aside id="analytics-notice"></aside>')
        self.assertTrue(any("public measurement control" in e for e in self.errors()))
