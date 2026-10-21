"""MCAP wire-level proof of distinct collision worlds and modeled obstacle topics."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from mcap.reader import make_reader
from mcap_ros1.decoder import DecoderFactory

from scripts.export_delivery_recording import export_recording


class ReactiveMCAPTests(unittest.TestCase):
    def test_both_worlds_have_decodable_obstacle_markers_and_replan_metrics(self):
        for world in ("campus", "warehouse"):
            with self.subTest(world=world):
                with TemporaryDirectory() as directory:
                    output = Path(directory) / f"{world}.mcap"
                    count = export_recording(output, seed=0, scenario="reactive_obstacle", world=world)
                    self.assertGreater(count, 15)
                    with output.open("rb") as fp:
                        messages = list(make_reader(fp).iter_messages())
                    topics = {ch.topic for _, ch, _ in messages}
                    self.assertIn("/cdr01/dynamic_obstacle", topics)
                    self.assertIn("/cdr01/planned_path", topics)
                    self.assertIn("/odom", topics)
                    self.assertIn("/cdr01/mission", topics)
                    rows = [json.loads(msg.data) for _, ch, msg in messages if ch.topic == "/cdr01/mission"]
                    self.assertEqual(len(rows), count)
                    self.assertTrue(all(r["world"] == world for r in rows))
                    self.assertTrue(all(r["live"] is False for r in rows))
                    self.assertTrue(all(r["source"] == f"{world}_synthetic_reactive_replay" for r in rows))
                    self.assertTrue(all(r["sensor_model"] == "idealized_2d_range_no_noise" for r in rows))
                    self.assertTrue(all(r["collision_checked"] for r in rows))
                    self.assertTrue(any(r["obstacle_detected"] for r in rows))
                    self.assertTrue(any(r["replans"] > 0 for r in rows))
                    self.assertGreater(min(r["minimum_clearance_m"] for r in rows), 0)
                    with output.open("rb") as fp:
                        data = list(make_reader(fp, decoder_factories=[DecoderFactory()]).iter_decoded_messages(
                            topics=["/cdr01/dynamic_obstacle", "/cdr01/planned_path", "/odom"]))
                    markers = [m for _, ch, _, m in data if ch.topic == "/cdr01/dynamic_obstacle"]
                    self.assertEqual(len(markers), count)
                    plans = [m for _, ch, _, m in data if ch.topic == "/cdr01/planned_path"]
                    self.assertEqual(len(plans), count)
                    self.assertTrue(all(p.header.frame_id == "odom" for p in plans))
                    first_plan = [(p.pose.position.x, p.pose.position.y) for p in plans[0].poses]
                    final_plan = [(p.pose.position.x, p.pose.position.y) for p in plans[-1].poses]
                    self.assertNotEqual(first_plan, final_plan,
                        "an obstacle-triggered A* replan must alter the published future path")
                    self.assertEqual(markers[0].header.frame_id, "odom")
                    self.assertEqual(markers[0].type, 2)  # SPHERE
                    self.assertGreater(markers[0].scale.x, 0)
                    self.assertEqual(len([1 for _, ch, _, _ in data if ch.topic == "/odom"]), count)

    def test_unsupported_world_does_not_create_file(self):
        with TemporaryDirectory() as directory:
            output = Path(directory) / "invalid.mcap"
            with self.assertRaises(ValueError):
                export_recording(output, world="fictional")
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
