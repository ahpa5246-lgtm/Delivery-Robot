# Collision-aware delivery demonstration: evidence and limitations

This development branch keeps Lichtblick as an **MCAP viewer**, not a simulator.
Visual mesh triangles are not sent to the navigation algorithm by the browser.
All route/physics decisions are produced before playback and then encoded into
recordings. In particular, pause/seek never issues commands to hardware.

## Map / rendering / replay consistency

`world/campus_layout.json` is the explicit source of collision rectangles and
robot radius, and drives offline A* and both Gazebo SDF static worlds.

- **Campus:** `/recordings/campus-reactive.mcap` and
  `/models/environment/native-campus.urdf`
- **Warehouse:** `/recordings/warehouse-reactive.mcap` and
  `/models/environment/native-logistics.urdf`
- `/recordings/campus.mcap` remains an explicit **legacy clear-route** reference,
  never a default source for the logistics view.

The Environment view switch reloads the recording matching the chosen theme,
then applies the camera and native URDF layer. Provenance metadata marks the
exact collision world. In the Missions panel, **Collision verification** refers
to the static + scenario-dynamic **2-D swept-disk test**, not 3-D Gazebo contact.
Textures, canopies, windows and road markings remain visual-only.

## Reacting to a modeled obstruction

`cdr_sim/closed_loop.py` computes an offline closed-loop trace with:
1. A reference A* path against the shared known 2-D world and conservative
   robot-inflated collision rectangles.
2. An initially unknown circular obstacle positioned on the nominal path, in
   a trial scenario chosen to admit a feasible bypass.
3. An idealized radial surface range measurement; the obstacle is inserted into
   the **known** occupancy cells only after detection.
4. A speed ramp and a bounded deceleration update each integration step:
   `v_next = max(0, v_current - a_max dt)`. The required stopping distance
   is `v²/(2a_max)`, plus one update step and the configured safety margin.
5. A new A* plan only once speed reaches zero, followed by swept-segment
   checks against **both** original static rectangles and the circular hazard.
   If no safe route exists, the robot remains in `PAUSED_SAFE`.

Both test files compare poses and route segments against geometry rather than
only checking a reported success flag. The ROS1 `/cdr01/planned_path` topic publishes the current A* plan,
updated at the first successful replan; the cyan planned trajectory can
be visually compared with the orange `/cdr01/path` odometry history.
These must not be conflated with one another.
The synthetic obstacle is drawn from the
recording's ROS1 visualization Marker topic
`/cdr01/dynamic_obstacle`; it represents *simulated world truth*, **not**
a measured LiDAR observation. The computed `obstacle_range_m` and
`minimum_clearance_m` fields can be plotted during playback.

No feature here claims calibrated wheel slip, IMU/LiDAR variance, sensor latency,
robot localization error, force control or a real emergency-stop circuit.
Estimated energy values are unchanged approximations.

## Independent Gazebo physics acceptance

The GitHub Actions `gazebo-headless.yml` installs Gazebo Harmonic within a
ROS Jazzy container. It already checks robot movement and ROS2 bridging.
The new test additionally loads the two manifest-derived SDF worlds, drives
CDR-01 toward the **first actual SDF building collision shape** and checks that
the odometry approaches but does not penetrate its x=8 m wall.

This is an independent headless physics **wall contact smoke test**, not a full
validation of all obstacles, calibrated dynamics, Nav2 execution or a physics
simulation of the newly injected dynamic hazard. Only after the independent Gazebo wall-contact gate passes, CI exports the
simulator's raw odometry to `campus_gazebo_verified.mcap` and
`warehouse_gazebo_verified.mcap`. These MCAP files carry explicit provenance
(`gazebo_harmonic_observation`, ROS1-wire container, **simulated** odometry)
and unknown energy/battery values are null, not fabricated zero estimates.
They show physics wall contact, not reactive Nav2 obstacle avoidance.
The physical result is only verified if this specific workflow job and artifact pass. Failed or missing
Gazebo evidence must not be represented as verified.

## Reproduce

```bash
python3 -m unittest tests.test_closed_loop tests.test_reactive_mcap tests.test_world_collision_v4 -v
bash scripts/setup_telemetry.sh
bash scripts/start_telemetry.sh
```

Open the port 8080 and choose **Load matching reactive demo**. During playback
inspect Perception, Planning and Missions; switching University campus /
Logistics warehouse must change both the geometry and the MCAP source. For
physics, inspect the separate GitHub Actions Gazebo Harmonic smoke workflow.

The map is synthetic, not a surveyed campus. Gazebo CAD and visualization
meshes need not have identical collision geometry. Do not report physically
measured sensor data or field safety from these tests.
