# Delivery-Robot native robotics platform

This branch incorporates the actual Lichtblick React application in this personal
repository. It is **not** a GitHub fork, submodule, HTML imitation or link to a
remote Lichtblick deployment. Upstream source is pinned to
`c5478a3d44a48467a741134cfed8ecd2325692c2` (package version 1.29.1).

The implemented release is a **verified offline development platform**, not a
completed live robot digital twin. Original Garden acceptance and the live ROS 2
bridge remain blocked as described below. Nothing was merged or publicly deployed.

## Run

Prerequisites: Python 3.11+, Node 20+, Bash and network access to the package
registries. This environment was tested with Python 3.12.14 and Node 24.19.0.
Chromium is required only for browser validation. Docker is required only for the
optional ROS 2 runtime check.

```bash
cd /workspace/Delivery-Robot
bash scripts/setup_telemetry.sh
bash scripts/start_telemetry.sh
```

Setup installs pinned Python telemetry packages and Yarn 4.17.0, installs the
upstream immutable lockfile, exports a fresh modeled MCAP and builds the native web
application. Startup serves the compiled application on loopback port **8080**,
including HTTP byte ranges for the recording. The first launch opens the explicitly labeled modeled demo automatically.
**Load modeled demo** restores it after selecting another data source.
`PORT=8082 bash scripts/start_telemetry.sh` selects another loopback port.

For development with hot reload:

```bash
bash scripts/start_telemetry.sh --dev
```

Rebuild after source changes with `bash scripts/build_telemetry.sh`. Installation
and build outputs are ignored; do not commit `.venv`, `.tools`, `.cache`,
`node_modules`, `.webpack` or generated MCAP files. Future cloud tasks should use
the existing isolated checkout, without creating another worktree.

## What is actually implemented

- The native Lichtblick mosaic engine supplies draggable, resizable, addable
  panels, timeline play/pause/seek, settings, topic inspection and IndexedDB layout
  storage. These are reused source components, not first-party substitutes.
- Perception, Planning, Controls, Diagnostics and Missions are distinct native
  saved layouts. Initial presets seed once; subsequent edits and selected layout
  survive switching and reload. Native layout import/export remains available.
- The default palette is black/graphite with restrained technical accents. The
  first empty inspector is hidden to preserve viewport space; native sidebar
  controls reopen it. User-selected theme preferences remain supported.
- A real MCAP contains executed campus replay: `/tf`, `/odom`, `/robot_description`,
  `/cdr01/path` and `/cdr01/mission`. ROS1 wire encoding is used for these standard
  messages; this does not imply a ROS1 installation or native ROS2 CDR recording.
- Native 3D follows `base_link`. A locally bundled URDF visual assembly uses the
  existing Apache-2.0 rbot chassis/wheel CAD. Its adaptation and cargo geometry are
  illustrative, not a validated mechanical design or collision model. The MCAP's
  self-contained schematic URDF is also available by enabling `/robot_description`
  and disabling the custom CAD layer.
- Plots, raw messages, State Transitions and the read-only Missions panel share
  native playback. Missions shows phase, status, speed, distance, modeled energy
  and estimated charge. It does not dispatch robots or claim measured battery data.
- Valid JointState schemas now subscribe without requiring a nonexistent topic
  visibility checkbox. No `/joint_states`, LiDAR, camera, GPS or motor stream is
  fabricated by the default recording.
- The existing Gaussian viewer has corrected ROS-to-scene handedness, consistent
  metre distance labels, numeric guards, selected ground placement, scale controls,
  focus and chase/side/top follow cameras. Its bounded path overlay shares the
  robot transform and playback time. Manual interaction cancels stale replay.
- Arbitrary uploaded scenes retain their filename and unverified provenance.
  Original-Garden calibration export requires the identified archive; the server
  now verifies its SHA-256, not merely its ZIP shape.

## Data boundaries

The bundled demo is `campus_kinematic_replay`, not hardware, Gazebo, localization
accuracy, wheel encoders or live ROS2. Heading is inferred from adjacent modeled
positions; angular velocity and covariance are not calibrated measurements. An
empty covariance array value of zero must not be interpreted as zero uncertainty.
Model context repeats in the recording so newly opened native panels receive it.

