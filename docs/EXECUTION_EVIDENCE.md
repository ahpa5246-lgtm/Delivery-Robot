# First executable baseline — measured run 2026-10-11

**Scope:** Local Python numerical surrogate, *not* Gazebo, ROS 2, real-world measurements or calibrated real motor/sensor models.

The original repository contained planning docs only. The test harness now exercises planar differential-drive motion with limited acceleration, rolling/grade resistance, scripted pedestrian crossing, conservative stop prediction, noisy scalar obstacle proximity, dead-reckoned pose, modeled electrical energy, and scripted delivery state transitions.

## Executed results

Command: `python -m unittest discover -s tests -v` — **16 tests passed**.

Command: `python scripts/run_benchmark.py --count 100 --output experiments/planar_baseline` — **100 seed-controlled nominal runs executed**.

| Metric | Observed in executed surrogate |
| --- | ---: |
| Completed / attempted | 100 / 100 |
| Collision contacts recorded | 0 |
| Mean simulated duration | 40.0095 simulated seconds |
| 95th-percentile simulated duration | 44.3 simulated seconds |
| Mean dead-reckoning error (RMSE) | 0.03798 m |
| Mean calculated energy consumption | 0.32345 Wh |
| Maximum observed simulated speed | 0.8 m/s |
| Maximum calculated wheel torque | 0.89145 N·m |
| Wilson 95% confidence interval for observed completion proportion | [0.96301, 1.0] |

**Critical finding from the initial run:** the original control stopped too late and allowed 1109 collision-contact *samples*, yet still reported 100% delivery completions. We corrected this defect by adding future crossing-risk prediction and forcing explicit failed mission state on any contact. The final 100-seed suite passed with zero detected contact. This does not prove performance on untested scenarios.

**Model scope and caveats:**
- Scenarios: a straight 25 m corridor, controlled moving pedestrian crossing and off-path static obstacles. No Nav2, SLAM, 3-D terrain, realistic pedestrian behavior, real LiDAR rays, true wheel/caster contact or verified force dynamics.
- “Wheel torque” and “energy” are output of *simplified equations*, not measured amperage, power, or motor shaft torque.
- Pose estimate derives from synthetic wheel displacement with gaussian error; RMSE does not indicate real sensor accuracy.
- The synthetic pedestrian's scripted future trajectory is known to the safety controller — a major unrealistic advantage; an implementable perception/tracking module must replace this.
- The benchmark is not the 100-independent-Gazebo-task acceptance specified in VALIDATION_PLAN.md.
- Results depend on this source revision and Python standard-library PRNG, and are reproducible by the included command.

## What remains not tested

Gazebo physics and sensor plugins, full ROS 2 navigation, realistic collision geometry and caster dynamics, true sensor noise/occlusion, charging, secure API/dashboard, outdoor pedestrian hazards, cargo motor actuation, multi-robot fleet and physical safety. **Do not claim these have passed.**

## Available execution artifacts

`experiments/planar_baseline/summary.json` captures the current observed aggregated metrics and configuration. Running the benchmark produces `results.csv` (100 rows) and `trace_seed_0.json` (1 Hz trace) for independent review.

The GitHub Actions workflow `.github/workflows/planar-ci.yml` reruns the software tests. A completed workflow run is available at https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38099116310.

