"""Offline campus planner / mission regression; no ROS/Gazebo runtime implied."""
import unittest
from math import hypot

from cdr_sim.campus import Campus, NoRoute, ReplayOptions, astar, path_length, replay


class CampusPlannerTests(unittest.TestCase):
    def setUp(self):
        self.world = Campus()

    def test_routes_between_all_stops(self):
        for name, point in self.world.stops.items():
            if name == "depot":
                continue
            with self.subTest(stop=name):
                route = astar(self.world, self.world.stops["depot"], point)
                self.assertGreater(path_length(route), 0)
                self.assertEqual(route[0], self.world.stops["depot"])
                self.assertEqual(route[-1], point)
                self.assertTrue(all(self.world.visible(a, b) for a, b in zip(route, route[1:])))

    def test_no_diagonal_corner_cutting(self):
        world = Campus(width=3, height=3, resolution=1, robot_radius=0.01,
                       buildings=((1, 0, 2, 1), (0, 1, 1, 2)),
                       stops={"depot": (.5,.5), "goal": (2.5,2.5)})
        with self.assertRaises(NoRoute):
            astar(world, (.5,.5), (2.5,2.5))

    def test_inflation_blocks_narrow_gap(self):
        world = Campus(width=5, height=4, resolution=.25, robot_radius=.5,
                       buildings=((2,0,3,1.75),(2,2.25,3,4)),
                       stops={"depot": (1,2), "goal": (4,2)})
        with self.assertRaises(NoRoute):
            astar(world, (1,2), (4,2))

    def test_goal_inside_building_rejected(self):
        with self.assertRaises(NoRoute):
            astar(self.world, (2,2), (10,3))

    def test_reproducibility(self):
        a = replay(ReplayOptions(seed=13, scenario="construction"))
        b = replay(ReplayOptions(seed=13, scenario="construction"))
        self.assertEqual(a, b)

    def test_handover_needs_authorization(self):
        a = replay(ReplayOptions(authorized_handover=False))
        self.assertEqual(a["status"], "AWAITING_HANDOVER")
        self.assertNotIn("DOCKED", [x["state"] for x in a["events"]])

    def test_battery_reservation_refuses_mission(self):
        a = replay(ReplayOptions(initial_soc=.201))
        self.assertEqual(a["status"], "REJECTED")
        self.assertEqual(a["reason"], "LOW_BATTERY_RESERVE")
        self.assertEqual(a["distance_m"], 0)

    def test_unsafe_scenarios_stop(self):
        for scenario in ("sensor_dropout", "estop"):
            with self.subTest(scenario=scenario):
                a = replay(ReplayOptions(scenario=scenario))
                self.assertEqual(a["status"], "PAUSED_SAFE")
                self.assertTrue(3.9 <= a["distance_m"] <= 5)
                self.assertEqual(a["frames"][-1]["speed_mps"], 0)
                self.assertNotIn("DOCKED", [x["state"] for x in a["events"]])

    def test_normal_delivery_returns_to_dock(self):
        for place in ("library", "engineering", "student_center"):
            with self.subTest(place=place):
                a = replay(ReplayOptions(destination=place))
                self.assertEqual(a["status"], "COMPLETED", a["reason"])
                self.assertEqual(a["events"][-1]["state"], "DOCKED")
                self.assertIn("DELIVERED", [x["state"] for x in a["events"]])
                self.assertLess(hypot(a["final_pose_m"][0]-2, a["final_pose_m"][1]-2), .11)
                self.assertGreater(a["energy_estimated_wh"], 0)

    def test_dynamic_replanning_across_seeds(self):
        for seed in range(12):
            with self.subTest(seed=seed):
                a = replay(ReplayOptions(seed=seed, scenario="construction"))
                self.assertEqual(a["status"], "COMPLETED", (seed, a["reason"]))
                self.assertGreaterEqual(a["replans"], 1)
                self.assertFalse(a["collision_detected_in_known_map"])

    def test_invalid_options(self):
        for args in ({"scenario": "unknown"}, {"speed_mps": -1},
                     {"initial_soc": 1.5}, {"seed": -1},
                     {"base_power_w": float("nan")}):
            with self.subTest(args=args), self.assertRaises(ValueError):
                ReplayOptions(**args)
        with self.assertRaises(ValueError):
            replay(ReplayOptions(destination="unknown"))

    def test_stress_nominal_50_seeds(self):
        for seed in range(50):
            a = replay(ReplayOptions(seed=seed, destination="engineering"))
            self.assertEqual(a["status"], "COMPLETED", (seed, a["reason"]))
            self.assertFalse(a["collision_detected_in_known_map"])


if __name__ == "__main__":
    unittest.main()
