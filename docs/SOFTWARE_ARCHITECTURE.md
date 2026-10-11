# CDR-01 Software Architecture & Interface Contracts
**Status:** Proposed design, no packages created. **Baseline:** Ubuntu 24.04 / ROS 2 Jazzy / Gazebo Harmonic.

## 1. Architectural boundaries
```text
[Campus User / Operator]
          |
  [Dashboard / HTTPS API] <---> [Persistent mission database + audit log]
          |
   [Mission Gateway] -- authenticated operations --> [Mission Supervisor / State Machine]
          |                                         |
          |                               [Payload + Power + Dock managers]
          |                                         |
          +----------------> [Nav2 Action Client] ----+----> [Nav2 Navigator]
                                                               |
                                                        [Planner / Controller]
                                                               |
                                                   [Safety Arbiter / Watchdog]
                                                               |
                                             [ros2_control / diff_drive_controller]
                                                               |
                                           [Gazebo physics: wheels + casters + terrain]
                                                               |
                           [Simulated sensors] -> [EKF / AMCL / SLAM] -> [Nav2 / safety]

[Gazebo ground-truth tap] ---> [Independent evaluator / bag recorder] ---> [Reports]
             ^ NEVER connect to autonomy/localization path
```

**Single writer policy:** only the safety arbiter commands the base motion controller. All teleop, Nav2 and docking sources flow through one priority/mode arbiter. Priority: hard modeled inhibit / supervisor stop > fault watchdog > permitted teleop recovery > docking > Nav2 mission. Preemption must zero commands first and be logged.

**Simulation truth policy:** Gazebo world pose is recorded by an isolated evaluator. No software-navigation node shall subscribe to true pose or direct simulator state. A namespace alone is not an access-control boundary; future physical security needs DDS security/network isolation.

## 2. Package ownership (planned paths)
| Package / directory | Ownership |
| --- | --- |
| `src/delivery_description` | Xacro/URDF links, inertials, sensors/frames, payload link |
| `src/delivery_simulation` | Gazebo world, physics, sensor plugins, bridge, experiment parameters |
| `src/delivery_control` | ros2_control controllers, motor model, command routing |
| `src/delivery_localization` | EKF/AMCL parameters, localization health |
| `src/delivery_navigation` | Nav2 maps, planners, controllers, behavior trees |
| `src/delivery_perception` | obstacle observations, potential depth-processing P1 |
| `src/delivery_safety` | stop/slow/inhibit, fault aggregation, freshness watchdog |
| `src/delivery_mission` | delivery mission state machine and navigation action client |
| `src/delivery_payload` | cargo states, lock/interlock, handover simulation |
| `src/delivery_power` | SoC and electrical load model, reservation / dock manager |
| `src/delivery_interfaces` | versioned ROS messages/actions/services |
| `src/delivery_bringup` | composable launch profiles: headless, nav, evaluation, visualization |
| `backend/` | authenticated HTTP API, durable events, data access, access control |
| `dashboard/` | map and mission UI; never direct unsupervised motion |
| `experiments/` | test manifests, benchmark runners, postprocessing |
| `config/` | robot defaults and environment overrides |
| `worlds/`, `maps/` | simulator worlds versus navigation maps kept separate |
| `third_party/` | explicitly versioned and licensed external code/assets only |

## 3. Core ROS 2 interfaces (contract targets)
These are **intended** interfaces, not currently available topics/services. Types shown below are planned; verify exact ROS IDL and QoS during implementation.

| Interface | Message / action | Owner and notes |
| --- | --- | --- |
| `/clock` | `rosgraph_msgs/msg/Clock` | simulator, use_sim_time throughout |
| `/tf`, `/tf_static` | `tf2_msgs/msg/TFMessage` | unique transforms; no duplicate `map->odom` |
| `/robot1/joint_states` | `sensor_msgs/msg/JointState` | joint state broadcaster |
| `/robot1/imu/data` | `sensor_msgs/msg/Imu` | simulated IMU |
| `/robot1/scan` | `sensor_msgs/msg/LaserScan` | LiDAR |
| `/robot1/wheel/odometry` | `nav_msgs/msg/Odometry` | wheel controller |
| `/robot1/odometry/filtered` | `nav_msgs/msg/Odometry` | EKF estimate |
| `/robot1/nav/navigate_to_pose` | `nav2_msgs/action/NavigateToPose` | mission client -> Nav2 (exact name via configuration) |
| `/robot1/control/{nav,dock,teleop}/cmd_vel` | `geometry_msgs/msg/Twist` | source commands (internal only) |
| `/robot1/control/cmd_vel_safe` | `geometry_msgs/msg/Twist` | sole controller input after safety arbitration |
| `/robot1/safety/status` | proposed `delivery_interfaces/msg/SafetyStatus` | latched faults, reason, freshness |
| `/robot1/power/state` | proposed `delivery_interfaces/msg/PowerState` | V/A/Wh/SoC, fidelity flag |
| `/robot1/payload/state` | proposed `delivery_interfaces/msg/PayloadState` | door, latch, occupancy feedback |
| `/robot1/mission/execute` | proposed `delivery_interfaces/action/ExecuteDelivery` | mission state coordinator |
| `/robot1/mission/events` | proposed `delivery_interfaces/msg/MissionEvent` | durable event gateway |
| `/evaluation/robot1/ground_truth` | evaluator-only stamped pose/velocity | never used by navigation |

