# CDR-01 Mechanical, Electrical & Simulation Engineering Specification
**Status:** Design assumptions v0.1 — no measured/tested hardware or simulation results.

## 1. Selected platform & rationale
**Configuration:** two independently driven central rubber wheels plus front and rear passive swivel-and-roll casters, rigid payload chassis. Differential drive kinematics provide a low-complexity baseline that maps directly to Nav2 and `diff_drive_controller`. Full passive caster roll/swivel joint and contact modeling is a requirement; a visually depicted caster with no physics is unacceptable. Validate caster flutter, slopes and turning stability before freezing wheel locations.

**Why not 6-wheel skid steer or mecanum at v1:** 6-wheel improves obstacle negotiation but complicates scrub/slip, contact tuning, suspension and energy attribution. Mecanum requires roller contact and suitable surfaces; it is a poor default for irregular campus pavement. Six-wheel CAD in the open-source review is a reference, not a proven chassis.

## 2. Proposed dimensions and configuration
| Parameter | Baseline | Status |
| --- | --- | --- |
| External envelope | 0.65 m long × 0.45 m wide × 0.70 m high | target |
| Robot empty mass | 20 kg | assumption |
| Max payload | 5 kg | target |
| Gross loaded mass | 25 kg | assumed worst case for first-order sizing |
| Drive wheels | 2 rubber wheels, diameter 0.24 m (radius 0.12 m) | proposed |
| Distance between drive wheel contact tracks | 0.38 m | proposed |
| Passive support | 2 independent swivel/rolling casters, diameter ~0.15 m | proposed, validate geometry |
| Ground clearance | >= 0.04 m | target |
| Payload compartment internal usable volume | approximately 22 L | target; verify against envelope |
| Max translational velocity | 0.8 m/s | software limit |
| Max acceleration | 0.3 m/s² | normal-operation limit |
| Max yaw rate | proposed 0.8 rad/s | tune with stability |
| Nominal inclines | <= 5 degrees | ODD ceiling (not certified) |
| Max surface joints | <= 0.01 m | ODD ceiling |
| Reference battery | 24 V nominal × 20 Ah = 480 Wh nominal | sizing input, not delivered energy |

**Center of mass:** represent chassis, battery, cargo and caster masses as separate inertial links or a calibrated composite. Validate COM variation for empty/full and front/back payload bias; calculate roll/pitch stability and normal forces at each contact.

## 3. Drive sizing — reproducible preliminary calculation
Use a **first-order**, no-slip calculation only to shortlist actuators, not claim physical validation.

Inputs: gross mass `m = 25 kg`, wheel radius `r = 0.12 m`, slope `theta = 5 deg`, rolling resistance coefficient `Crr = 0.03` (assumption; surface-dependent), acceleration `a = 0.30 m/s²`, gravitational acceleration `g = 9.81 m/s²`.

```text
F_grade = m*g*sin(theta)             ≈ 21.37 N
F_roll  = Crr*m*g*cos(theta)        ≈  7.33 N
F_accel = m*a                       =  7.50 N
F_total = F_grade + F_roll + F_accel≈ 36.20 N
T_wheel (each, ideal) = F_total*r/2 ≈  2.17 N·m
omega at 0.8m/s = v/r               ≈  6.67 rad/s (~63.7 rpm)
```

**Preliminary actuator requirement:** independently controllable 24 V geared motors with ~5 N·m *continuous usable output torque per drive wheel* and >= 10 N·m short-duration peak **to be validated against duty cycle, speed–torque curve, thermal behavior, drivetrain efficiency, braking and turn-in-place friction**. Do not treat motor electrical wattage as proof of adequate output torque.

The estimate excludes caster swivel drag, impacts, wheel sink, inertial rotation, acceleration of motor/gear internals and safety factor justification. Electrical energy modeling must include controller, sensors and computing loads.

