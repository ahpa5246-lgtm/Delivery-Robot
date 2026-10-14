"""The first-party Garden view never embeds the third-party SuperSplat website."""
import unittest
from pathlib import Path
from scripts.serve_dashboard import response_for
ROOT=Path(__file__).resolve().parents[1]

class GardenNavigationTests(unittest.TestCase):
    def test_garden_tab_opens_one_engine_robot_view(self):
        status,ct,data=response_for('/')
        html=data.decode()
        self.assertEqual(status,200)
        self.assertIn('id="view-garden"',html)
        self.assertIn('href="/robot-garden"',html)
        self.assertNotIn('<iframe',html)
        self.assertNotIn('id="garden-frame"',html)
        nav=(ROOT/'dashboard'/'garden-splat.js').read_text()
        self.assertIn("window.location.assign('/robot-garden')",nav)
        self.assertIn("window.location.replace('/robot-garden')",nav)
        self.assertNotIn('superspl.at',nav)

    def test_garden_lab_has_local_robot_renderer_and_no_iframe(self):
        for path in ('/garden-splat.js','/robot-garden','/robot-garden.js'):
            self.assertEqual(response_for(path)[0],200)
        html=response_for('/robot-garden')[2].decode()
        self.assertIn('id="viewer"',html)
        self.assertNotIn('<iframe',html)
