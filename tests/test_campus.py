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

    def test_construction_replan_destination_matrix(self):
        # A construction closure can remove the only campus corridor.
        # Safe stop on NO_ROUTE is an intended *correct* outcome, not a failure
        # to plan an impossible path.
        world = Campus()
        completed = 0
        blocked = 0
        for destination in ("library", "engineering", "student_center"):
            for seed in range(25):
                with self.subTest(destination=destination, seed=seed):
                    run = replay(ReplayOptions(destination=destination,
                                               scenario="construction", seed=seed))
                    self.assertIn("REPLANNING", [e["state"] for e in run["events"]])
                    if run["status"] == "COMPLETED":
                        completed += 1
                        self.assertGreaterEqual(run["replans"], 1)
                    else:
                        blocked += 1
                        self.assertEqual(run["status"], "PAUSED_SAFE")
                        self.assertEqual(run["reason"], "ROUTE_BLOCKED")
                        self.assertEqual(run["frames"][-1]["speed_mps"], 0)
                        closure = frozenset(tuple(p) for p in run["closure_cells"])
                        with self.assertRaises(NoRoute):
                            astar(world, tuple(run["final_pose_m"]),
                                  world.stops[destination], closure)
        self.assertGreater(completed, 0)
        self.assertGreater(blocked, 0)

    def test_return_corridor_loss_stops_safely(self):
        from unittest.mock import patch
        from cdr_sim.campus import astar as real_astar
        def force_return_block(campus, start, goal, closure=frozenset()):
            if closure and start == campus.stops["library"] and goal == campus.stops["depot"]:
                raise NoRoute("return corridor closed")
            return real_astar(campus, start, goal, closure)
        with patch("cdr_sim.campus.astar", side_effect=force_return_block):
            result = replay(ReplayOptions(seed=7, scenario="construction"))
        self.assertEqual(result["status"], "PAUSED_SAFE")
        self.assertEqual(result["reason"], "RETURN_ROUTE_BLOCKED")
        self.assertEqual(result["frames"][-1]["speed_mps"], 0)

    def test_telemetry_invariants(self):
        run = replay(ReplayOptions(seed=41, scenario="construction"))
        self.assertEqual(run["status"], "COMPLETED")
        stamps = [f["time_s"] for f in run["frames"]]
        self.assertEqual(stamps, sorted(stamps))
        self.assertGreater(len(stamps), 30)
        for f in run["frames"]:
            self.assertGreaterEqual(f["soc"], .20)
            self.assertLessEqual(f["speed_mps"], .65 + 1e-5)
        for a, b in zip(run["frames"], run["frames"][1:]):
            self.assertLessEqual(b["soc"], a["soc"] + 1e-6)
            self.assertLessEqual(hypot(b["x_m"]-a["x_m"],b["y_m"]-a["y_m"]),
                                 .65*(b["time_s"]-a["time_s"]) + .01)
        self.assertEqual([e["time_s"] for e in run["events"]],
                         sorted(e["time_s"] for e in run["events"]))

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
