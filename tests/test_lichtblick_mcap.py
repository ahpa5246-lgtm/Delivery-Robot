"""Contract tests for MCAP bridge; no optional MCAP dependency required for validation."""
import unittest
from scripts.export_lichtblick_mcap import validate_recording


def sample():
    return {
        "schema": "cdr-garden-gazebo-replay-v1",
        "source": "recorded_gazebo_harmonic_odometry",
        "physics_world": "flat_contact_proxy_not_real_garden_terrain",
        "contact_mesh_validated": False,
        "samples": 2,
        "frames": [
            {"time_s": 0.0, "x_m": 0.0, "y_m": 0.0, "yaw_rad": 0.0},
            {"time_s": 1.0, "x_m": 0.5, "y_m": 0.0, "yaw_rad": 0.1},
        ],
    }


class TestLichtblickBridge(unittest.TestCase):
    def test_valid_recording(self):
        self.assertEqual(len(validate_recording(sample())), 2)

    def test_reject_fake_source(self):
        data = sample()
        data["source"] = "synthetic"
        with self.assertRaises(ValueError):
            validate_recording(data)

    def test_reject_unvalidated_provenance(self):
        data = sample()
        data["contact_mesh_validated"] = True
        with self.assertRaises(ValueError):
            validate_recording(data)

    def test_reject_nonmonotonic_time(self):
        data = sample()
        data["frames"][1]["time_s"] = 0
        with self.assertRaises(ValueError):
            validate_recording(data)

    def test_reject_nan(self):
        data = sample()
        data["frames"][1]["x_m"] = float("nan")
        with self.assertRaises(ValueError):
            validate_recording(data)

    def test_reject_sample_mismatch(self):
        data = sample()
        data["samples"] = 4
        with self.assertRaises(ValueError):
            validate_recording(data)


if __name__ == "__main__":
    unittest.main()
