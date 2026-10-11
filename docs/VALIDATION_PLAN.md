# Simulation Verification and Validation Plan (VVP)
**Status:** Proposed protocol v0.1. Zero experiments have been executed.

## 1. Evidence standard
A high-quality simulation generates **simulator-derived measurements**, not physical test-bench readings. Every published result must identify itself as SIMULATED, ANALYTICAL ESTIMATE or MEASURED HARDWARE (last category unavailable at present).

The simulator produces ground-truth pose/velocity, contact conditions, joint states, and configured simulated sensors. True battery energy/thermal performance, torque delivery and travel range **cannot be asserted** unless electrical, motor and drivetrain models have been implemented and calibrated against physical data.

**Anti-leakage rule:** evaluation ground truth goes only to logger/evaluator. Navigation, mission and safety use estimates and sensor measurements (unless an explicit diagnostic test is clearly marked non-scored).

## 2. Nominal benchmark environment
- 1 campus paved walkway world with >= 3 handover stations, >= 1 depot, >= 1 dock, tight turns, an incline and designated pedestrian flow.
- Label hard geometry, collision objects, slopes, friction values and excluded curb/stair areas.
- One robot; nominal path segments 50–250 m *as simulation environment permits*, not guaranteed route distances.
- Seed dynamic pedestrian agents and obstacles. The first test environment is synthetic, not a scanned campus.
- Frozen evaluation map; recorded scenario parameters. Never change map/physics between compared methods without documenting it.

## 3. Measurements and metrics
| Metric | Definition | Units / notes |
| --- | --- | --- |
| Delivery success | count(COMPLETED with secure pickup + verified handover) / count(admitted test missions) | %, never count mere arrival |
| Position RMSE | sqrt(mean((x_est−x_true)^2 + (y_est−y_true)^2)) after known frame transform and timestamp pairing | metres |
| Yaw MAE | mean(abs(wrap_to_pi(yaw_est−yaw_true))) | rad |
| Mission time | simulated time at completion minus simulated time at acceptance | s |
| Route overhead | executed path distance / valid planned path distance | unitless, omit on invalid plan |
| Collision count | simulated robot–obstacle/person contact events excluding normal ground and wheel contact | events and severity |
| Minimum separation | minimum planar separation to pedestrians/obstacles according to truth geometry | metres |
| Time-to-safe-stop | simulation timestamp at safe command/zero joint velocity minus fault injection time | seconds; report both |
| Energy used | integrated electrical power over simulated time | Wh, only after electrical model exists |
| SoC estimation error | estimated SoC minus electrical model reference | percentage points; identify reference fidelity |
| Dropped data | number of expected-but-missing sensor samples / expected samples | %, sample periods accounted |
| Sim real-time factor | delta simulated seconds / delta wall-clock seconds | throughput, not quality |
| Compute cost | wall-clock duration, container vCPU/RAM, and storage per run | capacity planning |

For position alignment, use a **fixed known** map-to-world transformation from the scenario manifest, not an after-the-fact best-fit trajectory alignment that artificially hides mapping error.

## 4. Experiment matrix
| ID | Test and repetitions | Pass/fail criterion (proposed) |
| --- | --- | --- |
| V-01 | URDF, inertials, joints and stable idle pose (3 configs) | no missing frames, physically stable on flat |
| V-02 | 10 straight, turn and braking trials with no-slip control case | command limits respected, kinematic discrepancy measured |
| V-03 | 10 sensor-rate and fault/noise injection trials | nominal topics and timestamps correct; missing samples recorded |
| V-04 | 10 seeded localization trials on fixed map | RMSE <= 0.25 m nominal target |
| V-05 | 20 seeded Nav2 waypoint trials | valid goals reached, no truth leakage |
| V-06 | 20 seeded static/dynamic obstacle trials | no nominal pedestrian/object collision |
| V-07 | 20 mission-state flow tests | complete only on all required confirmations, cancel/fail verified |
| V-08 | 12 door, latch, load and OTP faults | movement inhibited for door open/lock fault; OTP expiry enforced |
| V-09 | 12 energy, low reserve, return and dock trials (when P1 ready) | reserve admission respected; charging contact verified |
| V-10 | >= 20 independent injected faults (5 categories) | explicit safe-stop evidence; proposed stop latency <= 0.5 s to be measured and reviewed |
| V-11 | 10 recording/replay and metadata checks | full manifest, reproducible topic files; no truth leakage |
| V-12 | 10 API authorization/idempotency/stale-telemetry tests | unauthorized actions blocked and duplicate requests idempotent |
| V-13 | param sweep: 3 payloads × 3 surfaces × 3 inclines × 3 seeds = 81 trials | all values preserved, failures reported; not an automatic nominal-pass set |
| V-14 | depth/GPS/weather trials (P2) | criteria set when features are scoped |
| V-15 | 2+ robot fleet integration (P2) | requires prior one-robot acceptance gate |

