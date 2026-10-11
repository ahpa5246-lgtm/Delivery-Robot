# CDR-01 System Requirements (SRD)
**Status:** Baseline proposal v0.1 · **Date:** 2026-10-11 · **Maturity:** not validated.

## 1. Mission & operational design domain (ODD)
One autonomous delivery robot carries a parcel between a campus dispatch point and selected handover stations, through mixed pedestrian circulation on private, paved walkways.

**Within ODD, subject to later site survey:** mapped pedestrian-only paths; paved, dry, predominantly even surfaces; inclines up to 5°; small surface joints <= 10 mm; path clear width >= 1.5 m; daylight / illuminated low-light conditions to be tested separately; nominal outdoor temperature assumed 5–40 °C only for conceptual sizing (thermal validation excluded). Maximum ground speed 0.8 m/s.

**Explicitly outside v1 ODD:** public roads and crossings involving motor traffic, curbs and stairs, off-road rubble, high water or rain exposure, severe gradients, autonomous elevator use, physical human handover, crowd-density guarantees, and real-world safety certification. A real deployment would require environmental survey, local permissions and verified safety-rated hardware.

## 2. Personas, mission and constraints
- **Dispatcher:** opens/cancels requests; sees mission status, last reported location and faults.
- **Loader:** confirms parcel loaded and compartment closed/locked.
- **Recipient:** provides an expiring one-time code and confirms item removal.
- **Supervisor:** takes over, applies stop/recovery, or marks delivery failed.
- **Simulation evaluator:** configures experiments and accesses ground truth, never publishes it to robot navigation.

**Success condition:** accepted mission -> pickup arrival -> payload secured -> destination arrival -> authorized unlock -> parcel removal confirmed -> closed/locked -> completed with a persisted event log. Arrival alone is not delivery.

## 3. Functional requirements
Requirements must be traceable to tests (V-series in VALIDATION_PLAN.md).

| ID | Priority | Requirement | Proposed verification |
| --- | --- | --- | --- |
| FR-001 | P0 | Spawn CDR-01 with valid URDF/Xacro/SDF, collision/inertial properties and dynamic caster joints | V-01 |
| FR-002 | P0 | Enforce speed/acceleration/torque limits through actuated wheel joints and a single motion-command arbitration path | V-02 |
| FR-003 | P0 | Publish simulated wheel encoder, IMU, LiDAR and contact observations with configurable noise; timestamp using simulation clock | V-03 |
| FR-004 | P0 | Separate true world pose from estimated odometry and localize using EKF + AMCL or mapped SLAM output | V-04 |
| FR-005 | P0 | Map a test environment with SLAM and navigate using a saved occupancy map and Nav2 | V-05 |
| FR-006 | P0 | Detect obstacles, stop or re-plan around them; never treat absent/frozen sensors as free space | V-06 |
| FR-007 | P0 | Accept, reject, cancel and durably log mission requests with unique IDs and idempotent handling | V-07 |
| FR-008 | P0 | Progress through explicit pickup/lock/transit/unlock/handover/complete mission states | V-07 |
| FR-009 | P0 | Simulate compartment door/lock and payload presence; prohibit movement when door unlatched | V-08 |
| FR-010 | P0 | Estimate state of charge and energy to complete mission with reserve; reject unsafe assignments | V-09 |
| FR-011 | P0 | Provide stop-on-fault for command timeout, stale obstacle data, localization failure, collision contact and supervisor stop | V-10 |
| FR-012 | P0 | Record ROS 2 bags, simulator truth and structured experiment/event metadata without feedback leakage | V-11 |
| FR-013 | P0 | Expose dashboard/API for mission operations and robot telemetry, with authentication and role checks for writes | V-12 |
| FR-014 | P1 | Return to dock at configurable reserve threshold; detect successful dock contact and charging | V-09 |
| FR-015 | P1 | Model graded slopes, variable friction, wheel slip, payload shift and dynamic pedestrian agents | V-13 |
| FR-016 | P1 | Support recovery from safe transient faults without silently bypassing failed safety checks | V-10 |
| FR-017 | P2 | GPS, depth sensing, enhanced weather, simulated cellular packet loss and multi-robot operation | V-14 |
| FR-018 | P2 | Fleet integration behind a versioned adapter interface without coupling v1 Nav2 to Open-RMF | V-15 |

## 4. Non-functional requirements
| ID | Requirement / target |
| --- | --- |
| NFR-001 | All core functions run headless and without requiring local Windows ROS/Linux installation. |
| NFR-002 | Use Ubuntu 24.04, ROS 2 Jazzy, Gazebo Harmonic; pin package/image revisions in implementation. |
| NFR-003 | Core robot logic must not access physics engine internals or ground truth; evaluator is a separate namespace/process. |
| NFR-004 | Declare frame convention: `map -> odom -> base_link` and static sensor frames; no duplicate TF publisher per link. |
| NFR-005 | Provide reproducible experiment manifests including code SHA, environment image digest, random seeds, physics step, payload and sensor parameters. |
| NFR-006 | Use monotonic simulation timestamps for measurements; wall-clock used separately for performance. |
| NFR-007 | Dashboard must distinguish *running*, *degraded*, *stale* and *faulted* telemetry; no false live state after disconnect. |
| NFR-008 | Mission writes must be authenticated/authorized and input-validated; secrets must not enter Git or logs. |
| NFR-009 | CI has fast static/unit tests; physics integration tests run as a distinct resource-aware job. |
| NFR-010 | Every implemented feature has a test and a documented failure path. |
| NFR-011 | Simulation and analysis run with reasonable cloud quotas; heavy visuals and camera rendering are optional. |
| NFR-012 | Datasets must record units, coordinate frames, sample rates, missing samples, and model limitations. |

## 5. Acceptance targets — **hypotheses, not achieved results**
For an explicitly defined **nominal** paved-path benchmark of >= 100 seeded delivery runs:
- Delivery success >= 95% **including simulated payload confirmation**.
- 0 physics contact collisions with simulated pedestrians or static obstacles across *nominal acceptance runs*.
- 2D position-estimate RMSE <= 0.25 m against ground truth over mapped route segments (alignment method defined in protocol).
- Maximum commanded speed <= 0.8 m/s and commanded acceleration <= 0.3 m/s², except modeled emergency deceleration.
- Door-open, stale-sensor, e-stop, lost-localization and command-timeout fault tests must transition to safe-stop state under documented timeout limits, to be measured before freeze.
- Power reserve threshold is configurable (proposed 20% SoC); this is **a policy**, not verified range.
- Every completed run must have a machine-readable result plus source dataset and config manifest.

These acceptance thresholds will be refined after initial model calibration and risk assessment; they are not real-world safety guarantees.

## 6. Definition of done (DoD)
A requirement is *done* only if code, interface contract, automated test, failure-path verification, parameter documentation, and an attributable test artifact exist. A video alone never satisfies a system requirement.

## 7. Future expansion policy
One-robot mission operations remain independent of fleet allocation. Proposed fleet topics/API must include robot ID and mission ID, but fleet scheduling/routing is out of scope until one robot passes the nominal and fault-testing gates.
