# Native Lichtblick campus and logistics scenery

The native 3D panel uses a **visual-only URDF layer** in the same `odom` frame
as the existing offline MCAP. No replay frames, robot CAD, mission data, topic
subscriptions, controllers, sensor estimates, navigation or energy model were
changed. Scene geometry is taken from `world/campus_layout.json`.

## What was added

- `assets/world/native-campus.urdf`: four source-aligned building footprints,
  articulated-looking façade details (static), paved paths, vegetation, benches,
  site lamps and TurtleBot 3 café-table geometry.
- `assets/world/native-logistics.urdf`: warehouse flooring, doors/walls and
  overhead steelwork, circulation lanes, actual AWS RoboMaker shelf meshes and
  source-aligned crate positions.
- Two separate native `foxglove.Urdf` layers in the **3D panel settings**.
  Campus is visible initially; Logistics is initially hidden. To change scenes,
  turn off the existing campus layer and turn on logistics (or vice versa).
  The bundled grid layer remains selectable.
- Migration adds these layers to old **Delivery-tagged** saved layouts, without
  resetting user cameras or unrelated imported URDFs. Layer source URLs rebase to
  the current Codespaces hostname on subsequent loads.

## Geometry and provenance

The scene environment is NOT a new collision world. Building footprints and
fixture locations are derived from the shared JSON, but decorations (façades,
trees, materials, warehouse walls, circulation colors) are presentation geometry
only. They are not measured or photogrammetrically scanned university buildings.
No real LiDAR, physics, dynamic collision or Nav2 execution is implied.

Meshes already present in this repository were reused rather than redrawn:
- `cafe-table.dae` — [ROBOTIS turtlebot3_simulations](https://github.com/ROBOTIS-GIT/turtlebot3_simulations), Apache-2.0.
- `warehouse-shelf.dae` — [AWS RoboMaker small warehouse](https://github.com/motomechatronics/aws_robomaker_small_warehouse_world), MIT-0.

The existing `dashboard/assets/SOURCES.md` contains file-by-file provenance.
All assets are local, not hotlinked to third-party CDNs. COLLADA supporting
textures are copied preserving the original `../materials/textures` paths.
No physics performance conclusions can be made from attractive renderings.

## Run / verification

```bash
bash scripts/setup_telemetry.sh
bash scripts/start_telemetry.sh
python3 -m unittest tests.test_native_environment -v
```

Load the modeled MCAP demo in native Lichtblick. Open **Perception** or
**Missions**, expand the 3D panel settings, and toggle Campus / Logistics layers.
Confirm the static site stays fixed during play, pause, seek, and camera orbit,
while the original robot pose and original plots continue to update. Existing
user-selected layouts may require reopening after first migration.

## Validation boundary

Static source checks validate XML, geometry positions, local asset references and
replay isolation. A production Webpack build, real WebGL scene, screenshot,
performance benchmark and user Codespaces session need separate browser runs
before these changes can be called visually accepted. The source meshes (including
COLLADA materials) must be checked in Chromium, not judged only by their filenames.
