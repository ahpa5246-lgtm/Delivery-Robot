import unittest
from cdr_sim.watchdog import CommandWatchdog


class WatchdogTests(unittest.TestCase):
    def test_stops_before_any_input(self):
        w=CommandWatchdog()
        self.assertEqual(w.output(0.0),(0,0))

    def test_fresh_command_passes(self):
        w=CommandWatchdog(timeout_s=0.5)
        self.assertEqual(w.receive(0.2,0.1,5),(0.2,0.1))
        self.assertEqual(w.output(5.4),(0.2,0.1))

    def test_stale_command_stops(self):
        w=CommandWatchdog(timeout_s=0.5)
        w.receive(0.5,0,5)
        self.assertEqual(w.output(5.51),(0,0))

    def test_limits_are_enforced(self):
        w=CommandWatchdog()
        self.assertEqual(w.receive(100,-100,0),(0.8,-0.8))

    def test_latched_stop(self):
        w=CommandWatchdog()
        w.receive(0.5,0,0)
        w.inhibit()
        self.assertEqual(w.output(0.1),(0,0))
        w.receive(0.3,0,0.2)
        self.assertEqual(w.output(0.2),(0,0))
        w.release()
        self.assertEqual(w.output(0.2),(0,0))
        w.receive(0.3,0,0.3)
        self.assertEqual(w.output(0.3),(0.3,0))

    def test_invalid_command_stops(self):
        w=CommandWatchdog()
        w.receive(0.6,0,0)
        with self.assertRaises(ValueError):
            w.receive(float('nan'),0,0.1)
        self.assertEqual(w.output(0.1),(0,0))

    def test_time_rollback_stops(self):
        w=CommandWatchdog()
        w.receive(0.2,0,10)
        self.assertEqual(w.output(9),(0,0))


if __name__ == '__main__':
    unittest.main()
