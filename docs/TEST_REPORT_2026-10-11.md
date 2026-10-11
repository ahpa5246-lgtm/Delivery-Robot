# Verification report — 2026-10-11
**Repository:** `ahpa5246-lgtm/Delivery-Robot` · **Project:** CDR-01 campus delivery robot

## Test evidence status
| Level | Observed result | Evidence | Verdict |
| --- | --- | --- | --- |
| Python behavioral tests | 29 tests passed (22 previous behavioral/geometry + 7 watchdog fail-safe cases), incl. 1000-seed safety regression and blocked-route timeout | [Actions verification](https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38099576072) | **PASS for scoped Python model** |
| Python nominal benchmark | 100/100 completed; 0 contact samples; mean simulated 40.012 s; RMSE 0.03798 m; calculated energy 0.32347 Wh | [100-run summary](../experiments/planar_baseline/summary.json) | **PASS, scripted numerical model only** |
| Python robustness stress | 1000/1000 completed; 0 detected contacts; mean simulated 39.9478 s | [1000-run summary](../experiments/stress_1000/summary.json) | **PASS, scripted numerical model only** |
| Physics parameter sanity | 270 combinations/seeds, all completed, zero contacts; calculated energy 0.28438–0.55550 Wh | [Parameter-sweep report](PARAMETER_SWEEP_EVIDENCE.md) | **PASS, simplified equations only** |
| Gazebo geometry static checks | 6 physical links, 5 joints, 25 kg total loaded mass and valid XML | 4 SDF geometry tests | **PASS XML-level only** |
| Gazebo 8.15 headless physics startup | Loaded world, Gazebo DiffDrive plugin subscribed to commands, and real Gazebo odometry packets observed at standstill | [Successful GitHub Actions run](https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38099440173) and artifact | **PASS startup + at-rest odometry** |
| Gazebo commanded driving | 397 actual Gazebo odometry messages; reported 4.3989575 m displacement over simulation timestamps 17–36 s | [Passing dynamic run](https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38099667180), artifact `motion_summary.json` + raw odometry | **PASS Gazebo odometry response** |
| ROS 2 Jazzy ↔ Gazebo odometry bridge | Live `/robot1/odom` received actual Gazebo output as `nav_msgs/msg/Odometry` (sample: Gazebo timestamp 76.85s, x 14.3827m) | [Passing bridge run](https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38099966149), raw `ros_odometry.txt` | **PASS basic bridge** |
| ROS 2 velocity watchdog timeout and Gazebo stop | With source commands for 2 s then silence: 28 positive relay samples; 52 post-timeout zero-speed samples; **0 nonzero stale-speed samples**; 36 stable odometry samples with **0.0 m logged drift** | [Passing live watchdog+Gazebo workflow](https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38100301247) and `watchdog_acceptance.json` | **PASS scoped simulated control-path test** |
| Nav2 sensor-driven autonomous delivery | SLAM/AMCL/Nav2 not yet integrated or verified | [Issue #1](https://github.com/ahpa5246-lgtm/Delivery-Robot/issues/1) | **NOT IMPLEMENTED** |
| Hardware sensor/electrical measurements | No fabricated physical readings; no robot built | No physical device | **NOT TESTED** |
| Full delivery, charging and fleet | Components remain engineering requirements / GitHub issues | [Issues](https://github.com/ahpa5246-lgtm/Delivery-Robot/issues) | **NOT IMPLEMENTED / NOT TESTED** |

## New safety issue observed during Gazebo↔ROS test

The bridge reported x=14.3827m at simulation time 76.85s although the earlier motion logging phase ended near 36s and commanded driving was only broadcast for about 5s. This demonstrates the **Gazebo DiffDrive plugin retained its last nonzero command without a built-in command-timeout in this configuration**. We implemented a 20Hz ROS2 command watchdog with 0.5s freshness cutoff. A passing live test observed 52/52 zero commands after staleness and zero logged Gazebo displacement over the stable 36-sample observation window. Direct commands to the Gazebo topic can still bypass the watchdog; an actual robot needs a motor-driver watchdog and independent safety system. The observation does not establish a real-world acceleration/braking law.

## Critical failures found and corrected
- Initial numerical model reported successful deliveries even with 1109 pedestrian contact *samples* across 100 trials. Fixed safety anticipation and fail-on-contact event.
- Initial 8-second pedestrian prediction passed 100 seeds but found 2 failed contacts in 1000. A more conservative 30-second **oracle-assisted** horizon eliminated contacts in the revised 1000-seed suite. This is a simplified knowledge-of-script mechanism, **not a deployable pedestrian predictor**.
- First Gazebo Actions attempt failed at ROS environment setup under Bash `nounset`; corrected the shell invocation and verified subsequent startup and odometry.

## Known invalid conclusions
- A 100% completion ratio on a single scripted corridor does **not** imply a 100% real campus delivery success rate.
- `energy_estimated_wh` and `maximum_wheel_torque_estimated_nm` are mathematical model outputs, not motor/battery instrumentation readings.
- Python dead-reckoning RMSE is not proof of LiDAR, EKF, SLAM or AMCL accuracy.
- SDF geometry checks and at-rest Gazebo odometry do not establish real wheel-ground contact quality, accurate caster friction, or reliable movement.
- Velocity-based Gazebo DiffDrive is not a physically calibrated torque-controlled motor model.
- No real-world pedestrian safety claims or safety certification can be made.

## Next acceptance gates
1. Demonstrate **repeatable** Gazebo motion across multiple speeds/slopes/payloads; cross-check Gazebo odometry against independent simulator world pose and save both. One successful commanded-motion run of 4.3989575m has been observed.
2. Prove ROS2 Jazzy `ros_gz_bridge` message flow and then Nav2 waypoint navigation with *sensor-only* perception and separate truth evaluator.
3. Add realistic wheel/contact model, physics-tuned casters, controller effort and measured motor electrical model; test slopes, braking and payload.
4. Implement cargo latch interlocks, mission API and persistent event log; carry out 100 full delivery missions, fault injection and statistical reporting.
5. To claim **hardware measurements**, build or borrow a robot and instrument current/voltage/encoder/IMU/torque measurements with calibrated equipment.

**Conclusion:** A reproducible numerical prototype and a functioning Gazebo startup plus a single commanded-driving run exist. The complete autonomous delivery system is **not yet developed or validated**.
