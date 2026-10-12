# CDR-01 Campus Navigation Console — Scope and validation

The optional console extends the original CDR-01 work with a *standalone,
dependency-free kinematic replay*. It does **not** connect to Gazebo or drive a
physical robot. It is deliberately isolated from the ROS watchdog and from
unverified safety-critical autonomy.

## What runs now

- Inflated occupancy grid representing four campus buildings and four named
  stops, in local metres.
- Eight-connected A* planning, no diagonal corner-cutting, segment line-of-sight
  simplification, and an explicit no-route failure.
- A deterministic delivery transaction: validation, synthetic pickup, outbound
  navigation, authorized synthetic handover, return and simulated dock.
- A scripted mid-mission construction discovery that triggers replanning, plus
  testable emergency-stop and stale-sensor scenarios.
- Reserve-aware modeled battery admission, speed/acceleration-limited **kinematic**
  travel, timed 2D robot traces, event log and estimated energy usage.
- A responsive, local-only diagnostic console: live replay, pause, scrub,
  playback-speed adjustment, interactive stop selection and map route overlays.

The UI and API are *diagnostic only*: the API exposes no motor command or ROS
topic, accepts only GET requests, binds to loopback, and returns modeled data.

## Run (Python 3.11+, no third-party packages)

From the repository root:

```bash
python -m unittest discover -s tests -v
python scripts/run_campus_demo.py --seed 7 --destination library --scenario construction
python scripts/serve_dashboard.py --port 8765
```

Open **http://127.0.0.1:8765** in a browser. On Codespaces, the port may be
forwarded: treat the app as a demo only and never expose it as a publicly
reachable production control surface.

Supported scenarios: `clear`, `construction`, `sensor_dropout`, `estop`.
Destinations: `library`, `engineering`, `student_center`.
The `--output` argument on the CLI produces JSON with `map` and `run`.

The local HTTP contract:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/map` | Static map geometry + stop locations |
| `GET /api/run?seed=7&destination=library&scenario=construction` | Full deterministic simulated trace |
| `GET /api/run?handover=denied` | Authorization-failure replay |

Input validation rejects unknown fields, duplicate values, unsupported stops,
negative / excessive seeds and unsupported scenarios.

To generate the separate 3D candidate world aligned to the same map:\n\n```bash\npython scripts/generate_campus_gazebo.py\n# requires a Jazzy/Harmonic environment for these next two commands\ngz sdf -k simulation/campus_delivery.sdf\ngz sim -s -r simulation/campus_delivery.sdf\n```\n\n## Scientific interpretation

This is an *algorithmic test fixture*, not physically representative evidence.
A* sees buildings in a static *offline known map*; it does **not** perform SLAM.
Construction is a scripted event and its modeled cells become available to the
planner only when that event fires; it is **not** a real LiDAR detection pipeline.
Some simulated closures eliminate the only reachable corridor (notably near\nthe engineering destination); the supervisor then records `ROUTE_BLOCKED` and\nstops safely rather than claiming to find a nonexistent bypass.\nThe motion loop interpolates between planned waypoints with a scalar
acceleration cap; it does not model differential-drive heading, wheel slip,
torque, curb contact or pedestrian response. No digital twin localization
pipeline, accuracy ground truth, or ROS 2 actuator bridge was measured by this
layer. Battery consumption is analytical and uncalibrated.

Simulator tests validate code invariants in this bounded environment.
A completed scripted delivery is **not** proof of obstacle avoidance or human
safety on an actual campus. A software pause does not equal a physical E-stop.

### Required before any meaningful ROS 2 + Gazebo / real-robot claim

1. Real robot URDF/Xacro and SDF consistency, realistic inertial and wheel/caster
   contact properties, and headless physics validation.
2. LiDAR/IMU/encoder simulation and timestamp/QoS/TF integration to Nav2, with
   independent ground-truth observation.
3. Global/local costmaps, localization, controller and recovery tuning on a
   representative campus map using ROS 2 Jazzy and Gazebo Harmonic.
4. Safety arbitration: independent actuator timeout, hardware E-stop, lidar
   freshness, supervised crossings, lost-localization and braking-distance tests.
5. True compartment sensors, locked-hatch interlock, authenticated recipient
   handover and durable mission audit logs.
6. Weather, surface grade, obstacle behaviors, slip, battery data, cycle life,
   accessibility and real deployment authorization.

## Open-source reference decision

These are *references and integration candidates*, not code vendored into this
repository. Their compatibility and licenses must be checked for the exact
versions before copying implementation code.

| Reference | Decision | Why |
| --- | --- | --- |
| [Navigation2](https://github.com/ros-navigation/navigation2) | Required ROS navigation integration | Costmaps, planning, controllers and NavigateToPose / NavigateThroughPoses |
| [rlxai/rbot](https://github.com/rlxai/rbot) | Evaluate for Gazebo/ROS scaffolding | Jazzy-Harmonic AMR bring-up, sim sensors and nav workflows |
| [linorobot2](https://github.com/linorobot/linorobot2) | Evaluate for real drivetrain layer | Differential drive hardware/software split and localization |
| [ros_gz](https://github.com/gazebosim/ros_gz) | Required simulation integration | Gazebo-to-ROS message bridges |
| [open-rmf/rmf](https://github.com/open-rmf/rmf) | Deferred multi-robot research | Fleet and traffic coordination is unnecessary for one robot |
| [open-rmf/fleet_adapter_template](https://github.com/open-rmf/fleet_adapter_template) | Deferred | Fleet adapter pattern once single-robot action endpoint is stable |

ROS 2 Jazzy's Nav2 officially exposes
[FollowWaypoints, NavigateThroughPoses and NavigateToPose](https://api.nav2.org/jazzy/actions/navigation/).
Gazebo documents the
[ROS bridge](https://gazebosim.org/docs/harmonic/ros2_integration/).
Use their validated components for actual autonomy; do not promote this
minimal offline planner into a substitute for Nav2.

## CI acceptance criteria

- All legacy planar simulation and watchdog tests remain green.
- A* reachability, collision-inflated segment safety, diagonal corner exclusion,
  authorization, battery admission, deterministic replay, scenario safe stops,
  dynamic reroutes and 50-seed nominal stress run pass.
- Dashboard endpoint rejects malformed inputs and file-path traversal.
- JavaScript parser check via `node --check dashboard/app.js`.
- Console CLI emits an actual artifact and runs without external Python deps.
- ROS/Gazebo CI remains separate and its existing observations are not
  reclassified as verification of new features.
