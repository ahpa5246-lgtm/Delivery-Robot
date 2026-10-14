"""Gazebo *flat-contact* Garden proxy, real message extraction and provenance."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from xml.etree import ElementTree as ET

import scripts.generate_garden_gazebo as generator
import scripts.export_garden_odometry as exporter
import scripts.serve_dashboard as webserver


def calibration():
    return {
        "schema": "cdr-garden-calibration-v1",
        "source_sha256": generator.EXPECTED_SOURCE,
        "origin_scene": {"x": 1.2, "y": -2.1, "z": -0.3},
        "meters_per_scene_unit": 0.8,
        "scene_yaw_deg": 45,
        "scene_y_axis": "up",
        "flat_patch_size_m": 8,
        "terrain_collision_verified": False,
    }


def gazebo_message(sec, x, y, yaw_z, yaw_w):
    return (f"header {{\n  stamp {{\n    sec: {sec}\n    nsec: 0\n  }}\n}}\n"
            f"pose {{\n position {{\n x: {x}\n y: {y}\n z: 0.11\n }}\n"
            f" orientation {{\n z: {yaw_z}\n w: {yaw_w}\n }}\n}}\n"
            "twist {\n linear {\n x: 0.2\n }\n}\n")


class GardenPhysicsTests(unittest.TestCase):
    def test_calibration_rejects_false_physics_claims_and_bad_units(self):
        with tempfile.TemporaryDirectory() as temp:
            fn=Path(temp)/"config.json"
            config=calibration()
            config["terrain_collision_verified"]=True
            fn.write_text(json.dumps(config))
            with self.assertRaises(ValueError):
                generator.calibration_from_file(fn)
            config=calibration()
            config["meters_per_scene_unit"]=float("nan")
            fn.write_text(json.dumps(config))
            with self.assertRaises(ValueError):
                generator.calibration_from_file(fn)
            config=calibration()
            config["source_sha256"]="wrong"
            fn.write_text(json.dumps(config))
            with self.assertRaises(ValueError):
                generator.calibration_from_file(fn)
            fn.write_text(json.dumps(calibration()))
            self.assertEqual(generator.calibration_from_file(fn)["scene_yaw_deg"],45)

    def test_physical_ground_and_dynamic_robot_but_no_claimed_hedges(self):
        with tempfile.TemporaryDirectory() as temp:
            path,prov=generator.create_world(calibration(),Path(temp)/"garden.sdf")
            root=ET.parse(path).getroot()
            world=root.find("world")
            self.assertEqual(world.attrib["name"],"garden_flat_contact_proxy")
            self.assertEqual(
                world.findtext("./model[@name='garden_flat_contact_patch']/link/collision/geometry/box/size"),
                "8 8 0.2")
            self.assertEqual(len(world.findall("./model[@name='cdr01']/link")),6)
            self.assertIsNotNone(world.find("./model[@name='cdr01']/plugin[@name='gz::sim::systems::DiffDrive']"))
            self.assertFalse(any(m.get("name","").startswith("campus_bollard")
                                 for m in world.findall("model")))
            info=json.loads(prov.read_text())
            self.assertFalse(info["terrain_collision_verified"])
            self.assertEqual(info["garden_obstacle_collisions"],"NOT_MODELED")
            self.assertEqual(len(info["world_sha256"]),64)

    def test_codespaces_launcher_is_syntax_checked_and_source_labeled(self):
        root = Path(__file__).resolve().parents[1]
        launch = root / "scripts/start_codespaces_full.sh"
        subprocess.run(["bash", "-n", str(launch)], check=True)
        help_output = subprocess.run(
            ["bash", str(launch), "--help"], capture_output=True, text=True,
            check=True,
        ).stdout
        self.assertIn("original 113 MB", help_output.lower())
        self.assertIn("8765", help_output)
        content = launch.read_text(encoding="utf-8")
        self.assertIn("EXPECTED_SOURCE", content)
        self.assertIn("garden_status()", content)
        self.assertIn("scripts/run_garden_gazebo.sh", content)
        self.assertIn("exec python3 scripts/serve_dashboard.py", content)

    def test_ros2_watchdog_and_real_stop_acceptance_present(self):
        root=Path(__file__).resolve().parents[1]
        script=(root/"scripts/run_garden_gazebo.sh").read_text()
        self.assertIn("ros_velocity_watchdog.py",script)
        self.assertIn("drive_garden_ros2.py",script)
        self.assertIn("stopped_at_end",script)
        self.assertNotIn("gz topic -t /model/cdr01/cmd_vel",script)

    def test_parser_rejects_fake_empty_stream_and_extracts_metrics(self):
        messages = (gazebo_message(5,0,0,0,1)+
                    gazebo_message(6,.2,0,0,1)+
                    gazebo_message(7,.5,.1,.38268343,.92387953))
        frames=exporter.decode_odometry(messages)
        self.assertEqual(len(frames),3)
        self.assertEqual([f["time_s"] for f in frames],[0,1,2])
        self.assertAlmostEqual(frames[-1]["x_m"],.5)
        self.assertAlmostEqual(frames[-1]["yaw_rad"],.785398,places=4)
        with self.assertRaises(ValueError):
            exporter.decode_odometry("header {}\n" * 4)
        with self.assertRaises(ValueError):
            exporter.decode_odometry(gazebo_message(1,float("nan"),0,0,1) +
                                     gazebo_message(2,1,0,0,1))

    def test_export_and_api_keep_recorded_source_and_not_garden_contact(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp)
            _,prov=generator.create_world(calibration(),base/"garden.sdf")
            raw=base/"odom.txt"
            raw.write_text(gazebo_message(5,0,0,0,1)+gazebo_message(6,.2,0,0,1)+
                           gazebo_message(7,.5,.1,0,1))
            result=exporter.export(raw,base/"latest_run.json",prov)
            self.assertEqual(result["samples"],3)
            self.assertFalse(result["contact_mesh_validated"])
            self.assertAlmostEqual(result["odometry_displacement_m"],.5099,places=3)
            self.assertIn("stopped_at_end",result)
            self.assertGreater(result["final_2s_mean_odometry_speed_mps"],0.01)
            with patch.object(webserver,"GARDEN_REPLAY",base/"latest_run.json"):
                status,typ,data=webserver.response_for("/api/garden-gazebo-run")
                self.assertEqual(status,200)
                self.assertEqual(json.loads(data)["source"],"recorded_gazebo_harmonic_odometry")
            with patch.object(webserver,"GARDEN_REPLAY",base/"nonexistent"):
                self.assertEqual(webserver.response_for("/api/garden-gazebo-run")[0],404)
            (base/"latest_run.json").write_text(json.dumps({"schema":"fake","frames":[{},{}]}))
            with patch.object(webserver,"GARDEN_REPLAY",base/"latest_run.json"):
                self.assertEqual(webserver.response_for("/api/garden-gazebo-run")[0],422)


if __name__ == "__main__":
    unittest.main()
