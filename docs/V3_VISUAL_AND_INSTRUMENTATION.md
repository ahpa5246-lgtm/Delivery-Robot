# CDR-01 v3 visual and model-instrumentation upgrade

## Purpose

This iteration improves the **actual executable prototype**, not presentation-only mockups. It keeps the single ROS/Gazebo model and Python replay architecture intact while addressing the floating-campus presentation, missing contextual instrumentation, and operator control ergonomics.

## What is implemented

### Interactive 3D scene

- Fixed open-source CAD geometry remains sourced from `dashboard/assets/SOURCES.md`, with the existing model loader and attribution unchanged.
- New `dashboard/environment-detail.js` adds instanced, procedurally authored campus landscaping, paving material, pedestrian markings, bollard-like fixtures, paths, lighting, bicycle stands, boundary landscaping, logistics items, and rooftop details.
- This new geometry is **visual-only**. It is neither an occupancy map update nor a Gazebo collision object; it must not be used to make safety claims.
- Visual lighting selector: Day, Evening, Night. These are appearance presets, **not** simulated solar irradiance, weather, environmental sensing, or battery load.
- New street-level camera and ray-cast destination picking on the 3D world. Clicking a destination requests an ordinary offline `/api/run` replay, never an actual robot command.
- The original 2D map mode, camera modes, CAD provenance, and source links remain.

### Computed measurements

`dashboard/engineering-audit.js` displays readings computed from the same JSON frames as the scene:

| Metric | Derivation | Limitation |
|---|---|---|
| Local position | Replay x/y (m) | Simulated state, not GPS |
| Linear acceleration | `(v[n]-v[n-1]) / (t[n]-t[n-1])` | Discrete sample approximation |
| Turn rate | Wrapped heading difference between consecutive moving frames / elapsed time | Heading not a real IMU |
| Power | `3600*(energy_wh[n]-energy_wh[n-1])/dt` | Estimated energy model, not real current |
| Direct target distance | Euclidean distance to destination or depot, depending on delivery stage | Not planned path length or ETA |
| Energy intensity | `1000 * modeled energy_wh / traveled_m` | Becomes meaningful only after some movement |
| Movement duty cycle | Accumulated moving-sample duration / elapsed simulated time | Model sample approximation |
| Last planned route length | XY polyline distance from the most recently issued path | Planner output, not measured travel |

The phase ribbon segments are proportional to actual simulated durations between recorded frames.

### Integrity gate

Before showing derived audit readings, the viewer checks:

- Every recorded pose, time, SOC, energy, speed and distance value is finite;
- Speed/distance bounds and campus boundaries;
- Timestamp order;
- Monotonic modeled distance and energy;
- Last frame distance and timestamp agree with the response totals.

An invalid replay displays **CHECK FAILED** instead of silently presenting inconsistent data. A passing replay displays **CONSISTENT**; that is an *internal consistency check*, not independent scientific accuracy or physical validation.

## Test protocol

- Python unit/integration tests verify that new static assets are properly allowlisted and path traversal remains blocked.
- Browser smoke test checks 3D scene generation, count of visual elements, lighting and world changes, new instrumentation fields, scenario safety stops, and absence of horizontal overflow across desktop/tablet/mobile.
- Take screenshot artifacts only from successful browser execution, while preserving early screenshots to diagnose failed builds.
- Existing Gazebo headless CI remains separate from this UI iteration and must not be relabeled as a live 3D navigation success.

## Known limitations

1. Even though some environment objects use actual licensed CAD from upstream ROS projects, much of the landscaping and furnishing is still author-generated, visually simplified geometry.
2. New scenic details do not affect simulated collision or planning; mismatches between what the viewer depicts and what the planner knows remain possible. They should be modeled as SDF collision geometry and tested before claiming realistic environmental interactions.
3. No calibrated LiDAR, IMU, motor or power measurements are connected.
4. No validated Nav2 full-stack mission has been established by this UI work.
5. Rendering performance is dependent on GPU and browser; 2D fallback remains available.

## Run

```bash
python3 scripts/serve_dashboard.py
```

Open `http://127.0.0.1:8765`. Use *3D WORLD*, *Street*, and *Lighting*. Scroll to **Movement and mission integrity** for derived metrics; archived Gazebo odometry remains separately identified.

## Future acceptance criteria

The next physically significant step is implementing the campus world inside Gazebo Harmonic with matching visual and collision assets, and testing a single CDR-01 robot's measured pose/velocity against independent Gazebo ground truth, LiDAR readings, and Nav2 navigation actions. Do not substitute this WebGL interface for those experiments.
