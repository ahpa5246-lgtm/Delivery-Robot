# Delivery-Robot Implementation Roadmap and Work Breakdown
**Status:** Planning only (2026-10-11). No implementation started.

## 0. Stage-gate principle
Do not start Phase N+1 until Phase N's stated evidence is available. Dependencies form a strict chain for the core robot, though documentation/API mocks may be developed independently. Dates are intentionally not promised; cloud runtime and setup complexity are still unknown.

## Phase 0 — Reproducible cloud development (P0)
**Deliverables:**
- Pin Ubuntu 24.04, ROS 2 Jazzy and Gazebo Harmonic with reproducible container/lock inputs.
- Minimal devcontainer with ROS base, colcon, rosdep, Gazebo headless runtime, proper workspace mounts.
- Cloud cost documentation: 2-vCPU baseline first, session shutdown/storage hygiene, GitHub Student plan usage and quota monitoring.
- CI workflow for docs, formatting, static checks and minimal ROS packages.
- Upstream baseline smoke check: rbot first; fallback linorobot2 Jazzy if required.

**Exit gate:** a fresh Codespace can build a minimal workspace; `ros2 topic list` works; a trivial Gazebo world steps headless; actual image size, RAM, CPU and RTF are logged. Do not claim a simulator test until it runs.

## Phase 1 — CDR-01 physics and teleop (P0)
**Deliverables:** geometry with inertial/collision model; actual dynamic caster joints; powered wheel actuation; keyboard teleop via arbiter; wheel/IMU/LiDAR topics and static/dynamic frames; simple flat and incline worlds; contact and encoder instrumentation.

**Exit gate:** static model is stable; differential kinematics match test trajectories under declared no-slip test conditions; command and acceleration limits enforced; physical and sensor data are recorded. Estimate torque from geometry before selecting motor model.

## Phase 2 — Mapping, localization and autonomous navigation (P0)
**Deliverables:** basic campus world with marked stations; saved SLAM map; wheel/IMU EKF fusion; AMCL; Nav2 planner/controller/behavior tree; dynamic obstacles; safety velocity arbiter and basic collision monitor.

**Exit gate:** robot can complete 20 seeded waypoint navigation tests using only simulated sensors and estimated pose. Failures are measured and do not trigger fake success.

## Phase 3 — Real delivery workflow (P0)
**Deliverables:** mission ID and state machine; API contract and persistent event store; pickup/loading confirmation; payload door/lock interlocks; destination code/handover; cancellation, retry, supervisor status; minimal operator dashboard.

**Exit gate:** complete a full dispatch->pickup->secure->navigate->authorized release->verify removal->close mission flow; fault and authorization paths pass tests; persisted logs match simulator events.

## Phase 4 — Energy, return, docking and resilience (P1)
**Deliverables:** named battery model, adjustable motor and auxiliary power draw, energy feasibility prediction, reserve policy, Nav2 dock integration, physical dock contact/power verification, fault injection (stale sensor, stop, lock, encoder, network).

**Exit gate:** energy estimates clearly identify model fidelity; docking is not marked successful on mere proximity; all safety fault cases inhibit motion. Reruns produce attributable datasets.

## Phase 5 — Engineering benchmark & publication (P0 for evidence, P1 for advanced fidelity)
**Deliverables:** scenario suite with seeds and configuration freeze, ROS bags and evaluator truth, run manifests, metrics and automated report generation; repeated experiments (nominal >=100 runs plus fault & parameter sweeps); provenance of reused code; design caveats.

**Exit gate:** each test outcome reproducible or quantified as nondeterministic, report has raw/evaluator files, exact environment/version, defined pass thresholds and transparent failures. Distinguish simulated/analytical from physical measurements.

## Phase 6 — Multi-robot / Open-RMF (P2; deferred)
**Deliverables:** robot namespaces and isolation, fleet adapter prototype, assignment by capacity/SoC/location, conflict analysis, shared dock and route scheduling, aggregate dashboard. Select RMF branch compatible with our ROS/Gazebo environment and prove it separately.

**Entry gate:** Phase 5 accepted for one robot. No version-mismatched `rmf_demos main` dropped into the Jazzy workspace.

