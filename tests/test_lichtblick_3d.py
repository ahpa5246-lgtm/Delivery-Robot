"""Binary ROS pose serialization checks without the optional MCAP dependency."""
import math
import struct
import unittest
from scripts.export_lichtblick_3d import pose, pose_stamped, path_message, ros_time, tf_message


class TestLichtblick3D(unittest.TestCase):
    def test_ros_time_normalizes_rounding(self):
        self.assertEqual(ros_time(1.9999999996), (2, 0))

    def test_pose_has_correct_position_and_quaternion(self):
        result = struct.unpack("<7d", pose({
            "time_s": 0, "x_m": 2.5, "y_m": -1, "yaw_rad": math.pi
        }))
        self.assertEqual(result[:5], (2.5, -1, 0, 0, 0))
        self.assertAlmostEqual(result[5], 1)
        self.assertAlmostEqual(result[6], 0, places=7)

    def test_pose_stamped_header(self):
        frame = {"time_s": 2.25, "x_m": 1, "y_m": 2, "yaw_rad": 0}
        binary = pose_stamped(frame, 7)
        self.assertEqual(struct.unpack("<III", binary[:12]), (7, 2, 250000000))
        self.assertEqual(struct.unpack("<I", binary[12:16])[0], 4)
        self.assertEqual(binary[16:20], b"odom")
        self.assertEqual(len(binary), 20 + 56)

    def test_tf_frame_and_transform(self):
        frame = {"time_s": 1.5, "x_m": 3.0, "y_m": -2.0, "yaw_rad": 0.0}
        binary = tf_message(frame, 4)
        self.assertEqual(struct.unpack("<I", binary[:4])[0], 1)
        self.assertEqual(struct.unpack("<III", binary[4:16]), (4, 1, 500000000))
        self.assertEqual(binary[20:24], b"odom")
        self.assertEqual(binary[28:37], b"base_link")
        self.assertEqual(struct.unpack("<7d", binary[37:93]), (3, -2, 0, 0, 0, 0, 1))

    def test_path_pose_count(self):
        frames = [
            {"time_s": 0, "x_m": 0, "y_m": 0, "yaw_rad": 0},
            {"time_s": 1, "x_m": 1, "y_m": 0, "yaw_rad": 0},
        ]
        binary = path_message(frames)
        self.assertEqual(struct.unpack("<I", binary[20:24])[0], 2)
        self.assertEqual(len(binary), 24 + 2 * 76)


if __name__ == "__main__":
    unittest.main()
