"""Native Lichtblick visual scenery acceptance: file references and frame safety."""
from pathlib import Path
import json
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / "assets/world"
WORLD = json.loads((ROOT / "world/campus_layout.json").read_text())


class NativeEnvironmentTests(unittest.TestCase):
    def test_both_environments_are_renderable_static_urdfs(self):
        expected = {"campus": 160, "logistics": 60}
        for name, minimum in expected.items():
            with self.subTest(name=name):
                doc = ET.parse(ENV / f"native-{name}.urdf").getroot()
                self.assertEqual(doc.tag, "robot")
                self.assertEqual([link.attrib["name"] for link in doc.findall("link")], ["odom"])
                self.assertFalse(doc.findall(".//collision"))
                self.assertFalse(doc.findall(".//joint"))
                self.assertFalse(doc.findall(".//inertial"))
                visuals = doc.findall(".//visual")
                self.assertGreaterEqual(len(visuals), minimum)
                self.assertEqual(len({v.attrib["name"] for v in visuals}), len(visuals))
                for visual in visuals:
                    origin = visual.find("origin")
                    self.assertIsNotNone(origin)
                    coordinates = [float(x) for x in origin.attrib["xyz"].split()]
                    self.assertEqual(len(coordinates), 3)
                    self.assertTrue(all(-5 <= value <= 40 for value in coordinates[:2]))
                    self.assertTrue(-1 <= coordinates[2] <= 10)
                    self.assertIsNotNone(visual.find("geometry"))
                    self.assertIsNotNone(visual.find("material/color"))

    def test_ground_and_building_footprints_derived_from_shared_map(self):
        campus = ET.parse(ENV / "native-campus.urdf").getroot()
        visuals = campus.findall(".//visual")
        centers = []
        for visual in visuals:
            prefix = visual.attrib["name"].rsplit("_", 1)[0]
            if prefix in {b["id"] for b in WORLD["buildings"]}:
                centers.append(tuple(float(v) for v in visual.find("origin").attrib["xyz"].split())[:2])
        expected_centers = [((b["footprint_m"][0] + b["footprint_m"][2]) / 2,
                             (b["footprint_m"][1] + b["footprint_m"][3]) / 2)
                            for b in WORLD["buildings"]]
        self.assertEqual(sorted(centers), sorted(expected_centers))

    def test_meshes_are_existing_locally_licensed_sources(self):
        allowed = {
            "/models/environment/world/cafe-table.dae": ROOT / "dashboard/assets/world/cafe-table.dae",
            "/models/environment/world/warehouse-shelf.dae": ROOT / "dashboard/assets/world/warehouse-shelf.dae",
        }
        seen = set()
        for name in ("campus", "logistics"):
            root = ET.parse(ENV / f"native-{name}.urdf").getroot()
            for mesh in root.findall(".//mesh"):
                uri = mesh.attrib["filename"]
                self.assertIn(uri, allowed, uri)
                self.assertTrue(allowed[uri].is_file(), uri)
                scale = [float(x) for x in mesh.attrib["scale"].split()]
                self.assertEqual(len(scale), 3)
                self.assertTrue(all(0 < value <= 1 for value in scale))
                seen.add(uri)
        self.assertEqual(seen, set(allowed))

    def test_existing_replay_and_robot_models_are_not_duplicated_in_visual_scene(self):
        for name in ("campus", "logistics"):
            text = (ENV / f"native-{name}.urdf").read_text()
            self.assertNotIn("base_link", text)
            self.assertNotIn("robot_description", text)
            self.assertNotIn("<plugin", text)
            self.assertNotIn("<sensor", text)
        self.assertEqual(WORLD["map"]["width_m"], 32)
        self.assertEqual(WORLD["map"]["height_m"], 20)


if __name__ == "__main__":
    unittest.main()
