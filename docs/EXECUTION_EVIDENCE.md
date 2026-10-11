# First executable baseline — measured run 2026-10-11

**Scope:** Local Python numerical surrogate, *not* Gazebo, ROS 2, real-world measurements or calibrated real motor/sensor models.

The original repository contained planning docs only. The test harness now exercises planar differential-drive motion with limited acceleration, rolling/grade resistance, scripted pedestrian crossing, conservative stop prediction, noisy scalar obstacle proximity, dead-reckoned pose, modeled electrical energy, and scripted delivery state transitions.

## Executed results

Command: `python -m unittest discover -s tests -v` — **22 tests passed**.

Command: `python scripts/run_benchmark.py --count 100 --output experiments/planar_baseline` — **100 seed-controlled nominal runs executed**.

| Metric | Observed in executed surrogate |
| --- | ---: |
| Completed / attempted | 100 / 100 |
| Collision contacts recorded | 0 |
| Mean simulated duration | 40.012 simulated seconds |
| 95th-percentile simulated duration | 44.3 simulated seconds |
| Mean dead-reckoning error (RMSE) | 0.03798 m |
| Mean calculated energy consumption | 0.32347 Wh |
| Maximum observed simulated speed | 0.8 m/s |
| Maximum calculated wheel torque | 0.89145 N·m |
| Wilson 95% confidence interval for observed completion proportion | [0.96301, 1.0] |

**Critical finding from the initial run:** the original control stopped too late and allowed 1109 collision-contact *samples*, yet still reported 100% delivery completions. We corrected this defect by adding future crossing-risk prediction and forcing explicit failed mission state on any contact. A subsequent 1000-seed stress run exposed two additional contacts in the 8-second crossing lookahead controller; we increased the conservative forecast horizon, reran the tests, and observed 1000/1000 completions and zero detected contacts in that scripted model. This is a *known-future* synthetic pedestrian model and is not deployable tracking software. This does not prove performance on untested scenarios.

**Model scope and caveats:**
- Scenarios: a straight 25 m corridor, controlled moving pedestrian crossing and off-path static obstacles. No Nav2, SLAM, 3-D terrain, realistic pedestrian behavior, real LiDAR rays, true wheel/caster contact or verified force dynamics.
- “Wheel torque” and “energy” are output of *simplified equations*, not measured amperage, power, or motor shaft torque.
- Pose estimate derives from synthetic wheel displacement with gaussian error; RMSE does not indicate real sensor accuracy.
- The synthetic pedestrian's scripted future trajectory is known to the safety controller — a major unrealistic advantage; an implementable perception/tracking module must replace this.
- The benchmark is not the 100-independent-Gazebo-task acceptance specified in VALIDATION_PLAN.md.
- Results depend on this source revision and Python standard-library PRNG, and are reproducible by the included command.

## Additional executed robustness checks

The corrected planar model completed **1000/1000 scripted-seed trials** with zero contact samples; mean simulated duration **39.9478 s**, p95 **44.0 s**, mean dead-reckoning RMSE **0.03746 m**, and mean estimated energy **0.32306 Wh**. The 270-run parameter sweep also completed with zero contacts. These are limited numerical simulation tests, not Gazebo tasks.

See [1000-run summary](../experiments/stress_1000/summary.json) and [parameter sweep note](PARAMETER_SWEEP_EVIDENCE.md).

## What remains not tested

Full Gazebo contact/ground-truth validation beyond the passed startup and 4.3989575 m commanded odometry trial, realistic Gazebo sensor plugins, full ROS 2 navigation, realistic collision geometry and caster dynamics, true sensor noise/occlusion, charging, secure API/dashboard, outdoor pedestrian hazards, cargo motor actuation, multi-robot fleet and physical safety. **Do not claim these have passed.**

## Available execution artifacts

`experiments/planar_baseline/summary.json` captures the current observed aggregated metrics and configuration. Running the benchmark produces `results.csv` (100 rows) and `trace_seed_0.json` (1 Hz trace) for independent review.

The GitHub Actions workflow `.github/workflows/planar-ci.yml` reruns the software tests. A separate Gazebo Harmonic 8.15 run yielded 397 physics-engine odometry samples, reporting 4.3989575 m displacement and 0.25 m/s maximum speed under a velocity command. This proves a basic simulated drive response, not contact calibration, Nav2 localization or real-world travel. See [Gazebo motion data](../experiments/gazebo_smoke/motion_summary.json). A completed workflow run is available at https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38099116310.