**Final acceptance nominal suite:** >= 100 independent seeded end-to-end runs on a frozen nominal scenario distribution, target >= 95% completed and 0 pedestrian/static collisions. Report 95% confidence interval for success proportion as well as mean/median/p95 duration. The other functional tests are additional evidence and should not be silently counted toward the 100 independent end-to-end missions.

**Fault safety:** the <=0.5 s target is a first safety requirement for software/simulation response, not an achieved timing or certified safety condition. Separately assess stopping distance at 0.8 m/s and hazards due to sensing uncertainty.

## 5. Scenario formats (future implementation)
```yaml
scenario_id: campus_nominal_001
seed: 42
simulator: gazebo_harmonic
robot: cdr01
world: campus_v1
environment:
  slope_deg: 0
  surface: dry_paved
  friction_profile: nominal
robot_params:
  payload_kg: 2.5
  battery_start_soc: 0.8
  lidar_dropout: 0.0
mission:
  pickup_station: depot_a
  dropoff_station: building_b
  recipient_ack_mode: simulated_otp
```
Above is a **format proposal only**. Runtime must validate keys, ranges and units before using it.

## 6. Run data contract
```text
experiments/runs/<run_id>/
  manifest.json       # git SHA, container digest, model configs, versions, seed, time step
  events.jsonl        # mission/safety/fault events, timestamps
  rosbag2/             # sensor, estimates, commands, status topics
  truth.parquet        # evaluator-only pose/velocity and collision summary
  metrics.json        # numeric computed metrics, units, confidence flags
  report.md           # environment, charts, pass/fail & limitations
```
Large bags/truth data remain in ignored artifacts or external storage, not in normal Git commit history. Only anonymized example fixtures can be committed deliberately.

**Required manifest metadata:** scenario ID; requested and actual ROS/Gazebo versions; source SHA; dependency/container digests; world hash; URDF/SDF hash; navigation params; controller params; random seeds (simulator + pedestrians + sensor noise); physics step; seed reproducibility restrictions; UTC run wall time, simulated duration, real-time factor, hardware/VM tier; sensor rates, payload and power model version.

## 7. Evaluation pipeline
1. Validate scenario schema and robot model.
2. Start Gazebo **headless** with fixed physics settings and simulation clock.
3. Apply independent seeds to pedestrian and sensor generators.
4. Start robot stack without access to evaluator truth feed.
5. Dispatch mission, inject faults as specified, record sensor/event/truth streams.
6. Stop after completion, timeout, explicit failure or safety condition; mark incomplete correctly.
7. Pair samples with simulation timestamps; compute metrics by immutable analysis version.
8. Produce summary, plots, confidence intervals and limitations; persist immutable run metadata.
9. Compare to reference baseline using the same paired scenarios; flag nondeterministic differences.

## 8. Test layers and cloud cost
- **PR CI:** schema validation, package lint, unit tests, synthetic mission state machine; no full camera rendering.
- **Smoke/headless:** one robot, few seconds physics, LiDAR/IMU, motion and stop; isolated resource-aware job.
- **Integration/manual/nightly:** Nav2 and dynamic obstacles, multi-seed repeatability.
- **Formal benchmark:** >=100 run frozen suite after all phases; run on provisioned compute; never silently exceed Codespaces quota.
- **Graphical evidence:** secondary visualization, not sole proof.

## 9. Threats to validity
- Non-realistic wheel-ground friction and casters.
- Lidar seeing idealized geometry, missing weather/reflectivity effects.
- Simplified pedestrian behavior and optimistic human handover events.
- RTF degradation leading to dropped samples or changed timing.
- Energy model lacking controller and drivetrain losses.
- Shared secrets or private recipient location leaked into runs.
- Overfitting planner to one map or one random seed.

Treat calibrated physical comparison as separate future **sim-to-real** validation, not satisfied by simulation alone.

**Upstream references:** [Gazebo sensors](https://gazebosim.org/docs/harmonic/sensors/), [Gazebo ROS integration](https://gazebosim.org/docs/harmonic/ros2_integration/), [Nav2 Collision Monitor](https://docs.nav2.org/jazzy/tutorials/general_tutorials/using_collision_monitor/using_collision_monitor/).
