"""Root keeps the dashboard and embeds only its own robot renderer."""
import unittest
from pathlib import Path
from scripts.serve_dashboard import response_for
ROOT=Path(__file__).resolve().parents[1]

class GardenDashboardTests(unittest.TestCase):
    def test_dashboard_not_redirected_to_external_website(self):
        status,ct,data=response_for('/')
        h=data.decode()
        self.assertEqual(status,200)
        self.assertIn('id="garden-engine"',h)
        self.assertIn('data-src="/robot-garden?embed=1"',h)
        self.assertIn('id="garden-pose-xz"',h)
        self.assertIn('id="analytics-section"',h)
        self.assertIn('id="sensor-section"',h)
        self.assertIn('id="collision-panel"',h)
        self.assertNotIn('superspl.at/scene/bc0906cd?aa',h)
    def test_nav_retains_dashboard_and_synthetic_model_disclosure(self):
        s=(ROOT/'dashboard/garden-splat.js').read_text()
        self.assertIn('gardenButton.addEventListener',s)
        self.assertIn('event.origin!==location.origin',s)
        self.assertNotIn('window.location.replace',s)
        self.assertIn("d.type!=='cdr:garden-pose'",s)
        page=response_for('/')[2].decode()
        self.assertIn('the separate synthetic campus',page)
        self.assertIn('not yet registered to this garden',page)
    def test_garden_canvas_is_real_playcanvas_not_provider_website(self):
        lab=response_for('/robot-garden')[2].decode()
        self.assertIn('id="viewer"',lab)
        self.assertIn('id="ground-pick-layer"',lab)
        self.assertIn('id="floor-y"',lab)
        self.assertNotIn('<iframe',lab)
