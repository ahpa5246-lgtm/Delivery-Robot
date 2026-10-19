"""Read exported wire messages with an independent ROS decoder."""
import json
from pathlib import Path
import tempfile
import unittest
from mcap.reader import make_reader
from mcap_ros1.decoder import DecoderFactory
from scripts.export_delivery_recording import export_recording


class DeliveryRecordingTests(unittest.TestCase):
    def read_export(self, seed=7, scenario='clear'):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'delivery.mcap'
            count = export_recording(output, seed=seed, scenario=scenario)
            with output.open('rb') as stream:
                reader = make_reader(stream, decoder_factories=[DecoderFactory()])
                messages = list(reader.iter_messages(log_time_order=False))
            with output.open('rb') as stream:
                decoded = list(make_reader(stream, decoder_factories=[DecoderFactory()]).iter_decoded_messages(topics=['/tf', '/odom', '/cdr01/path', '/robot_description']))
        return count, messages, decoded

    def test_roundtrip_ros_frames_and_real_motion(self):
        count, messages, decoded = self.read_export()
        self.assertGreater(count, 10)
        times = [message.log_time for _, _, message in messages]
        self.assertEqual(times, sorted(times))
        by_topic = {}
        for _, channel, _, message in decoded:
            by_topic.setdefault(channel.topic, []).append(message)
        self.assertEqual(set(by_topic), {'/tf', '/odom', '/cdr01/path', '/robot_description'})
        self.assertIn('<robot name=', by_topic['/robot_description'][0].data)
        self.assertEqual(len(by_topic['/robot_description']), count)
        odom = by_topic['/odom']
        self.assertTrue(all(m.header.frame_id == 'odom' and m.child_frame_id == 'base_link' for m in odom))
        self.assertGreater(max(m.pose.pose.position.x for m in odom)-min(m.pose.pose.position.x for m in odom), 1)
        self.assertEqual(len(by_topic['/cdr01/path'][-1].poses), count)
        for tf, pose in zip(by_topic['/tf'], odom):
            self.assertEqual(tf.transforms[0].transform.translation.x, pose.pose.pose.position.x)
        self.assertEqual(len(odom), count)

    def test_provenance_fault_status_and_reproducibility(self):
        _, messages, _ = self.read_export(scenario='estop')
        payloads = [json.loads(m.data) for _, c, m in messages if c.topic == '/cdr01/mission']
        self.assertTrue(all(p['source'] == 'campus_kinematic_replay' and p['live'] is False for p in payloads))
        self.assertEqual(payloads[-1]['status'], 'PAUSED_SAFE')
        self.assertEqual(payloads[-1]['phase'], 'PAUSED_SAFE')
        self.assertEqual(payloads[-1]['reason'], 'ESTOP_LATCHED')
        self.assertTrue(all(isinstance(p['reason'], str) for p in payloads))
        schemas = [json.loads(s.data) for s, c, _ in messages if c.topic == '/cdr01/mission']
        self.assertTrue(all(s['properties']['reason']['type'] == 'string' for s in schemas))
        self.assertTrue(all(p['energy_model'] == 'estimated_not_measured' for p in payloads))
        _, repeated, _ = self.read_export(scenario='estop')
        self.assertEqual([m.data for _, _, m in messages], [m.data for _, _, m in repeated])

    def test_invalid_input_does_not_create_output(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'bad.mcap'
            for kwargs in ({'seed': -1}, {'scenario': 'fake'}, {'seed': True}):
                with self.assertRaises(ValueError):
                    export_recording(output, **kwargs)
                self.assertFalse(output.exists())