Use one consistent robot namespace from day one. Do not expose DDS directly to public Internet. Bridge message types and directions only where explicitly supported in `ros_gz_bridge`.

## 4. Transform and localization contract
- Required TF tree: `map -> odom -> base_link`, plus `base_link -> laser_frame / imu_link / camera_link / payload_link` and physically modeled joints.
- Wheel encoder odom yields relative motion; EKF fuses wheel and IMU; AMCL localizes against saved map (or SLAM owns map while mapping).
- At most one source publishes `map -> odom` in a given mode; never run SLAM mapping and AMCL as simultaneous independent authorities.
- Nav2 footprint matches *collision envelope including protrusions*, not just wheel centers.
- Initial pose is an explicit input or a verified localization initialization, never secretly copied from ground truth during scored runs.

## 5. Mission state machine
```text
IDLE -> VALIDATING -> ASSIGNED -> TO_PICKUP -> AWAIT_LOAD
     -> SECURE_CARGO -> TO_DROPOFF -> AWAIT_AUTH
     -> UNLOCKED -> AWAIT_REMOVAL -> SECURE_EMPTY
     -> COMPLETED
```
Any eligible active state may lead to `PAUSED_SAFE`, `CANCELLED`, `FAILED` or `RECOVERY_REQUIRED`. If `LOST_LOCALIZATION`, `DOOR_OPEN`, `SENSOR_STALE`, `POWER_CRITICAL` or `OPERATOR_STOP` applies, command arbitration inhibits movement until explicitly cleared under a documented procedure.

**Rules:**
- No successful transition into `TO_DROPOFF` without observed payload present and locked.
- `COMPLETED` requires authorized unlock and positive payload-removal event; timeouts are failures/recovery, not success.
- State changes persist as append-only timestamped events including mission ID/robot ID and event version.
- Idempotency key prevents duplicate HTTP requests from creating duplicate trips; sequence numbers reject stale commands.
- Handover OTP must expire, be rate-limited and never logged in plaintext.

## 6. HTTP service (draft, not implemented)
`POST /api/v1/missions` with `pickup_station_id`, `dropoff_station_id`, `parcel_ref` (opaque), and `idempotency_key`; returns `mission_id` + state.
`GET /api/v1/missions/{mission_id}`; `POST /api/v1/missions/{id}/cancel`; `GET /api/v1/robots/robot1`; `GET /api/v1/events?mission_id=...`.
Privileged operator endpoints: clear a resolved fault, initiate manual-safe mode. Handover token validation is a separate protected operation, never a query-string value.
- Authenticated mutations, least privilege, request validation, CORS restrictions, event logging and throttle control required.
- Dashboard telemetry must be timestamped with staleness status, and error dialogs cannot be treated as confirmed action completion.

## 7. Operating profiles / resource tiers
- `smoke`: ROS nodes + synthetic sensor fixture, minimal CPU, CI.
- `physics_headless`: robot + Gazebo physics + LiDAR/IMU; first Codespaces milestone.
- `navigation_headless`: physics + SLAM or AMCL + Nav2; cloud if capacity allows.
- `full_visual`: RViz/Gazebo GUI, camera/depth rendering; powerful remote/local hardware, not a dependency of CI.
- `evaluation`: deterministic seed-runner, evaluator, recorder and artifact export.

Never assume Codespaces provides a dedicated GPU or that camera renders and Nav2 fit its free resource allowance.

## 8. Fault injection & observability
Inject command dropout, encoder drift, LiDAR dropout, stalled wheel, latch failure, dock contact failure and network partition behind a versioned experiment profile. Observe heartbeat age, TF age, localization covariance, dropped sensor frames, loop frequency, simulated-versus-wall time, CPU/RAM, and clear fault-recovery events.

## 9. Security and deployment
- The browser and API are separate from DDS; use authentication and network policy for bridge/API.
- Do not store GitHub tokens, API secrets, handover codes, or real person locations in datasets.
- Prefer least-privilege temporary credentials and GitHub secret storage.
- Pin base image digest and selected source revisions once the baseline compiles; avoid floating nightly tags.
- Real robot variant requires independently engineered hardware E-stop, BMS protection and deployment safety assessment.

**Upstream docs:** [Gazebo ros_gz_bridge](https://gazebosim.org/docs/harmonic/ros2_integration/), [Nav2 setup](https://docs.nav2.org/jazzy/configuration_and_development/first_time_robot_setup_guide/gazebo/), [Nav2 Collision Monitor](https://docs.nav2.org/jazzy/tutorials/general_tutorials/using_collision_monitor/using_collision_monitor/), [Nav2 Docking Server](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/core_servers/configuring_docking_server/).
