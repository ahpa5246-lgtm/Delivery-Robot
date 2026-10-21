"""MCAP round trip for explicitly synthetic fixture Pose_V; runtime Gazebo separate."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from mcap.reader import make_reader
from mcap_ros1.decoder import DecoderFactory
from scripts.export_gazebo_observation import parse_observations, export_observations


def wheel(n, x):
    return f"""header {{
 stamp {{ sec: {n} nsec: 100 }}
}}
pose {{ position {{ x: {x} y: 0 }} orientation {{ w: 1 }} }}
twist {{ linear {{ x: 0.25 }} angular {{ z: 0 }} }}
"""


def body(n, x, world="campus"):
    return f"""header {{
 stamp {{ sec: {n} nsec: 100 }}
}}
pose {{
 id: 15
 name: "cdr01"
 position {{ x: {x:.5f} y: 2 z: 0.27 }}
 orientation {{ x: 0 y: 0 z: 0 w: 1 }}
}}
"""


class GazeboObservationTests(unittest.TestCase):
    def test_wheel_diagnostics_parser(self):
        r = parse_observations(wheel(2,1)+wheel(1,0)+wheel(2,1.1))
        self.assertEqual([x["x"] for x in r],[0,1.1])

    def test_exports_only_if_true_model_pose_passes_contact(self):
        with TemporaryDirectory() as directory:
            wheel_file=Path(directory)/"wheel.txt"
            pose_file=Path(directory)/"pose.txt"
            output=Path(directory)/"contact.mcap"
            touch_file=Path(directory)/"touch.txt"
            touch_file.write_text("data: true\n")
            wheel_file.write_text("".join(wheel(i,i*.65) for i in range(50)))
            pose_file.write_text("".join(body(i,min(7.72,2+i*.2)) for i in range(50)))
            self.assertEqual(export_observations(wheel_file,output,"campus",pose_file,touch_file),50)
            with output.open("rb") as f:
                decoded=list(make_reader(f,decoder_factories=[DecoderFactory()]).iter_decoded_messages(topics=["/odom"]))
            self.assertEqual(len(decoded),50)
            self.assertAlmostEqual(decoded[0][3].pose.pose.position.x,2.0,places=3)
            self.assertAlmostEqual(decoded[-1][3].pose.pose.position.x,7.72,places=3)
            # Wheel odom above reaches 31.85m; must never be exported as body position.

    def test_prevents_false_positive_and_missing_pose(self):
        with TemporaryDirectory() as directory:
            wheel_file=Path(directory)/"wheel.txt"
            pose_file=Path(directory)/"pose.txt"
            target=Path(directory)/"invalid.mcap"
            contact_file=Path(directory)/"contact.txt"
            contact_file.write_text("data: true\n")
            wheel_file.write_text("".join(wheel(i,i*.65) for i in range(50)))
            pose_file.write_text("".join(body(i,2+i*.65) for i in range(50)))
            with self.assertRaises(ValueError):
                export_observations(wheel_file,target,"campus",pose_file,contact_file)
            self.assertFalse(target.exists())
            valid_pose=Path(directory)/"valid_pose.txt"
            valid_pose.write_text("".join(body(i,min(7.72,2+i*.2)) for i in range(50)))
            contact_file.write_text("data: false\n")
            with self.assertRaises(ValueError):
                export_observations(wheel_file,target,"campus",valid_pose,contact_file)
            contact_file.write_text("data: true\n")
            with self.assertRaises(ValueError):
                export_observations(wheel_file,target,"campus")
            with self.assertRaises(ValueError):
                export_observations(wheel_file,target,"fictional",pose_file,contact_file)


if __name__ == "__main__":
    unittest.main()
