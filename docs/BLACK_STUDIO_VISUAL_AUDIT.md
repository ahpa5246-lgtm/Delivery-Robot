# Black Studio visual acceptance against Lichtblick

Reference: https://github.com/Lichtblick-Suite/lichtblick

## Regressions
- Old dashboard is vertically stacked and uses large blue-teal surfaces.
- Robot is missing from real Gaussian Garden on initial screenshot.
- Synthetic campus looks like a low-poly illustration, not a realistic scan.
- Recorded simulation must not be mislabeled as live hardware telemetry.

## Current changes
- Applied near-black graphite themes to the main dashboard, telemetry studio and Garden controls.
- The Garden renderer attempts a camera-relative visual robot preview immediately on loading; manual ground placement remains available.
- The preview is explicitly not registered to the terrain and does not simulate collision.
- Did not alter the colors of the original Garden Gaussian data or fabricate LiDAR scans.

## Acceptance checks still REQUIRED
1. Upload the authentic Garden ZIP as assets/gaussian-garden.zip and run bash scripts/start_codespaces_full.sh.
2. Open /robot-garden and /?view=garden and capture desktop screenshots after loading.
3. Confirm robot silhouette visible before manual ground placement. Fail if offscreen, occluded or too small.
4. Pick a lawn patch and verify robot remains visible after orbit/replay, with correct readouts.
5. Verify /studio at 1440, 1024 and 390 pixel widths, with useful pane grouping.
6. Run Python and browser E2E tests and save exact outputs.
7. Compare screenshots against Lichtblick and record remaining functional and visual differences.

## Unresolved
- This branch is NOT a full Lichtblick fork or equivalent dockable panel interface.
- Ground registration, Garden physical collision and full 3D robot model remain unverified.
- No live ROS2/LiDAR stream or verified Garden physics is claimed.