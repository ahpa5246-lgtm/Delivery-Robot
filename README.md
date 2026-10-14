# Delivery-Robot — Campus Autonomous Delivery Robot (CDR-01)

> Status: **Early executable prototype** (2026-10-11). Python planar simulator and SDF generator exist; full ROS 2/Gazebo/navigation/physical validation is still pending.

This repository will host a simulation-first **autonomous ground delivery robot** for university campuses and controlled outdoor pedestrian walkways. The initial scope is **one robot**, with a clean interface for a future multi-robot fleet.

## Baseline decision

- **Operating environment:** paved, pedestrian-only campus paths; no road traffic, kerb climbing, stairs, heavy rain, or unknown rough terrain.
- **Robot:** custom CDR-01, differential drive, two powered wheels and two properly modelled passive casters.
- **Target payload:** 5 kg; **empty mass assumption:** 20 kg; **maximum design mass:** 25 kg.
- **Main software:** Ubuntu 24.04 + ROS 2 Jazzy + Gazebo Harmonic + ros2_control + Nav2 + SLAM Toolbox + robot_localization.
- **Development:** GitHub Codespaces / reproducible containers; headless physics first. Full graphical simulation only on an appropriately provisioned machine.
- **Primary open-source reference:** [rlxai/rbot](https://github.com/rlxai/rbot), not an unreviewed wholesale fork.
- **Secondary reference:** [linorobot2](https://github.com/linorobot/linorobot2), especially physical robot integration.
- **Later fleet extension:** Open-RMF only after one robot's behavior is measured and repeatable.

## Specification index

| Document | What it defines |
| --- | --- |
| [System requirements](docs/SYSTEM_REQUIREMENTS.md) | Operating design domain, requirements, acceptance thresholds and exclusions |
| [Robot & physics](docs/ROBOT_ENGINEERING.md) | Geometry, mass, wheel layout, actuator sizing, sensors, power and safety assumptions |
| [Software architecture](docs/SOFTWARE_ARCHITECTURE.md) | ROS 2 packages, interface contracts, state machines, data ownership and deployment |
| [Verification & validation](docs/VALIDATION_PLAN.md) | Experiments, metrics, ground-truth isolation, reports and reproducibility |
| [Open-source assessment](docs/OPEN_SOURCE_REVIEW.md) | Project comparison, chosen reusable components, license obligations and compatibility risks |
| [Implementation roadmap](docs/ROADMAP.md) | Ordered milestones with exit gates, risk register, and cloud budget strategy |

## Non-negotiable engineering principles

1. No fabricated experimental measurements. Targets and analytical estimates are **not** test results.
2. Evaluation ground truth is isolated from localization and navigation. The robot perceives only simulated sensors.
3. Simulated battery state or command velocity alone does **not** validate real-world range, current, torque, or safety.
4. Operationally unsafe conditions result in stopping, refusal of the mission or supervisor intervention.
5. A delivery is successful only after pickup, travel and handover have all been explicitly confirmed.
6. Every reported run carries version/configuration identifiers, simulation settings, seed and data files.
7. A release must pass defined exit gates before new features are added.

## Executed evidence (2026-10-11)

**29 Python behavioral/geometry/watchdog tests** and **100 seed-controlled planar delivery simulations** were executed locally: 100 deliveries complete, zero collision contacts, mean 40.012 simulated seconds, mean 0.03798 m dead-reckoning RMSE, and 0.32347 Wh calculated energy per run. A separate **270-run parameter sensitivity sweep** and a **1000-seed scripted-scenario stress test** completed without detected contacts on the same controlled corridor model.

**Do not conflate these with Gazebo or physical measurements:** the results are produced by a simple 2D Python surrogate with known scripted pedestrian motion; it does not perform Nav2, LiDAR raytracing, realistic contact mechanics, charging or a live delivery API. Energy and torque are simplified model outputs, **not measured hardware readings**.

- [Execution evidence and limitations](docs/EXECUTION_EVIDENCE.md)
- [Executed 100-run summary](experiments/planar_baseline/summary.json)
- [Executed 1000-run stress summary](experiments/stress_1000/summary.json)
- [270-run sensitivity evidence](docs/PARAMETER_SWEEP_EVIDENCE.md)
- [Planar GitHub Actions test run](https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38099288446)
- [Gazebo Harmonic at-rest odometry smoke run](https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38099440173)
- [Gazebo actual commanded movement: 4.3989575 m odometry displacement](https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38099667180)
- [Measured Gazebo motion summary](experiments/gazebo_smoke/motion_summary.json)
- [Verification pass/fail report](docs/TEST_REPORT_2026-10-11.md)
- [Gazebo Harmonic + live ROS 2 bridge + watchdog safe-stop passed](https://github.com/ahpa5246-lgtm/Delivery-Robot/actions/runs/38100301247): 28 active relay messages, 52/52 post-timeout zero commands, and 0m additional odometry travel in a 36-sample stationary window.
- [Gazebo headless reproducible test workflow](.github/workflows/gazebo-headless.yml)
- [Gazebo SDF world generator](scripts/generate_gazebo_world.py)

Run the tested software baseline with any Python 3.11+ installation:

```bash
python -m unittest discover -s tests -v
python scripts/run_benchmark.py --count 100 --output experiments/planar_baseline
python -m scripts.run_parameter_sweep
python scripts/generate_gazebo_world.py
```

**Next verification:** Nav2 / localization / LiDAR integration, independent ground-truth-versus-odometry benchmarking, motor torque / contact / charging models and complete delivery workflow. ROS 2 Jazzy/Gazebo startup, commanded odometry, bridged odometry and ROS watchdog timeout have already passed narrow real-simulator smoke/acceptance checks. No claims of real-world deployment or certified human safety have been established.

## Mission Intelligence v2 and authentic CAD assets

The local dashboard now places the **full-width 3D campus first**, with mission status, energy, speed, direction, historic Gazebo evidence, sensor connection indicators and an exportable CSV flight recorder **beneath the scene**. Its physical-looking objects include licensed source CAD/Collada (with a topology-reduced rbot chassis and Mecanum robot base, original wheel and camera parts, Clearpath building detail, textured warehouse props, and TurtleBot furniture), not only primitive box placeholders.

Run `python3 scripts/serve_dashboard.py` and open http://127.0.0.1:8765. See **[Command-center readings, provenance and test gates](docs/COMMAND_CENTER_V2.md)** and **[imported asset source licenses](dashboard/assets/SOURCES.md)**.

**Do not confuse the 3D replay with Nav2 or real-time Gazebo physics.** Motion, energy, SOC, and heading still derive from the deterministic Python mission simulator; historical Gazebo odometry is a separate measured experiment.

## V4 — shared collision world and verified route geometry

The university campus and logistics scene now use the same
[`world/campus_layout.json`](world/campus_layout.json) footprint catalog for
**Python A* routing, robot-inflated occupancy cells, Three.js collision overlays,
licensed CAD furniture placement, and generated Gazebo SDF collision boxes**.
Unlike earlier versions, the viewer no longer creates arbitrary solid objects
outside the navigation world's registered footprint list.

The browser includes a **Navigation integrity** panel below the 3D model:
path validity, nearest modeled clearance, fixture count, collision intersections,
blocked cells, optional collision proxies, occupancy grid, and robot safety radius.
The scene selector changes both the displayed world and the actual selected
offline planner model, rather than merely changing the scenery.

This is a deterministic two-dimensional geometry/replay model with imported
real 3D assets and generated Gazebo *static collision proxies*, **not** a proven
end-to-end Nav2 autonomous robot, hardware collision detector, or validated
three-dimensional dynamic contact model. See the
[V4 engineering design and limitations](docs/V4_SHARED_WORLD.md).

## V3 campus world and engineering instrumentation

The dashboard has a new visual-only campus scenery layer (paving detail, landscape planting, boundary fixtures, crosswalks, logistics items), **Day / Sunset / Night** lighting profiles, a street-level camera, and click-to-route station markers within its interactive WebGL scene. It retains the existing source-licensed CAD/Collada geometry and proven 2D fallback.

Below the 3D viewer, **Movement and mission integrity** adds eight actual frame-derived modeled quantities (position, acceleration, turn rate, power estimate, direct target distance, Wh/km, moving duty cycle and planned polyline length). A frame consistency check explicitly distinguishes internally consistent scripted data from real-world validation. These numbers are not LiDAR, IMU or motor telemetry.

See [technical measurements, limits and acceptance notes](docs/V3_VISUAL_AND_INSTRUMENTATION.md).

## Interactive 3D mission studio (source-guided upgrade)

The local dashboard now includes a **WebGL 3D campus scene** using a locally bundled MIT-licensed Three.js engine. It provides orbit, overhead and follow cameras, a robot model inspector, a 3D/2D view switch, outdoor campus and logistics scene variants, and nine selectable **visual robot designs**. The browser scene follows the existing deterministic **2D replay**, not ROS2/Gazebo physics. Simulated values remain clearly labeled separately from historical Gazebo odometry.

Nine third-party ROS/Gazebo SDF/Xacro reference files, their source attribution and licenses, and a ten-project integration catalog have been added under `integrations/`. Only Three.js executes in the new web viewer; the SDF and Xacro files are compatibility references **not silently deployed as functional robot stacks**. See [integration matrix and test gates](docs/OPEN_SOURCE_INTEGRATION.md).

Run with `python scripts/serve_dashboard.py`, open `http://127.0.0.1:8765` and select **3D WORLD**. Scroll to zoom and drag to rotate. Click **Follow** to see the moving robot; expand **OPEN-SOURCE ENGINEERING LIBRARY** for links and license information.

## Campus navigation and control-room demo (offline subsystem)

A campus-map path planner, mission replay and responsive local monitoring dashboard
are now implemented *in addition* to the earlier planar and Gazebo work. This
subsystem is **not yet ROS/Nav2-integrated and is not a physically validated
delivery robot**.

```bash
python -m unittest discover -s tests -v
python scripts/run_campus_demo.py --seed 7 --scenario construction
python scripts/serve_dashboard.py
python scripts/generate_campus_gazebo.py
# Visit http://127.0.0.1:8765
```

The console shows multi-stop A* route planning, a scripted construction
replan, simulated pickup/authorized handover/return to dock, battery reserve
screening, sensor-loss and emergency stop demonstrations, and replayable
timestamped telemetry. See [Campus navigation console scope and test gates](docs/CAMPUS_CONSOLE.md).
The API uses localhost only and **cannot command motors**.

## Primary technical references

- [Gazebo / ROS compatibility](https://gazebosim.org/docs/harmonic/ros_installation/)
- [Nav2 first-time robot setup for Gazebo](https://docs.nav2.org/jazzy/configuration_and_development/first_time_robot_setup_guide/gazebo/)
- [ros2_control integration with Gazebo](https://control.ros.org/jazzy/doc/gz_ros2_control/doc/index.html)
- [Gazebo / ROS 2 bridge](https://gazebosim.org/docs/harmonic/ros2_integration/)


## Real photographed 3D environment (Gaussian Splatting)

Select **REAL GARDEN · 3DGS** in the dashboard to explore a genuine captured
[Mip-NeRF 360 Garden](https://superspl.at/scene/bc0906cd) (transkatgirl;
CC BY 4.0). The remote scene is rendered interactively in the browser, without
changing any robotics planner, Gazebo model or claimed experiment results.
**Robot physics and telemetry are not registered to this real garden yet.**
See [precise integration scope and next steps](docs/GAUSSIAN_GARDEN.md).

### Garden-first presentation

The dashboard now opens **REAL GARDEN · 3DGS** as its default experience.
The captured garden is a real-world photographic scene rendered in the browser,
but is a **visual preview only**: robot trajectories and Gazebo physics remain
in independent synthetic environments. Use `/?view=campus` to start in the
original engineering simulator or `/?view=map` to start in the 2D map.
