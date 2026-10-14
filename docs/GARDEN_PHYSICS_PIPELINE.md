# Garden physics and recorded odometry — experimental milestone

## What is genuinely implemented

- The **real captured Garden** remains the first-party PlayCanvas Gaussian Splat scene loaded from your
  `assets/gaussian-garden.zip` (SHA256 `e2c82908d3c871c47dc4e6498529944afaebd7d01cf130b65aa0bf01202086c3`).
- **Gazebo Harmonic** can run the existing 25 kg differential-drive CDR-01 with physical gravity,
  rigid ground contact and original wheel joints on a local **flat horizontal contact pad**.
- Gazebo odometry is recorded from its actual simulation topic, parsed with timestamps and quaternions,
  summarized and made available at `/api/garden-gazebo-run`.
- The visual Garden viewer can import this recorded data and replay the route on its visual ground
  anchor, with dedicated source-labeled readouts in the full dashboard.
- **No artificial sample path is presented as Gazebo data**: the endpoint is unavailable
  until a raw Gazebo recording is processed.

## Scientific limits (important when presenting to the professor)

This is a milestone in the integration, **not yet accurate Garden terrain physics**.
We have no metrically surveyed transformation, lawn heightfield, table geometry, hedges,
grass friction model, pedestrian obstacles or calibrated LiDAR in the Garden SDF.
The Gaussians are a photometric representation; they are not a collision mesh. The robot
runs on a flat pad local to an operator-selected anchor; the Garden backdrop may contain
objects through which the robot will pass. Recording quality proves *Gazebo odometry*,
not ground-truth correctness or physical robot behavior.

The current single-unit scale in the example calibration is **only a placeholder**.
Do not call scene units physical metres without a surveyed known-length reference.

## Run from Codespaces (ROS 2 Jazzy / Gazebo Harmonic environment)

1. Start the Python server and open the dashboard on port 8765. In Garden view
   orbit to visible paving/grass, choose **Place on lawn**, then click your actual
   origin point. In Settings, estimate **metres per scene unit**, and press
   **Export selected Garden origin for Gazebo**.
2. Upload the resulting small `garden-calibration.json` to `assets/` in Codespaces
   (the large Gaussian ZIP is already installed there). The export marks
   `terrain_collision_verified: false`; do not change that flag.
3. From a separate Codespaces terminal:

   ```bash
   source /opt/ros/jazzy/setup.bash
   bash scripts/run_garden_gazebo.sh assets/garden-calibration.json
   ```

   The script runs a short real Gazebo physics experiment, records an actual Odometry
   topic, sends an explicit zero-velocity command, and terminates its disposable
   simulator. It writes `experiments/garden_gazebo/latest_run.json`, raw messages,
   and Gazebo logs, plus a `simulation/garden_physics_proxy.provenance.json`.
4. In your open Garden viewer click **Settings** and then
   **Replay recorded Gazebo Garden-proxy run**. Use **Play/Pause/Reset**.
   The map is visually overlaid at the selected anchor and converted by the
   estimated scale. The source badge explicitly states *Gazebo flat pad / not Garden collisions*.
5. Do not conflate the separate, historical Python campus graphs with the Garden
   Gazebo run. The Garden-specific pose readouts are source-labelled.

To generate just the SDF without running Gazebo:

```bash
python3 scripts/generate_garden_gazebo.py \
  --calibration assets/garden-calibration.json \
  --output simulation/garden_physics_proxy.sdf
gz sdf -k simulation/garden_physics_proxy.sdf
```

## Next physics milestone

Generate a candidate collision mesh from the **actual splat** using
[splat-transform](https://github.com/playcanvas/splat-transform). It supports
multi-LOD SOG inputs and voxel / `.collision.glb` outputs. The vendor's
[collision guide](https://developer.playcanvas.com/user-manual/splat-transform/collision/)
specifies `--voxel-floor-fill` for exterior surfaces. This step often needs a GPU
(ideally the user's RTX 3090, not the CPU-only GitHub Codespace). Validate scale,
origin and axes, walkable surfaces, obstacle collisions and 3+ surveyed landmarks,
then convert a reviewed mesh to Gazebo-compatible collision geometry. Only then
can Garden obstacles and grass contact be claimed as physically simulated.

No cloud machine and no GPU is needed to *view previously recorded runs*.
Live new Gazebo commands still require an active simulation process.

## Stop-response acceptance through ROS 2

The first actual Gazebo run revealed that a direct `gz topic` zero command
did not stop DiffDrive. The simulation now publishes to
`/robot1/cmd_vel_requested` through the existing `ros_velocity_watchdog.py`
and `ros_gz_bridge`. The watchdog publishes zeros repeatedly after input
expires. A recording passes only when Gazebo odometry shows both displacement
of at least 0.10 m and final-two-second mean speed at or below 0.08 m/s.
This is software-only, not a physical safety-rated stop.
