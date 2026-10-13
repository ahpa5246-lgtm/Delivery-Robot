import json
import unittest

from scripts.serve_dashboard import response_for


class DashboardAPITests(unittest.TestCase):
    def test_map_and_run(self):
        code, _, raw = response_for("/api/map")
        self.assertEqual(code, 200)
        self.assertIn("buildings", json.loads(raw))
        code, _, raw = response_for("/api/run?destination=engineering&scenario=clear&seed=21")
        self.assertEqual(code, 200)
        data = json.loads(raw)
        self.assertEqual(data["status"], "COMPLETED")
        self.assertEqual(data["destination"], "engineering")

    def test_archived_gazebo_evidence_is_real_simulator_output(self):
        code, media_type, raw = response_for("/api/gazebo-evidence")
        self.assertEqual(code, 200)
        self.assertEqual(media_type, "application/json")
        evidence = json.loads(raw)
        self.assertEqual(
            evidence["evidence_type"],
            "ACTUAL_GAZEBO_HARMONIC_SIMULATION_TELEMETRY_NOT_HARDWARE")
        self.assertGreater(evidence["samples"], 100)
        self.assertGreater(evidence["displacement_reported_by_odometry_m"], 0)
        self.assertIn("github_actions_run_url", evidence)

    def test_denied_handover(self):
        code, _, raw = response_for("/api/run?handover=denied")
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(raw)["status"], "AWAITING_HANDOVER")

    def test_input_validation(self):
        for path in ("/api/run?scenario=unsafe", "/api/run?seed=banana",
                     "/api/run?seed=-10", "/api/run?destination=depot",
                     "/api/run?foo=bar", "/api/run?seed=1&seed=2",
                     "/api/run?handover=maybe"):
            with self.subTest(path=path):
                code, _, _ = response_for(path)
                self.assertEqual(code, 400)

    def test_file_path_traversal_is_blocked(self):
        for path in ("/../../README.md", "/.git/config", "/api/unknown"):
            self.assertEqual(response_for(path)[0], 404)

    def test_static_files(self):
        for path in ("/", "/app.js", "/style.css"):
            code, media_type, payload = response_for(path)
            self.assertEqual(code, 200)
            self.assertTrue(payload)
            self.assertIn("/", media_type)


if __name__ == "__main__":
    unittest.main()