## Suggested first GitHub issues (in dependency order)
| # | Suggested issue title | Dependencies | Acceptance |
| --- | --- | --- | --- |
| 1 | Pin ROS Jazzy/Gazebo Harmonic development image & Codespaces | none | rebuildable environment; resource log |
| 2 | Benchmark rbot headless bring-up against Codespaces quota | 1 | repo SHA, logs, pass/fail, CPU/RAM/RTF |
| 3 | Define CDR-01 Xacro links, inertia and passive caster contact | 1 | linted physics model and TF tree |
| 4 | Implement ros2_control wheel and command-safety arbitration | 3 | safe joint output, constrained velocity |
| 5 | Configure IMU, wheel odometry, LiDAR & ros_gz bridges | 3,4 | frames, rates and noise verified |
| 6 | Construct minimal campus route and handover stations | 3 | traversable world, known coordinates |
| 7 | Integrate EKF/AMCL/SLAM/Nav2 and waypoint tests | 5,6 | navigation tests with no ground-truth input |
| 8 | Specify MissionEvent & ExecuteDelivery interfaces / API | 1 | versioned schemas & idempotency tests |
| 9 | Implement loading lock, recipient ack and mission state machine | 7,8 | end-to-end trace; failed paths covered |
| 10 | Create evaluator-only truth recorder & metric runner | 4,5 | time alignment + manifest + result file |
| 11 | Model electrical loads and charging decision/dock | 9,10 | explicit power/fidelity limitations |
| 12 | Run 100 seeded nominal missions + parameter/fault sweeps | 10,11 | published simulation metrics, confidence intervals, failures |

## Cross-cutting milestones and engineering decisions
- **ADR-001** chosen differential robot and rbot-first reference (OPEN_SOURCE_REVIEW.md).
- **ADR-002 (pending):** determine actual Dev Container image, exact project SHA and dependency pinning after clean build.
- **ADR-003 (pending):** Gazebo physics engine parameters, friction calibration and caster model tradeoffs.
- **ADR-004 (pending):** power model choice/calibration and whether motor driver must publish electrical state.
- **ADR-005 (pending):** fleet/RMF distro compatibility and availability of adequate remote compute.
- Change any pinned configuration only through a reviewed ADR, versioned experiment comparisons and migration note.

## Risk register
| Risk | Consequence | Mitigation / owner workstream |
| --- | --- | --- |
| Codespaces CPU/RAM/storage insufficient | Very slow / impossible full navigation runs | Split lightweight builds from physics runs; benchmark minimum, use GPU remote/local only for visuals |
| Passive caster jitter or contact instability | Invalid odometry and motor results | Explicit swivel/rolling joints, time-step tuning, physics acceptance tests |
| Assumed pavement coefficient wrong | Optimistic traction or range | Parameter sweeps and later real friction measurements |
| No tested electrical battery/motor model | Invalid range claims | Mark power metrics estimated and restrict scope |
| Nav2 tuning overfits a single map | Poor generalization | Multiple route seeds and independent hidden evaluation scenarios |
| Sensor idealization or truth leakage | Inflated localization accuracy | Fault/noise injection and isolated evaluator pipeline |
| Unsafe software e-stop semantics | False real-world safety claims | Simulation-only warning; physical safety case separate |
| Open-RMF default branch stack mismatch | Dependency conflicts | Defer and pin compatible branches after one-robot pass |
| License / mesh provenance missing | Compliance and attribution issues | Track third-party file licenses & revisions |
| API mission duplication / expired OTP | Incorrect parcel handover | Idempotency keys, token expiration, state guard, audit log |
| Field ODD too broad | Unbounded hazard exposure | Private mapped paved paths only; no roads/curbs; survey before hardware |

## Resource strategy
- GitHub is the **source of truth**, not the simulation machine itself. Codespaces is a Linux cloud development machine.
- Begin headless with no cameras: robot model + differential drive + wheel sensors.
- Profile actual memory and sim real-time factor before selecting cloud tier.
- Stop idle Codespaces and avoid persisting large bag files in repository workspace.
- Do not assume Azure student credits or GPU machines are available for a given region/subscription.
- Produce exported experiment summaries and manifests that survive destruction of a Codespace.

## Implementation definition of ready
Before a feature starts: requirement ID, ROS package owner, data contract, failure behavior, validation method, expected resource footprint and upstream license are documented.

## Implementation definition of done
Must provide: compilable code, configuration, integration test (or documented test infeasibility), observability, explicit limitations, artifacts and status update. Never mark an untested feature complete.
