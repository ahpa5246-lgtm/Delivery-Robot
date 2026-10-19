# Lichtblick integration — phase 1: recorded Gazebo odometry

Reference: https://github.com/Lichtblick-Suite/lichtblick

This is a **small integration**, not a fork or replacement of the existing dashboard.
Lichtblick is a separate open-source visualization tool. Its source license and
third-party dependency licenses must be reviewed before redistribution.

## Export a real simulation recording

Generate a Garden flat-proxy Gazebo run using the documented project workflow:

```bash
bash scripts/run_garden_gazebo.sh assets/garden-calibration.json
```

Then convert the recorded odometry:

```bash
python -m pip install mcap
python scripts/export_lichtblick_mcap.py experiments/garden_gazebo/latest_run.json --output experiments/garden_gazebo/cdr01.mcap
```

Open the `.mcap` file in Lichtblick (browser or desktop). Add **Raw Messages** for
`/cdr01/garden_gazebo/odometry` and **Plot** panels for `x_m`, `y_m`,
and `yaw_rad` using the message-path selector.

This export stores JSON-schema messages. It does **not** yet publish ROS 2
`nav_msgs/Odometry`, `tf2_msgs/TFMessage`, or `sensor_msgs/PointCloud2`.
Consequently the 3D panel will **not automatically render a robot pose** from
this custom topic. Native ROS message conversion and a TF/URDF bridge are the
next integration milestone. Never label the exported messages as physical
measurements, real Garden terrain collisions, or live telemetry.

The exporter rejects recordings lacking the established Gazebo source and
flat-proxy provenance, mismatched sample counts, invalid numeric data, and
non-monotonic timestamps. It does not synthesize missing odometry.

## Validation

```bash
python -m unittest tests.test_lichtblick_mcap -v
```

Integration acceptance remains **pending** until the converter has been run
against a real recorded file and its output opened in Lichtblick. No claim of
an end-to-end tested integration is made by this document.

## Next milestones

1. Verify real MCAP export and visual plotting in Lichtblick.
2. Add ROS 2 native message schema, coordinate frames and URDF for the 3D view.
3. Add an opt-in read-only WebSocket bridge for live Gazebo topics.
4. Build a CDR mission-status custom panel with source labels.
5. Compare desktop/mobile screenshots and interaction latency with Foxglove.

## Phase 2: 3D trajectory in Lichtblick (implemented exporter, pending visual QA)

The new `scripts/export_lichtblick_3d.py` creates ROS1-encoded MCAP topics
`/cdr01/pose` (`geometry_msgs/PoseStamped`) and `/cdr01/path`
(`nav_msgs/Path`). **ROS1 is only the wire format for visualization**;
the recording is from Gazebo Harmonic. This does not require a running ROS1
installation.

```bash
python -m pip install mcap
python scripts/export_lichtblick_3d.py experiments/garden_gazebo/latest_run.json \
  --output experiments/garden_gazebo/cdr01-3d.mcap
python -m unittest tests.test_lichtblick_3d -v
```

Open `cdr01-3d.mcap` in Lichtblick, add a **3D** panel, set the fixed
frame to `odom`, and enable the `/cdr01/pose` and `/cdr01/path` topics.
This should render the recorded pose/path **if the installed Lichtblick
version supports these ROS1 message types**; verify in the UI before claiming
acceptance. A full URDF mesh robot is **not** included: pose/path visualization
is the first step toward a robot model. There is no TF tree, no LiDAR cloud,
no live bridge and no mission-status panel yet.

Coordinates: `x_m`, `y_m` and `yaw_rad` in the flat-proxy odometry frame;
z=0, orientation is yaw-only. The path is emitted once at the end of the
recording, so it represents the complete recorded trajectory, not a live
incrementally growing path. Never infer real Garden surface physics.

**Important limitation:** timestamps start at zero relative to the recording.
They are not wall-clock ROS timestamps. This is a replay artifact only.


## Phase 3: robot-frame transforms and schematic URDF

The 3D exporter now writes a third ROS1-encoded MCAP channel, `/tf`
(`tf2_msgs/TFMessage`), containing recorded `odom -> base_link`
transforms. This is a replay-only transform stream, not live localization.

A visualization-only URDF is supplied at
`assets/robot/cdr01-visual-proxy.urdf`. It has a colored chassis, cargo box,
and two wheels to aid interpretation. **Its dimensions and geometry are
illustrative, not measured or validated CAD.** Do not use this URDF for
collision simulation, motor sizing, or mechanical design.

To inspect the model, import the URDF into a URDF-capable 3D panel or
robot-description workflow, and use the recorded `/tf` stream as the
`odom -> base_link` transform. Availability of local-file URDF loading
depends on the Lichtblick build. The URDF is not automatically bundled into
the MCAP, and the MCAP does not yet include `/robot_description`.

Run `python -m unittest tests.test_lichtblick_3d -v` to check the
serialization contract. A full end-to-end visual inspection in Lichtblick
is still required. Live ROS 2, Nav2, real LiDAR, battery telemetry and mission
dispatch are **not** implemented by this integration.

## Phase 4: CDR mission intelligence workspace (implemented, visual QA pending)

Run the existing loopback dashboard server:

```bash
python scripts/serve_dashboard.py --port 8765
```

Open `http://127.0.0.1:8765/studio`. The existing home dashboard now
links to the studio.

The studio is a **first-party CDR dashboard inspired by multi-panel robotics
tools**. It is **not a Lichtblick plugin or a fork of Lichtblick**. It
reuses the project's existing offline `/api/run` and
`/api/garden-gazebo-run` read-only endpoints. Its canvas visualizations
are 2D, while the earlier MCAP export can be opened in Lichtblick for 3D
trajectory inspection. The original 3D campus and Garden viewers remain
available through their existing routes.

Features:
- Source selector with explicit scripted-planar vs recorded-Gazebo provenance
- Mission scenario, destination and seed for planar simulation only
- Playback controls, scrubbing, XY trajectory and robot marker
- Position/derived-speed plots and recorded mission events
- Read-only boundary: no physical robot dispatch or actuator commands

Planar heading is inferred from adjacent XY positions for visualization;
it is **not a measured yaw sensor reading**. Recorded Gazebo heading is
taken from the odometry export. Speed is derived from sampled XY position
differences, not wheel encoder measurements.

Validation commands:

```bash
python -m unittest tests.test_lichtblick_studio tests.test_lichtblick_3d tests.test_lichtblick_mcap -v
```

The Garden recording is not committed to GitHub and must be generated
locally. Without it the Gazebo source intentionally reports an error rather
than substituting fake data.

**Pending acceptance:** run the tests, load both available data sources,
inspect desktop and mobile screenshots, open the exported MCAP in Lichtblick,
and verify URDF alignment with the replayed TF. Live ROS 2, live LiDAR,
battery measurements, real mission dispatch and a full native Lichtblick
custom panel are not yet delivered.
