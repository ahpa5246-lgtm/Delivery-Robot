"""Contract tests for the opt-in real Gaussian Garden viewer."""
import unittest
from pathlib import Path

from scripts.serve_dashboard import response_for

ROOT = Path(__file__).resolve().parents[1]


class RealGardenTests(unittest.TestCase):
    def test_real_scene_is_embedded_with_credit_and_clear_limit(self):
        code, content_type, payload = response_for("/")
        html = payload.decode("utf-8")
        self.assertEqual((code, content_type), (200, "text/html; charset=utf-8"))
        self.assertIn('id="view-garden"', html)
        self.assertIn('id="garden-frame"', html)
        self.assertIn("https://superspl.at/scene/bc0906cd?aa", html)
        self.assertIn("transkatgirl", html)
        self.assertIn("CC BY 4.0", html)
        self.assertIn("not yet registered to this garden", html)
        self.assertIn("/garden-splat.js", html)

    def test_garden_assets_are_served_only_from_allowlist(self):
        for uri, kind in (("/garden-splat.js", "text/javascript"),
                          ("/garden-splat.css", "text/css")):
            status, mime, body = response_for(uri)
            self.assertEqual(status, 200)
            self.assertIn(kind, mime)
            self.assertGreater(len(body), 400)
        self.assertEqual(response_for("/garden-splat.js/../../README.md")[0], 404)

    def test_server_csp_explicitly_allows_only_real_scene_frame(self):
        src = (ROOT / "scripts" / "serve_dashboard.py").read_text(encoding="utf-8")
        self.assertIn("frame-src https://superspl.at;", src)
        self.assertIn("frame-ancestors 'none'", src)
        js = (ROOT / "dashboard" / "garden-splat.js").read_text(encoding="utf-8")
        self.assertIn("frame.setAttribute('src', frame.dataset.src)", js)
        self.assertIn("campus3d.hidden = true", js)
        self.assertIn("disclosure.hidden = false", js)
        self.assertIn("gardenButton.click()", js)
        self.assertIn("requestedView !== 'campus'", js)


if __name__ == "__main__":
    unittest.main()
