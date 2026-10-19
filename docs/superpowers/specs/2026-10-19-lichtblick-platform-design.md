# Delivery-Robot on the actual Lichtblick engine

The owner requires executable robotics analysis software in their existing personal repository, without a GitHub fork, merge or public deployment. Preserve existing simulation and PR #19 work. Replace the imitation studio with the real MPL-2.0 React application, vendored at upstream c5478a3d44a48467a741134cfed8ecd2325692c2. Preserve source copyright, license and dependency notices. Foxglove is a comparison reference only.

## Architecture

`vendor/lichtblick` contains the upstream source, lockfile and patches as ordinary files, not a submodule. Its native mosaic manager, 3D, Plot, Raw Messages, State Transitions, data sources, timeline and IndexedDB layout storage remain authoritative. Delivery customizations are isolated in the web entry and Delivery components, a graphite palette, preset workspaces and a source-labeled Missions panel. Local files and read-only MCAP replay are the default. Native upstream ROS2/Foxglove WebSocket support is available as an explicitly unverified connection path; it is not evidence of a working live robot.

The Python campus model exports actual executed replay into MCAP, with odom/base_link TF, schematic URDF and modeled odometry/mission data. No missing sensors are fabricated. Historical Gazebo data must retain its provenance. Generated recordings stay outside tracked source. The existing loopback API and Garden renderer remain separate. Garden changes fix coordinate and camera behavior; original-scene acceptance requires the missing licensed archive and cannot be replaced by a synthetic fixture.

## Workspaces and behavior

Perception emphasizes native 3D and available messages; Planning shows 3D/path and plots; Controls shows modeled position/speed with read-only operation; Diagnostics shows raw messages and source information. Missions is distinct from sensors. Workspaces are saved layouts using native persistence; switching does not recreate custom imitation panels. User changes are retained. Add/resize/drag panels and playback remain native Lichtblick operations.

## Acceptance and limits

Build the real engine, load an actual generated MCAP in Chromium, verify 3D robot/TF, plots and timeline play/pause/seek; capture desktop and narrow screens and comparison images. Tests must assert serialization and behavior, not only source text. Garden must be tested visually with a labeled substitute if the original remains absent; do not claim original acceptance. Inspect errors and perform independent review before delivery. Push to the existing feature branch and reuse PR #19 if writable; report API access blockers precisely. Do not merge or deploy.
