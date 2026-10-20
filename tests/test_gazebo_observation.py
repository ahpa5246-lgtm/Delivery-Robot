"""Verify Gazebo odometry parsing and MCAP round-trip without claiming actual physics."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from mcap.reader import make_reader
from mcap_ros1.decoder import DecoderFactory
from scripts.export_gazebo_observation import parse_observations, export_observations


def sample(n, x):
    return f"""header {{
 stamp {{ sec: {n} nsec: 100000000 }}
}}
pose {{
 position {{ x: {x} y: 0.02 }}
 orientation {{ z: 0 w: 1 }}
}}
twist {{
 linear {{ x: 0.25 }}
 angular {{ z: 0 }}
}}
"""


class GazeboObservationTest(unittest.TestCase):
    def test_parser_order_and_duplicates(self):
        rows = parse_observations(sample(2,1)+sample(1,0)+sample(2,1.1))
        self.assertEqual([r["x"] for r in rows],[0,1.1])
        self.assertEqual(rows[0]["ns"],1_100_000_000)

    def test_export_roundtrip_and_provenance(self):
        with TemporaryDirectory() as directory:
            log=Path(directory)/"raw.txt"
            out=Path(directory)/"physical.mcap"
            log.write_text("".join(sample(i, min(5.72, i*0.3)) for i in range(50)))
            self.assertEqual(export_observations(log,out,"campus"),50)
            with out.open("rb") as f:
                reader=make_reader(f,decoder_factories=[DecoderFactory()])
                rows=list(reader.iter_decoded_messages(topics=["/odom"]))
            self.assertEqual(len(rows),50)
            self.assertAlmostEqual(rows[0][3].pose.pose.position.x,2.0)
            self.assertAlmostEqual(rows[-1][3].pose.pose.position.x,7.72,places=2)

    def test_rejects_still_or_unsupported(self):
        with TemporaryDirectory() as directory:
            log=Path(directory)/"raw.txt"
            out=Path(directory)/"data.mcap"
            log.write_text("".join(sample(i, 0) for i in range(45)))
            with self.assertRaises(ValueError):
                export_observations(log,out,"campus")
            with self.assertRaises(ValueError):
                export_observations(log,out,"fictional")


if __name__=="__main__":
    unittest.main()
