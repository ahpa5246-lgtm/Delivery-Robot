# Open-Source Reference Review and Reuse Decision
**Review date:** 2026-10-11. Based on accessible repositories, README files, repository layout and license files. **No repository has been compiled, executed or benchmarked by this review.**

## 1. Selection criteria
- Compatibility with **Ubuntu 24.04 + ROS 2 Jazzy + Gazebo Harmonic** (highest priority).
- True physical robot model and controllable joint / sensor pipeline rather than a moving visualization.
- Differential-drive behavior; ease of adapting to two driven wheels and two casters.
- Good separation of simulation, controllers, localization, navigation and mission logic.
- Docker/Dev Container/headless workflows for GitHub Codespaces.
- Clear reusable license and manageable third-party dependency provenance.
- Outdoor delivery environment and payload/charging functionality as useful reference features.

## 2. Comparison matrix
The judgements below describe the publicly documented project design, **not verified running capability**.

| Project | Stack / geometry | Strong parts worth referencing | Risks / gaps for our CDR-01 | License | Decision |
| --- | --- | --- | --- | --- | --- |
| [rlxai/rbot](https://github.com/rlxai/rbot) | Jazzy + Harmonic, differential AMR; Docker + .devcontainer | Joint control, IMU/LiDAR, EKF, mapping, Nav2, headless scripts, benchmark worlds, structured workspace | Warehouse first, no full delivery/payload/handover workflow; exact dependencies and integration need build test | Apache-2.0 per LICENSE text | **Primary architecture/integration reference** |
| [linorobot/linorobot2](https://github.com/linorobot/linorobot2) (jazzy branch) | Jazzy, Gazebo, 2WD/4WD/Mecanum variants | Hardware design pathway, sensor drivers, realistic navigation, URDF parameterization, map-to-world tooling | May assume hardware/network choices not needed in simulation-first repo; review modules before copying | Apache-2.0 | **Secondary mechanics/real-hardware reference** |
| [Pouya-Mansournia/Delivery-Robot-ROS](https://github.com/Pouya-Mansournia/Delivery-Robot-ROS) | Jazzy + Harmonic, outdoor city six-wheel chassis | SolidWorks-derived model, slopes/sidewalk-style world ideas, staged outdoor delivery scenario | Six-wheel skid dynamics not our chosen drivetrain; README acknowledges reactive waypoints rather than full Nav2 and non-active sensor mounts | MIT | **Outdoor-world and packaging reference only** |
| [mohmedatwa/delivery_robot](https://github.com/mohmedatwa/delivery_robot) | Jazzy + Harmonic, indoor mecanum delivery robot | Delivery navigation and launch patterns, web bridge/server, EKF and Nav2 | Mecanum indoor contact/kinematics unsuitable as direct campus chassis; review web security | MIT | **UI/missions reference, not chassis** |
| [open-rmf/rmf_demos](https://github.com/open-rmf/rmf_demos) | Latest demo `main` targets Kilted + Ionic; includes campus and delivery/fleet examples | Task dispatch, traffic coordination, campus maps and fleet interfaces | The demo default stack mismatches our Jazzy + Harmonic baseline; need version-matched RMF source/branches and integration tests | Apache-2.0 | **Phase-2 fleet only, never first milestone** |
| [BN-Nasser/Autonomous-Delivery-Robot](https://github.com/BN-Nasser/Autonomous-Delivery-Robot) | Humble + Gazebo, Andino platform | QR/OCR ideas, charging scenarios, mobile/web application sketches | Different ROS 2 distro; CV and battery quality unverified; extra model/runtime complexity | MIT | **Optional product feature inspiration only** |
| [turtlebot/turtlebot4_simulator](https://github.com/turtlebot/turtlebot4_simulator) (jazzy branch) | TurtleBot 4 simulator packages | Canonical simulator organization, Gazebo bring-up and ROS interfaces | Different robot geometry and cargo arrangement | Apache-2.0 | **Reference for simulator packaging** |

## 3. Selection decision / ADR-001
**Choose:** a new, small, custom CDR-01 ROS 2 workspace implementing differential drive and university-campus ODD. Treat `rlxai/rbot` as the first **evaluated upstream candidate** for integration scaffolding, not a blind base to copy in bulk; use `linorobot2` for hardware calibration and simulation-to-hardware patterns.

**Reasons:**
1. Direct alignment of supported Jazzy/Harmonic stack minimizes version mixing.
2. Modular, container-first projects are more suitable for constrained Codespaces.
3. We retain engineering control over inertials, contact patches, casters, cargo and power model, which define fidelity.
4. Delivery-specific behavior is built behind interfaces; no tight coupling to a particular upstream dashboard or fleet package.
5. This approach is auditable for a student project; sources and modifications remain attributable.

**Conditional fallback:** if `rbot` fails our clean headless bring-up/build tests or dependency budgets, start from `linorobot2`'s Jazzy simulation packages; run the same acceptance tests to justify selection. Neither alternative is assumed verified.

## 4. What to reuse / adapt / build
| Capability | Source strategy |
| --- | --- |
| Gazebo/ROS bridge | Use supported ROS integration packages from upstream Gazebo directly |
| Motor simulation / joint controllers | Use `ros2_control` and `gz_ros2_control`, adapted to CDR-01 |
| EKF, SLAM, AMCL, Nav2 | Integrate official packages, compare configs with rbot/linorobot2 |
| Robot URDF/Xacro | New, documented CDR-01 geometry and inertials; optionally reference linorobot2 conventions |
| Campus world | Author simple reproducible world; adapt only suitably licensed source ideas/assets |
| Mission state machine | New code with idempotent events and delivery contract |
| Door, latch, payload simulator | New custom state/physics logic with observable feedback |
| Battery and charging | Explicit CDR-01 electrical/dock model; do not claim realism by importing simple SoC publishers |
| Dashboard | New tailored API; study Mohamed Atwa project for ROS bridge concepts |
| Fleet coordination | Later: version-compatible Open-RMF and adapter |

## 5. Licensing and provenance obligations
- **Apache-2.0:** preserve applicable LICENSE, NOTICE files and modification notices; verify exceptions and file-specific notices.
- **MIT:** preserve copyright and license notice in reused code/assets.
- **Meshes, textures, images and model weights** may carry different licenses. Review file provenance individually before copying.
- Keep `third_party/PROVENANCE.md` and an SBOM/dependency manifest during implementation. Cite upstream and the exact commit SHA.
- Prefer depending on published packages over vendoring large source trees. Avoid redistributing binary assets that lack explicit rights.
- Do not equate a repo's LICENSE header with universal permission to reuse everything under all linked dependencies.

## 6. Pre-code verification tasks
1. Inspect individual packages, launch files and Jazzy dependencies, not README alone.
2. Record upstream SHAs, commit dates, ROS/Gazebo pairing and license details.
3. Create a clean Ubuntu 24.04 Codespace and build only the candidate's minimum headless subset.
4. Verify simulated `/clock`, `/tf`, wheel odometry, LiDAR and IMU; record CPU/RAM/storage/RTF.
5. Prove source packages do not need GUI/GPU or external hardware for baseline tests.
6. Choose reusable modules only after build output and unit tests are recorded.
7. Create a small ADR explaining any divergence from the selected design.

## 7. Authoritative compatibility & integration references
- Gazebo official compatibility: https://gazebosim.org/docs/harmonic/ros_installation/
- Nav2 Jazzy robot setup: https://docs.nav2.org/jazzy/configuration_and_development/first_time_robot_setup_guide/gazebo/
- gz_ros2_control: https://control.ros.org/jazzy/doc/gz_ros2_control/doc/index.html
- Open-RMF demos: https://github.com/open-rmf/rmf_demos/blob/main/README.md

**Scope note:** we reviewed public materials but did **not** establish actual downstream runtime compatibility of complete stacks, especially modern Open-RMF with Jazzy.
