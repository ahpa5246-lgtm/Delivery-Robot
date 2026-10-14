# CDR-01 Mission Intelligence v2 — implementation and verification

## What is executable

Open the local dashboard with:

```bash
python3 scripts/serve_dashboard.py
```

Visit http://127.0.0.1:8765 (or the forwarded port in GitHub Codespaces). The new design makes the full-width WebGL campus the dominant first section and places the analytics, sensor integrity, experiments and activity below it. On a small screen it remains a single readable column.

The scene uses the existing self-hosted Three.js v147 renderer, backed by the **same immutable mission playback** produced by `cdr_sim/campus.py` that powers the 2D view. New self-hosted loaders decode source-author STL / Collada geometry, including genuine optimized robot chassis, wheels, camera enclosure, campus office, warehouse props and associated textures. See `dashboard/assets/SOURCES.md` for source URLs, original licenses, limitations and source modifications. The two full STL chassis are imported by `.github/workflows/import-approved-cad.yml`, which verifies the pinned Git blob digests and performs topology-aware face simplification. The imported geometry has not been physically calibrated to CDR-01.

## What each number actually means

| Display | Calculation / provenance | Caveat |
| --- | --- | --- |
| Distance traveled (m) | Cumulative step lengths from the Python replay | Scripted 2D route |
| Instant speed (m/s) | `frame.speed_mps` | Kinematic, not motor encoder |
| Average speed (m/s) | Modeled cumulative distance / elapsed simulated time | Includes stops |
| Peak speed (m/s) | Max stored speed among frames up to the current playback time | Sampled metric |
| Course (degrees) | `atan2(dy,dx)` of consecutive 2D simulated poses | Not an IMU yaw measurement |
| Replay progress (%) | Current replay time / mission duration | Not a measure of physical completion |
| Time remaining (s) | Last scripted timestamp minus current timestamp | Not real-world ETA |
| Energy (Wh) | Approximate base load plus energy-per-metre equation | Not electrical power instrumentation |
| Battery state of charge | Initial modeled SOC minus estimated Wh / estimated capacity | Not a BMS reading |
| Replans | Number of planner reroute events already observed in replay | Blockages are scripted |
| Energy/distance chart | Stored time series from actual returned replay frames | No fabricated sensor feeds |
| Course chart | Finite differences of stored X/Y poses | Low-speed heading should be treated cautiously |
| Mission phases | Proportion of recorded phase samples | Descriptive replay histogram |
| Archived Gazebo odometry | Separate historical GitHub Actions physics-run artifact | Different run, not current browser 3D animation |

The sensor integrity panel explicitly displays LiDAR, RGB-D, IMU and GPS as **not connected**. Do not present this UI as proof of live ROS 2 navigation or certified autonomous safety.

## Source integration scope

1. The real CAD files are direct upstream-derived binary geometry, served from an explicit route allowlist. They are distinct from the prior procedural box and cylinder placeholders.
2. The original collision world and mission planner are unchanged. CAD replacements are **visual**, with colors, placement and scale adapted for the browser.
3. The nine alternative designs remain selectable visualization profiles. Only selected profiles have imported CAD chassis; none runs an independently integrated ROS 2 controller in the browser.
4. The locally vendored loaders and geometry do not require a CDN. Model geometry is cached and renderer work is capped to 30 fps, with shadows limited and 2D fallback retained.
5. Imported Collada textures retain original relative paths where possible. The Clearpath office texture references are replaced by an existing local neutral texture during rendering; its original 3D vertex geometry is unchanged.

## Verification gates

- Run `python -m unittest discover -s tests -v`, including the new asset provenance and route allowlist checks.
- GitHub Actions browser workflow opens actual Chromium at 1440×900, 820×1024 and 390×844; checks 3D startup, upstream model selector, CAD asset fetches, plots, emergency stop, console errors and horizontal overflow. Screenshots are preserved in the job's artifact.
- Physics-ground-truth, LiDAR/IMU end-to-end Nav2, independent Gazebo path following and production safety certification are **not verified** by these tests.

To inspect a source license or compare geometry, consult `dashboard/assets/SOURCES.md` and `integrations/upstream_samples/*/LICENSE`. The public demo should say **visualized scripted delivery** and **separate measured Gazebo smoke-test evidence**, never **nine independently autonomous robots**.
