# V5 — Five-unit simulated fleet, geometric sensors and visual direction

This is an **offline research demonstrator**, not a deployed fleet system.
The original CDR-01 Gazebo evidence remains archived and separate.

## What now actually executes

- A Python fleet engine (`cdr_sim/fleet.py`) creates five independently
  simulated missions from five distinct, occupancy-certified staging locations
  against the shared V4 collision world.
- Each robot has its own pose, heading, planned path, battery estimate, modeled
  distance, mission destination and status.
- The scheduler checks relative swept-disc separation throughout each
  1-second time interval. Unsafe attempted moves **yield**; the simulator
  never forces a move through another simulated robot just to complete a task.
  A job may remain waiting until the bounded run ends. This is not a Nav2
  multi-agent planner, deadlock-free traffic reservation, or validated control
  policy.
- An **idealized 16-ray planar scan** against the world building and fixture
  AABBs provides geometric clearance information (maximum 8 m). Directional
  proximity values, derived acceleration, yaw rate, and estimated wheel
  revolutions are computed from the simulated poses. Camera, GPS, and physical
  inertial streams remain **NOT CONNECTED**.
- `/api/fleet?world=campus|warehouse&seed=7` returns five trace datasets,
  per-robot paths, ray scans, a provenance statement and separation audit.
  Query parameters are bounded and validated.
- The scene displays five CAD-based instances of the same CDR chassis,
  distributed over the world, with five independent model-planned routes.
  The fleet has its **own playback timeline**, pause/restart and speed control.
  This runs independently of the legacy single-robot replay experiment.

## Design work

The UI was changed to a restrained dark slate / stone / warm-ivory palette;
unnecessary fluorescent effects were removed. The new fleet console lives
beneath the interactive 3D campus and contains five selectable units, mission
queue, model dispatch outcomes and a ray-scan scope. The scene now applies
better anti-aliased sunlight and shadow filtering, more realistic concrete
surface micrograin and chamfered roof geometry. Most hard-surface mesh details
continue to use attributed open-source CAD from
`dashboard/assets/SOURCES.md`. No additional proprietary models are used.

The 3D campus model is still a scale-constrained interpretation of a small
32 × 20 m virtual map, not a surveyed or photogrammetric real campus.

## Honest sensor/instrumentation boundaries

| Instrument | V5 provenance |
|---|---|
| 16 directional LiDAR-like ranges | ideal geometry ray/AABB intersections |
| Front, back, left, right proximity | sampled from those same ideal rays |
| Position / heading | scripted collision-checked XY state |
| Yaw rate / linear acceleration | finite difference of scripted heading and speed |
| Wheel rotations | distance / assumed 0.17 m wheel circumference |
| Battery SOC | existing parametric energy model |
| RGB-D / GPS / motor current / real IMU | NOT CONNECTED |
| Gazebo odometry | separately archived historical test |

**Do not present generated fleet metrics as hardware measurements or
three-dimensional contact/physics results.** A true full-stack fleet must
integrate ROS2/Nav2, sensor plugins, time-synchronized /tf and /odom, fleet
traffic reservations or robust reciprocal avoidance, and independent Gazebo
ground truth plus failure-injection tests.

## Quality gates

```bash
python -m unittest discover -s tests -v
python scripts/serve_dashboard.py
# open http://127.0.0.1:8765
```

GitHub Actions runs the full Python suite, deterministic stress trial,
and real Chromium smoke for desktop/tablet/mobile. Fleet checks verify
five distinct docks, each range scan channel, per-robot state, independent
world switch and actual five 3D robot groups.
