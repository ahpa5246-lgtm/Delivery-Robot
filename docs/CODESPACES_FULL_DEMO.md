# Complete Codespaces demo: actual Garden + recorded Gazebo physics

This guide covers the **integrated web demo**. It does **not** promise a graphical
Gazebo desktop, real Garden friction or Garden obstacle collision. The physics
is executed in headless Gazebo Harmonic on an **8 m flat proxy**, then
its recorded odometry is re-rendered as a robot inside the photographic 3DGS.
Campus graphs elsewhere on the dashboard are still from the independent
scripted Python simulator.

## 1. Open Codespaces

1. In [Delivery-Robot](https://github.com/ahpa5246-lgtm/Delivery-Robot),
   click **Code → Codespaces → Create codespace on main**.
2. Codespaces uses the repository's ROS 2 Jazzy + Gazebo Harmonic devcontainer.
   If you started an old container before this Dockerfile, use
   **Codespaces: Rebuild Container** in the VS Code command palette.
3. Obtain the original **113.36 MB, CC BY 4.0** Garden LOD archive from
   [Mip-NeRF 360 Garden on SuperSplat](https://superspl.at/scene/bc0906cd).
   Upload it through the Codespaces file Explorer into
   `assets/gaussian-garden.zip` (exact filename).
   **Do not** unzip it, substitute another asset or commit the ZIP to GitHub.
   The launcher validates its original SHA-256 and LOD manifest.

## 2. One launch command

From the repository root inside Codespaces, run:

```bash
bash scripts/start_codespaces_full.sh
```

The launcher (a) validates the original Garden ZIP, (b) checks the flat-proxy
calibration, (c) runs and stops a genuine ROS 2 → Gazebo Harmonic trial, (d)
extracts recorded odometry into `experiments/garden_gazebo/latest_run.json`,
and (e) serves the interactive dashboard on **port 8765**.

Go to **Ports**, select `8765`, set visibility to **Private**, and choose
**Open in Browser**. Keep the launcher terminal running.

- The page defaults to **GARDEN + ROBOT · 3DGS**.
- The PlayCanvas Garden will load automatically when the original ZIP is present.
- Orbit to view grass / paving, click **Place on lawn**, and select a visible
  point to place the robot on an assumed visual height plane.
- Click **Settings → Replay recorded Gazebo Garden-proxy run**, then **Play**.
  The recording and source-specific statistics appear in the same dashboard.
- Switch to **ROBOT SIMULATION** for the separate synthetic campus model
  or **2D MAP** for its planner. Neither is Garden's physical terrain.

The first run uses `world/garden_calibration_example.json` unless you have
already uploaded a selected `assets/garden-calibration.json`. This *placeholder*
does not align the Garden in metric coordinates.

## 3. Calibrate selected Garden origin, then rerun the physical experiment

In **Settings**, select an estimated **metres per scene unit** and click
**Export selected Garden origin for Gazebo**. Upload the downloaded
`garden-calibration.json` to `assets/garden-calibration.json`.
Run in a **second Codespaces terminal**, leaving the web server running:

```bash
bash scripts/run_garden_gazebo.sh assets/garden-calibration.json
```

Back in the browser, click **Replay recorded Gazebo Garden-proxy run** again.
The transform/scale is still operator-estimated, not geodetically surveyed.
Actual lawn slopes and tree/hedge/table collisions remain **unimplemented**.

## Diagnostics

```bash
bash scripts/start_codespaces_full.sh --check
python3 -m unittest tests.test_garden_physics -v
cat experiments/garden_gazebo/latest_run.json
```

If you only need the visual web dashboard without recording a new Gazebo
experiment, run `bash scripts/start_codespaces_full.sh --skip-physics`.
If the original ZIP has not been uploaded, the complete Garden demo **cannot**
run; to view only the synthetic campus, start `python3 scripts/serve_dashboard.py`
and open the Codespaces port `8765` at `/?view=campus`.

**What this does not provide:** a live Gazebo GUI window in Codespaces (a
remote desktop / noVNC setup would be required), a live bidirectional
Gazebo-to-browser control loop, metric Garden registration, Nav2 navigation
inside the Garden, or reconstructed collision meshes.