Existing historical Gazebo exporters remain separate and require their actual
recording. No raw Garden Gazebo recording or physical-world MCAP was available
here. The native engine can open other supported MCAPs through its file dialog;
supply their correct schemas, frames and provenance. JointState subscription
coverage is tested; no articulated physical robot recording was provided for
end-to-end acceptance.

## ROS 2 and remaining bridge blocker

The pinned official image is:

```
ros:jazzy-ros-base@sha256:103b6c417973394659af6804d4917cd489b91e5ed22eb7bef263025a3bed2410
```

`bash scripts/check_ros2_runtime.sh` exercises actual Jazzy DDS publish/subscribe
with an explicitly diagnostic text fixture. It passed. This validates the ROS
runtime, **not** a browser-to-robot bridge. Docker images/processes are separate
from the retained source; rerun the check/pull when needed in a restored task.

The native Foxglove WebSocket and ROS bridge data-source implementations are
retained. Their relevant protocol tests passed. Installation of the official
`ros-jazzy-foxglove-bridge` package stopped at a network `403` for the signed ROS
repository. No signature/TLS checks were disabled. Once `packages.ros.org` is
allowed in environment settings, install the official bridge in the Ubuntu Jazzy
runtime and verify `/tf`, `/odom`, valid joint states, disconnect/reconnect and
source labeling against the actual system. The legacy dashboard already uses
port 8765; use a distinct bridge port such as **8766**. Do not expose a robot bridge
publicly or infer live operation from a selectable connection type.

## Garden acceptance remains incomplete

The original `assets/gaussian-garden.zip` is absent. Its expected SHA-256 is
`e2c82908d3c871c47dc4e6498529944afaebd7d01cf130b65aa0bf01202086c3`.
A real Gaussian renderer was tested with a generated, explicitly named
`SYNTHETIC-TEST-PLANE.ply`: a grounded robot moved between two positions, telemetry
updated, pause/resume held and advanced the pose, and narrow-screen rendering
was captured. This does not test original Garden occlusion, terrain registration,
initial placement or physical collision. No validated terrain mesh exists.

To run the separate Garden tool: `python3 scripts/serve_dashboard.py` (loopback
port 8765). Select a known ground anchor before showing the robot; the rejected
camera-relative floating preview has been removed. Load the original archive and
perform its actual visual acceptance before declaring that requirement complete.

## Validation and evidence

See [test report](DELIVERY_PLATFORM_TESTS.md), [visual comparison](DELIVERY_PLATFORM_VISUAL_REVIEW.md)
and [open-source notices](THIRD_PARTY_NOTICES.md). Screenshots are actual Chromium
captures under [evidence/lichtblick](evidence/lichtblick/), not generated mockups.

The native engine's production bundle is substantial (about 7.6 MiB for the main
entry before HTTP compression); upstream Webpack reports size warnings. Desktop
and 1024/768-pixel windows were exercised, not low-end-device certification or a
mobile-app redesign. The full upstream suite and Electron packaging were not run.

Git access works. GitHub API requests returned `403`, preventing inspection or
conversion of PR #19's current draft status. Continue on the existing
`feature/lichtblick-mcap-integration` branch; do not create duplicate work. Required
network additions were saved to the environment draft: `api.github.com`,
`repo.yarnpkg.com`, `foxglove.dev`, `packages.ros.org`. Saving the draft does not
apply those changes to this running machine or publish the environment.

## Existing GitHub Codespaces

After pulling updated `main`, use the command palette (`Ctrl+Shift+P`) and run
**Codespaces: Rebuild Container**. The container now installs Node.js 24, npm and
Python venv support and forwards port 8080. A running container does not acquire
new dependencies just by pulling files.

After the rebuild, run from the repository root:

```bash
bash scripts/setup_telemetry.sh && bash scripts/start_telemetry.sh
```

Open port **8080** in the Ports tab. Setup can take several minutes. Using `&&`
ensures the server starts only after setup succeeds. The setup preflight and
container JSON were checked; a fresh GitHub Codespaces rebuild must still run
in the user's Codespace.
