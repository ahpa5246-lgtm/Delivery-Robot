"""Cross-scene reactive replanning and collision-swept motion regression."""
import unittest
from math import hypot

from cdr_sim.campus import Campus, ReplayOptions, replay
from cdr_sim.closed_loop import closed_loop_replay, point_segment_distance


class ClosedLoopTests(unittest.TestCase):
    def test_segment_distance_corner_cases(self):
        self.assertAlmostEqual(point_segment_distance((2, 1), (0, 0), (4, 0)), 1)
        self.assertAlmostEqual(point_segment_distance((9, 0), (0, 0), (4, 0)), 5)
        self.assertAlmostEqual(point_segment_distance((1, 1), (0, 0), (0, 0)), hypot(1, 1))

    def test_sensing_braking_replanning_and_safety_both_worlds(self):
        for name in ("campus", "warehouse"):
            with self.subTest(name=name):
                world = Campus(theme=name)
                result = closed_loop_replay(ReplayOptions(scenario="clear"), world)
                self.assertTrue(result["collision_checked"])
                self.assertTrue(result["synthetic_sensor"])
                self.assertTrue(result["obstacle"]["detected"])
                self.assertTrue(any(e["state"] == "OBSTACLE_DETECTED" for e in result["events"]))
                self.assertTrue(any(e["state"] == "REPLANNING" for e in result["events"]))
                self.assertGreaterEqual(result["replans"], 1)
                self.assertIn(result["status"], ("COMPLETED", "PAUSED_SAFE"))
                center = tuple(result["obstacle"]["center_m"])
                radius = result["obstacle"]["clearance_radius_m"]
                for a, b in zip(result["frames"], result["frames"][1:]):
                    p = (a["x_m"], a["y_m"])
                    q = (b["x_m"], b["y_m"])
                    self.assertTrue(world.segment_safe(p, q))
                    self.assertGreaterEqual(point_segment_distance(center, p, q), radius - 0.005)
                # The updated route is geometrically separated from the obstacle.
                for updated in result["routes"][1:]:
                    for a, b in zip(updated["points"], updated["points"][1:]):
                        self.assertGreaterEqual(point_segment_distance(center, a, b), radius - 0.005)

    def test_deterministic(self):
        args = ReplayOptions(seed=9)
        a = closed_loop_replay(args, Campus())
        b = closed_loop_replay(args, Campus())
        self.assertEqual(a, b)

    def test_legacy_closure_still_operates(self):
        run = replay(ReplayOptions(seed=0, scenario="construction"))
        self.assertTrue(run["collision_checked"])


if __name__ == "__main__":
    unittest.main()
