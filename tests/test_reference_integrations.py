"""Integration provenance checks, without pretending upstream ROS packages are installed."""
import json
from pathlib import Path
import unittest
from scripts.serve_dashboard import response_for

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = {
    "pouya-sixwheel": "delivery_robot.urdf.xacro",
    "mohamed-mecanum": "delivery_mobile_base.xacro",
    "rbot-nav2": "base.urdf.xacro",
    "linorobot-drive": "4wd_properties.urdf.xacro",
    "clearpath-outdoor": "construction.sdf",
    "turtlebot4": "depot.sdf",
    "warehouse-amr": "large_warehouse.sdf",
    "turtlebot3": "burger_model.sdf",
    "aws-warehouse": "warehouse_shelf.sdf",
}


class UpstreamIntegrationTests(unittest.TestCase):
    def test_provenance_api_and_roles(self):
        status, content_type, body = response_for("/api/references")
        self.assertEqual(status, 200)
        self.assertEqual(content_type, "application/json")
        data = json.loads(body)
        self.assertEqual(data["schema"], "cdr-reference-catalog-v1")
        records = data["source_repositories"]
        self.assertEqual(len(records), 10)
        self.assertEqual(len({v["repo"] for v in records}), 10)
        self.assertEqual(len([v for v in records if v["mode"] == "vendored-runtime"]), 1)
        for record in records:
            with self.subTest(repo=record["repo"]):
                self.assertTrue(record["url"].startswith("https://github.com/"))
                self.assertGreater(len(record["license"]), 2)
                self.assertGreater(len(record["active"]), 12)
                self.assertIn(record["mode"], {"concept", "vendored-runtime"})

    def test_attributed_reference_fixtures(self):
        parent = ROOT / "integrations" / "upstream_samples"
        self.assertEqual({p.name for p in parent.iterdir() if p.is_dir()}, set(FIXTURES))
        for label, source_name in FIXTURES.items():
            with self.subTest(source=label):
                directory = parent / label
                self.assertGreater((directory / source_name).stat().st_size, 100)
                self.assertGreater((directory / "LICENSE").stat().st_size, 100)
                self.assertIn("Repository: https://github.com/", (directory / "SOURCE.txt").read_text())

    def test_local_three_engine_and_3d_scripts(self):
        code, media_type, js = response_for("/vendor/three.min.js")
        self.assertEqual(code, 200)
        self.assertIn("javascript", media_type)
        self.assertGreater(len(js), 500_000)
        self.assertTrue((ROOT/"dashboard"/"vendor"/"THREE_LICENSE.txt").is_file())
        code, _, js = response_for("/scene3d.js")
        self.assertEqual(code, 200)
        self.assertIn(b"INTERACTIVE 3D", js)
        self.assertIn(b"NOT GAZEBO", js)


if __name__ == "__main__":
    unittest.main()
