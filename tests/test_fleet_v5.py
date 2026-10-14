"""Five physically separated simulated robots and provenance-safe sensor values."""
import unittest
from math import hypot
from cdr_sim.campus import Campus
from cdr_sim.fleet import fleet_replay, _segment_separation, BEAMS, RANGE_MAX_M
from scripts.serve_dashboard import response_for
import json


class FleetModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.campus = fleet_replay(Campus(), 7)

    def test_five_distinct_robots_with_valid_frames(self):
        data=self.campus
        self.assertEqual(data["robot_count"],5)
        self.assertTrue(data["separation_checked"])
        self.assertEqual(len({a["id"] for a in data["robots"]}),5)
        self.assertEqual(len({tuple(a["pad"]) for a in data["robots"]}),5)
        self.assertIn("OFFLINE",data["provenance"])
        for agent in data["robots"]:
            with self.subTest(robot=agent["id"]):
                self.assertEqual(len(agent["frames"]),data["duration_sim_s"]+1)
                self.assertGreater(len(agent["frames"]),20)
                self.assertEqual(len(agent["frames"][0]["range_scan_m"]),BEAMS)
                self.assertEqual(agent["frames"][1]["range_scan_m"],[])
                for v in agent["frames"]:
                    self.assertGreaterEqual(v["battery_soc_estimated"],0)
                    self.assertLessEqual(v["battery_soc_estimated"],1)
                    self.assertGreaterEqual(v["nearest_static_clearance_m"],0)
                    self.assertGreaterEqual(v["speed_mps"],0)

    def test_inter_robot_continuous_proximity_is_safe(self):
        agents=self.campus["robots"]
        min_sep=self.campus["collision_separation_m"]
        for t in range(1,len(agents[0]["frames"])):
            for i in range(5):
                for j in range(i+1,5):
                    a=agents[i]["frames"];b=agents[j]["frames"]
                    d=_segment_separation(
                      (a[t-1]["x_m"],a[t-1]["y_m"]),(a[t]["x_m"],a[t]["y_m"]),
                      (b[t-1]["x_m"],b[t-1]["y_m"]),(b[t]["x_m"],b[t]["y_m"]))
                    self.assertGreaterEqual(d,min_sep-.005)

    def test_geometric_sensor_limits(self):
        for agent in self.campus["robots"]:
            samples=[f for f in agent["frames"] if f["range_scan_m"]]
            self.assertTrue(samples)
            for f in samples:
                self.assertEqual(len(f["range_scan_m"]),BEAMS)
                self.assertTrue(all(0<=d<=RANGE_MAX_M for d in f["range_scan_m"]))
        self.assertEqual(self.campus["sensor_model"]["rgbd"],"NOT CONNECTED")

    def test_strict_api(self):
        code,content_type,body=response_for("/api/fleet?world=campus&seed=7")
        self.assertEqual(code,200)
        self.assertIn("json",content_type)
        self.assertEqual(json.loads(body)["robot_count"],5)
        for bad in ("/api/fleet?world=bogus",
                    "/api/fleet?seed=-1",
                    "/api/fleet?world=campus&world=warehouse",
                    "/api/fleet?arbitrary=1"):
            with self.subTest(path=bad):
                self.assertEqual(response_for(bad)[0],400)

    def test_warehouse_fleet(self):
        data=fleet_replay(Campus(theme="warehouse"),seed=11)
        self.assertEqual(data["world"],"warehouse")
        self.assertEqual(len(data["robots"]),5)
        self.assertTrue(data["separation_checked"])


if __name__=="__main__":
    unittest.main()
