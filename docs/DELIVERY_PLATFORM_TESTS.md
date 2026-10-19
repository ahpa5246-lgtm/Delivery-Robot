# Executed validation — 2026-10-19

Environment: Debian 13, Python 3.12.14, Node 24.19.0, pinned Yarn 4.17.0,
Chromium with software WebGL, Docker 28.4.0. Native implementation commit:
`ffd8927a7e347613eecc565f391e6cabec22babe`. Garden implementation commit:
`851c82685857a9d11260ed44d6e500e84739c148`.

## Outcomes

| Check | Actual result | Evidence |
| --- | --- | --- |
| Delivery Python suite | **102 passed**, no skips or failures | `evidence/lichtblick/delivery-python-tests.log` |
| Native MCAP reader + LayoutManager | **82 passed**, 2 suites | `native-mcap-layout-tests.log` |
| Native 3D Renderer, including JointState subscription regression | **98 passed**, 1 suite | `native-renderer-tests.log` |
| Native WebSocket worker/adapter/JSON writer | **18 passed**, 3 suites | `native-websocket-tests.log` |
| Delivery native presets/preservation/asset portability | **3 passed**, 1 suite | `native-workspace-tests.log` |
| Native test subtotal | **201 passed across 7 relevant suites**; not the entire upstream suite | Counts above |
| Garden coordinate/path math | **5 passed** | `garden-transform-tests.log` |
| Production build | **Passed**, 2 upstream bundle-size warnings | `production-build.log` |
| Immutable dependency install + setup repeat | **Passed**; application manifests and lockfile retained | Setup executed and repeated in the actual workspace |
| Targeted native ESLint and formatting | **Passed** | Current source checked with upstream tooling; correct first-party author header rule retained |
| Dependency license check | **Passed** with upstream's existing `gl-vec3@1.1.3` exception unchanged | `dependency-license-check.log` |
| Production native browser | **Passed** real MCAP/CAD fetch, decoded position changes, play/pause/seek, Space toggle, workspaces, resize, add panel, reload persistence, 1024px playback, missing-source error and empty Missions state | `browser-results.json`, `native-browser.log`, screenshots |
| Gaussian browser | **Passed** actual Gaussian renderer with explicitly synthetic plane, ground anchor, motion, pause/resume, camera follow, source guard and narrow capture | `garden-browser.log`, `synthetic-*.png` |
| ROS 2 Jazzy runtime | **Passed actual DDS publish/subscribe**, diagnostic text fixture only | `ros2-runtime.log` |
| Official ROS browser bridge installation | **Blocked**, signed repository request returned network `403` | `ros2-bridge-blocker.log` |
| Senior Skills workflow | **56 root + 22 manager tests passed**, documentation validator passed | Separate unchanged repository validated during onboarding |
| Framework visual evidence gate | **BLOCKED_UNVERIFIED_DESIGN** | `visual-gate-result.json`: remaining benchmark and per-journey state evidence is incomplete; not a runtime test failure |

Native browser automation does **not** claim machine-vision proof that the robot
is unobscured or aesthetically correct. The actual 3D robot and its positions were
also visually inspected in the screenshots. The 768px image is a capture, not a
full usability acceptance. No original Garden, live ROS browser bridge, physical
robot, Nav2/Gazebo dynamic trial, low-end device benchmark or Electron installer
was validated by this change.

## Reproduce

From `/workspace/Delivery-Robot`:

```bash
bash scripts/setup_telemetry.sh
.venv/bin/python -m unittest discover -s tests -v
node --test tests/garden-pose.test.mjs
bash scripts/check_ros2_runtime.sh
bash scripts/start_telemetry.sh
```

In another terminal, with Chromium installed:

```bash
node tests/native-platform-browser.cjs
# For the separate Gaussian viewer, first run python3 scripts/serve_dashboard.py
node tests/garden-browser.cjs
```

For selected native suites:

```bash
bash scripts/telemetry_yarn.sh jest --config packages/suite-base/jest.config.json --runInBand --runTestsByPath \
  packages/suite-base/src/services/LayoutManager/LayoutManager.test.ts \
  packages/suite-base/src/players/IterablePlayer/Mcap/McapIndexedIterableSource.test.ts \
  packages/suite-base/src/panels/ThreeDeeRender/Renderer.test.ts \
  packages/suite-base/src/players/FoxgloveWebSocketPlayer/worker.test.ts \
  packages/suite-base/src/players/FoxgloveWebSocketPlayer/WorkerSocketAdapter.test.ts \
  packages/suite-base/src/players/FoxgloveWebSocketPlayer/JsonMessageWriter.test.ts
bash scripts/telemetry_yarn.sh jest --config packages/suite-base/jest.config.json \
  --testMatch '**/web/src/delivery/workspaces.test.ts' \
  --roots "$PWD/vendor/lichtblick" --runInBand
bash scripts/telemetry_yarn.sh license-check
```

The source includes the original upstream fixtures and `packages/log` sources,
which legacy repository ignore patterns otherwise hid. They are tracked ordinary
files; fresh Git checkout does not depend on an untracked source cache.
