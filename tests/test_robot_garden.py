"""Robot + original splat must be a real single-engine page, not a CSS/video overlay."""
import unittest
from pathlib import Path
from scripts.serve_dashboard import response_for

ROOT = Path(__file__).resolve().parents[1]


class GardenRobotTests(unittest.TestCase):
    def test_real_robot_lab_route_exists(self):
        code, ct, html = response_for("/robot-garden")
        self.assertEqual(code, 200)
        self.assertIn("text/html", ct)
        s = html.decode()
        self.assertIn('id="viewer"', s)
        self.assertIn('id="splat-file"', s)
        self.assertIn('id="odom-file"', s)
        self.assertIn("same PlayCanvas scene", s)
        self.assertNotIn("<iframe", s)

    def test_real_playcanvas_entity_is_created(self):
        code, ct, data = response_for("/robot-garden.js")
        self.assertEqual(code, 200)
        self.assertIn("javascript", ct)
        s = data.decode()
        self.assertIn("import { createViewer }", s)
        self.assertIn("viewer.app", s)
        self.assertIn("app.root.addChild(base)", s)
        self.assertIn("frame.setAttribute", (ROOT/"dashboard/garden-splat.js").read_text())
        self.assertIn("SPATIAL REGISTRATION / GARDEN COLLISION NOT VERIFIED", s)
        self.assertIn("SCRIPTED PYTHON CAMPUS REPLAY (NOT GAZEBO)", s)

    def test_csp_is_scoped_to_lab_page(self):
        server = (ROOT/"scripts/serve_dashboard.py").read_text()
        self.assertIn('urlsplit(self.path).path == "/robot-garden"', server)
        self.assertIn("https://cdn.jsdelivr.net", server)
        self.assertIn("object-src 'none'; frame-ancestors 'none'", server)
        self.assertEqual(response_for("/assets/../../../etc/passwd")[0], 404)

    def test_homepage_has_visible_lab_entry(self):
        data=response_for("/")[2].decode()
        self.assertIn('href="/robot-garden"', data)
        self.assertIn("not yet registered to this garden", data)


if __name__ == "__main__":
    unittest.main()
