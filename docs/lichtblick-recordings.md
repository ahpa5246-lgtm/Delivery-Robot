# Delivery campus recordings in Lichtblick

From the repository root:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-telemetry.txt
.venv/bin/python scripts/export_delivery_recording.py --output /tmp/cdr01-campus.mcap --seed 0 --scenario clear
.venv/bin/python -m unittest tests.test_delivery_recording -v
```

Open the generated MCAP using Lichtblick's **Open local file** control. Choose
`odom` as the 3D fixed frame; enable `/tf`, `/odom`, `/cdr01/path` and add the
robot-description topic `/robot_description` as a Robot model. The schematic
URDF has primitive geometry and fixed joints; it is not validated CAD.

Useful Plot paths include `/odom.pose.pose.position.x`,
`/odom.pose.pose.position.y`, `/cdr01/mission.speed_mps`,
`/cdr01/mission.distance_m`, `/cdr01/mission.energy_estimated_wh`, and
`/cdr01/mission.soc_estimated`. Raw Messages can inspect `/cdr01/mission` for
phase, status, reason and explicit provenance. A progressive `nav_msgs/Path`
shows only the trajectory traveled at the current replay time.

Scenarios are `clear`, `construction`, `estop`, and `sensor_dropout`. Their
fault events are scripted by the existing Python campus model. The final
mission payload preserves the simulator's final status and reason. The seed
and scenario are included in each mission message. Identical inputs produce
identical timestamped payloads; timestamps start at zero simulation time.

## Source and format boundaries

This exporter calls `cdr_sim.campus.replay` directly. Every channel and mission
message labels the source `campus_kinematic_replay`; `live` is false. Position,
velocity, path, state of charge and energy belong to this offline kinematic
model. Energy is estimated, not battery telemetry. There are no camera, LiDAR,
GPS, wheel encoders or motor-current channels.

The file contains ROS1-wire schemas inside an MCAP container. It does not
constitute a ROS2-native CDR recording or a live ROS connection. `/tf` supplies
`odom` → `base_link`; the URDF supplies the fixed accessory joints. No
`/joint_states` stream is invented. Odometry covariances are unset (zero); they
are not calibrated uncertainty estimates. These poses use the campus map;
they have not been calibrated to the Garden Gaussian splat.

Recorded Gazebo odometry remains a separate source through the existing
`scripts/export_lichtblick_mcap.py` utility. Do not label campus replay as
Gazebo data. Garden collision terrain and physical collision behavior are not
validated by either exporter.

The standard ROS1 message definitions follow ROS common interfaces under
BSD licenses. The installed `mcap` and
`mcap-ros1-support` package metadata both declare the MIT License. Consult the
upstream MCAP repository for complete notices, including its vendored ROS code. Lichtblick reuse and MPL
notices are documented separately by the application integration.