## 4. Simulation-level fidelity requirements
- URDF/Xacro visual, collision and inertia definitions with explicit SI units and named frames.
- Gazebo SDF physics contacts: wheel/caster friction, slip, ground collision, contact reporting, configurable world-step and solver settings.
- Configurable motor limiters: torque, commanded speed, acceleration and delay; motor electrical model added before energy claims.
- No artificial direct teleporting or idealized pose commands to robot base in evaluation runs.
- Parameter sweep: empty/full load, payload shifted, three surface friction levels, 0/3/5° slopes and repeatable random noise.
- Log wheel contact events and joint effort where the configured simulator/control interface actually exposes them. Mark unavailable signals as *unmeasured*, not zero.

## 5. Sensor instrumentation
| Sensor | Baseline specification | Intended measurement / limitation |
| --- | --- | --- |
| 2-D LiDAR | 270° FoV, nominal 10 Hz, 0.12–15 m usable range; configurable noise/dropouts | planar obstacle ranges; cannot detect all holes, overhangs or thin objects |
| Wheel encoders | two drive wheels; >= 1024 counts/revolution at effective wheel output (assumed) | odometry, affected by slip and quantization |
| IMU | gyro + accelerometer, nominal 100 Hz; bias/noise/drift configs | orientation/short-horizon motion, needs fusion |
| Depth camera | **P1**, front/downward FOV to be specified | low obstacles, drop-off detection under controlled test; headless graphics cost |
| Contact switch / bumper | front and rear contact zones | collision/physical stop events |
| Payload presence | virtual load cell or compartment occupancy state | loading/removal event; not sufficient proof of human handover |
| Door/lock sensor | commanded state and measured state modeled separately | interlock, failure injection |
| Dock detector | simulated relative pose plus explicit contact/power flag | charging state verification |
| GPS | P2 only when global campus scale makes it necessary | not required for first mapped-walkway phase |

Publish sensors via dedicated ROS topics and TF frames; document rates actually observed, covariance assumptions, QoS and missing-data behavior.

## 6. Power & charging
- Model SoC, voltage, current, energy, capacity and charge/discharge efficiency; sensor/computer baseline wattage and wheel motor electrical loading are separate terms.
- Use `E_nominal = V_nominal × Ah = 480 Wh` as **nameplate estimate**, not useful energy or predicted travel range.
- Proposed mission admission: predicted energy + docking return + margin <= energy available above configurable 20% SoC reserve.
- On low reserve: decline new delivery, choose safe return/dock or stop and request assistance if safe docking energy insufficient.
- Model dock alignment, electrical contact, charge active/failed and charge completion as distinct states; charging requires proven dock contact + positive charging-power signal, not mere geometric proximity.
- Temperature, aging, BMS accuracy and thermal protection remain unvalidated until separately modeled/calibrated.

## 7. Security, payload & safety
- Lockable compartment with nominal states CLOSED_LOCKED, CLOSED_UNLOCKED, OPEN; transitions require door and latch feedback.
- Recipient release requires authenticated, time-bounded handover token. Do not encode real recipient identities in demonstration datasets.
- Robot must not move with compartment OPEN or latch fault.
- Software emergency stop / command inhibit is a simulation function. **It is not a safety-rated physical emergency stop.**
- Supervisor fault priority overrides all autonomy; loss of sensor freshness, transform continuity, localization quality or controller heartbeat causes inhibit.
- Pedestrians have absolute right of way; v1 navigates only in a controlled, surveyed ODD.
- Safety case for real deployment requires independent physical hazard analysis, certified protective design when applicable, and field trials.

## 8. Design verification gates
1. Inertial and collision model is internally consistent and static robot does not tip on the level test surface.
2. Wheel velocity, distance and rotation agree with differential drive equations in a no-slip calibration case within documented tolerance.
3. Incline/payload/friction sweeps recorded with grounded contact/torque data and explicit runtime limits.
4. Compartment interlocks and safety faults prevent motion.
5. Energy budget uses transparent assumptions and, eventually, calibrated motor/power model.

**References:** [gz_ros2_control](https://control.ros.org/jazzy/doc/gz_ros2_control/doc/index.html), [Gazebo sensors](https://gazebosim.org/docs/harmonic/sensors/), [Nav2 first-time robot setup](https://docs.nav2.org/jazzy/configuration_and_development/first_time_robot_setup_guide/gazebo/).
