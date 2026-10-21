"""Synthetic fixture tests for parser/checker, not actual Gazebo evidence."""
import unittest
from scripts.check_gazebo_collision import parse_ground_truth, evaluate_contact, wheel_odometry_displacement, physical_contact_event_seen
from scripts.gazebo_contact_trigger import reached_contact


def packet(i, x, *, y=2.0, name="cdr01"):
    return f"""header {{
 stamp {{ sec: {i} nsec: 100 }}
}}
pose {{
 id: 30
 name: "{name}"
 position {{ x: {x:.6f} y: {y:.6f} z: 0.27 }}
 orientation {{ x: 0 y: 0 z: 0 w: 1 }}
}}
pose {{
 name: "building_0"
 position {{ x: 10 y: 2 z: 1 }}
}}
"""


class ContactTests(unittest.TestCase):
    def test_pose_extraction_filters_obstacles_and_deduplicates(self):
        obs = parse_ground_truth(packet(2,2.5) + packet(1,2.0)
                                 + packet(2,2.6) + packet(3,99,name="building_0"))
        self.assertEqual([row["x"] for row in obs],[2.0,2.6])
        self.assertEqual(obs[0]["ns"],1_000_000_100)
        self.assertEqual(parse_ground_truth(packet(1,3,name="chassis")), [])

    def test_actual_contact_passes_but_odometry_does_not(self):
        # 40 seconds of actual body movement, then 10 seconds of stall.
        data = [packet(i, min(7.72, 2+i*.20)) for i in range(50)]
        pose = parse_ground_truth("".join(data))
        self.assertTrue(evaluate_contact(pose,"campus")["passed_wall_collision_gate"])
        self.assertTrue(evaluate_contact(
            parse_ground_truth("".join(packet(i,2+i*.65) for i in range(50))),
            "campus")["passed_wall_collision_gate"] is False)

    def test_live_contact_trigger_uses_actual_body_not_wheel_odom(self):
        approaching=parse_ground_truth(packet(1,7.63))
        touching=parse_ground_truth(packet(2,7.69))
        escaped=parse_ground_truth(packet(3,9.0))
        self.assertFalse(reached_contact(approaching,"campus"))
        self.assertTrue(reached_contact(touching,"campus"))
        self.assertFalse(reached_contact(escaped,"campus"))
        warehouse_pose=parse_ground_truth(packet(2,31.40))
        self.assertTrue(reached_contact(warehouse_pose,"warehouse"))

    def test_collision_requires_wheel_body_separation_not_only_stop(self):
        def raw(n, distance):
            return f'''header {{
  stamp {{ sec: {n} nsec: 0 }}
}}
pose {{ position {{ x: {distance} y: 0 }} }}
'''
        wheel = ''.join(raw(i, min(9, i*.3)) for i in range(45))
        self.assertAlmostEqual(wheel_odometry_displacement(wheel),9.0)
        self.assertIsNone(wheel_odometry_displacement(""))
        # An ideal zero-slip preplanned stop cannot establish wall contact.
        self.assertLess(0, wheel_odometry_displacement(wheel)-5.685)

    def test_requires_real_contact_boolean(self):
        self.assertTrue(physical_contact_event_seen("data: true\\n".replace("\\n","\n")))
        self.assertFalse(physical_contact_event_seen("data: false\n"))
        self.assertFalse(physical_contact_event_seen(""))

    def test_warehouse_wall_contact_and_fail_closed(self):
        good = parse_ground_truth("".join(
            packet(i,min(31.4,26+i*.2)) for i in range(50)))
        self.assertTrue(evaluate_contact(good,"warehouse")["passed_wall_collision_gate"])
        self.assertFalse(evaluate_contact([], "warehouse")["passed_wall_collision_gate"])
        bad_lateral = parse_ground_truth("".join(
            packet(i,min(31.4,26+i*.2),y=5) for i in range(50)))
        self.assertFalse(evaluate_contact(bad_lateral,"warehouse")["passed_wall_collision_gate"])
        with self.assertRaises(ValueError):
            evaluate_contact(good,"unmapped")


if __name__ == "__main__":
    unittest.main()
