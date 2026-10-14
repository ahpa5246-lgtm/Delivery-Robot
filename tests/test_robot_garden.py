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
        self.assertIn('id="quick-focus"', s)
        self.assertIn('id="lab-options" hidden', s)
        self.assertIn("same PlayCanvas scene", s)
        self.assertNotIn("<iframe", s)

    def test_real_playcanvas_entity_is_created(self):
        code, ct, data = response_for("/robot-garden.js")
        self.assertEqual(code, 200)
        self.assertIn("javascript", ct)
        s = data.decode()
        self.assertIn("import { createViewer }", s)
        self.assertIn("viewer.app", s)
        self.assertIn("ui:false", s)
        self.assertIn("placeNearView()", s)
        self.assertIn("app.root.addChild(base)", s)
        self.assertNotIn("frame.setAttribute", (ROOT/"dashboard/garden-splat.js").read_text())
        self.assertIn("SPATIAL REGISTRATION / GARDEN COLLISION NOT VERIFIED", s)
        self.assertIn("SCRIPTED PYTHON CAMPUS REPLAY (NOT GAZEBO)", s)

    def test_csp_is_scoped_to_lab_page(self):
        server = (ROOT/"scripts/serve_dashboard.py").read_text()
        self.assertIn('urlsplit(self.path).path == "/robot-garden"', server)
        self.assertIn("https://cdn.jsdelivr.net", server)
        self.assertIn("object-src 'none'; frame-ancestors 'none'", server)
        self.assertEqual(response_for("/assets/../../../etc/passwd")[0], 404)

    def test_secure_lod_zip_streaming(self):
        import json
        import tempfile
        import zipfile
        from unittest.mock import patch
        import scripts.serve_dashboard as app

        sample = {"lodLevels":4,"filenames":["0_0/meta.json"]}
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "garden.zip"
            with zipfile.ZipFile(p, "w") as z:
                z.writestr("lod-meta.json", json.dumps(sample))
                z.writestr("0_0/meta.json", '{"version":2}')
                z.writestr("0_0/means_l.webp", b"RIFFsampleWEBP")
                z.writestr("license.txt", "CC BY 4.0")
            with patch.object(app, "GARDEN_ZIP", p):
                self.assertEqual(response_for("/api/garden-asset")[0], 200)
                self.assertTrue(json.loads(response_for("/api/garden-asset")[2])["installed"])
                c, typ, data = response_for("/garden-assets/lod-meta.json")
                self.assertEqual(c, 200)
                self.assertIn("application/json", typ)
                self.assertEqual(json.loads(data), sample)
                self.assertEqual(response_for("/garden-assets/0_0/means_l.webp")[2], b"RIFFsampleWEBP")
                for bad in ("/garden-assets/../../etc/passwd",
                            "/garden-assets/0_0/unexpected.exe",
                            "/garden-assets/__pycache__/app.py"):
                    self.assertEqual(response_for(bad)[0], 404)

    def test_missing_garden_zip_is_reported(self):
        from unittest.mock import patch
        import scripts.serve_dashboard as app
        with patch.object(app, "GARDEN_ZIP", Path("/not/a/real/archive.zip")):
            self.assertEqual(response_for("/garden-assets/lod-meta.json")[0],404)
            self.assertFalse(__import__("json").loads(response_for("/api/garden-asset")[2])["installed"])

    def test_homepage_has_visible_lab_entry(self):
        data=response_for("/")[2].decode()
        self.assertIn('href="/robot-garden"', data)
        self.assertIn("OPEN SHARED 3D SCENE", data)
        self.assertIn("not yet registered to this garden", data)


if __name__ == "__main__":
    unittest.main()
