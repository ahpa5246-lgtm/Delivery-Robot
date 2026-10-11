import unittest
from cdr_sim import Config, Robot, Mission, run_mission
from cdr_sim.core import obstacle_range

class EngineeringTests(unittest.TestCase):
    def test_nominal_mission(self):
        r=run_mission(1,obstacle=False)
        self.assertEqual(r['status'],'COMPLETED',r)
        self.assertTrue(r['final_true_x_m']>=24.8)
        self.assertLessEqual(r['maximum_speed_mps'],0.80001)
        self.assertTrue(r['final_soc_estimated']>0.2)
        self.assertEqual(r['collision_samples'],0)
    def test_nominal_100_seed_safety(self):
        reports=[run_mission(i) for i in range(100)]
        self.assertEqual(sum(x['collision_samples'] for x in reports),0)
        self.assertTrue(all(x['status']=='COMPLETED' for x in reports))
    def test_nominal_incline_five_deg(self):
        r=run_mission(17,cfg=Config(grade_deg=5),obstacle=False)
        self.assertEqual(r['status'],'COMPLETED')
        self.assertLessEqual(r['maximum_wheel_torque_estimated_nm'],5.0)
    def test_blocked_route_fails_safe(self):
        r=run_mission(3,blocked_route=True)
        self.assertEqual(r['status'],'FAILED')
        self.assertEqual(r['failure_reason'],'SIMULATION_TIMEOUT')
        self.assertEqual(r['collision_samples'],0)
    def test_seed_reproducibility(self):
        self.assertEqual(run_mission(9),run_mission(9))
    def test_payload_limit(self):
        with self.assertRaises(ValueError): Config(payload_kg=6)
    def test_grade_limit(self):
        with self.assertRaises(ValueError): Config(grade_deg=10)
    def test_handover_requires_authorization(self):
        m=Mission('abc'); m.transition('ARRIVED',1)
        with self.assertRaises(PermissionError):m.handover(1,False)
        self.assertNotEqual(m.state,'COMPLETED')
    def test_safe_lock_interlock(self):
        b=Robot(Config(),3)
        m=Mission('p'); m.compartment_locked=False
        v,w,unsafe=b.command(0.8,0,100,m)
        self.assertTrue(unsafe)
        self.assertEqual((v,w),(0.0,0.0))
    def test_emergency_stop(self):
        b=Robot(Config(),1); b.latched_stop=True
        self.assertEqual(b.command(0.8,0,100)[0],0.0)
    def test_stale_sensor(self):
        b=Robot(Config(),1); b.t=1; b.last_sensor_t=0
        self.assertTrue(b.command(0.5,0,100)[2])
    def test_obstacle_stop(self):
        b=Robot(Config(),1)
        self.assertTrue(b.command(0.5,0,0.7)[2])
    def test_fault_mission(self):
        r=run_mission(9,inject_sensor_fault=True,obstacle=False)
        self.assertEqual(r['status'],'PAUSED_SAFE')
        self.assertEqual(r['failure_reason'],'SENSOR_STALE_SAFE_STOP')
    def test_independent_odom_error(self):
        r=run_mission(13,obstacle=False)
        self.assertGreater(r['position_rmse_m'],0)
    def test_wheel_torque_limit(self):
        r=run_mission(2,obstacle=False)
        self.assertLessEqual(r['maximum_wheel_torque_estimated_nm'],5.001)
    def test_battery_uses_energy(self):
        r=run_mission(2,obstacle=False)
        self.assertGreater(r['energy_estimated_wh'],0)
        self.assertLess(r['final_soc_estimated'],0.85)
    def test_proximity(self):
        self.assertAlmostEqual(obstacle_range(0,0,[(3,0,0.5)]),2.5)
if __name__=='__main__': unittest.main()
