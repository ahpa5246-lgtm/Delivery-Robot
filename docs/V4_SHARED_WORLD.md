# V4 – shared physical-obstacle world and navigation diagnostics

## Why this exists

Previous browser scenes created solid-looking scenery in JavaScript that the
2-D route planner did not know existed. The 3-D animation could therefore run
through furniture. This release removes those independent placements and
uses **one source of geometry**:
[`world/campus_layout.json`](../world/campus_layout.json).

This makes **known static 2-D obstacles** consistent across the online viewer,
the offline A* collision checks and the generated Gazebo SDF collision proxies.
It does **not** make Three.js a physics simulator or complete a Nav2 mission.

## Shared data and authoritative interfaces

- `/api/map?world=campus|warehouse`: the selected campus dimensions,
  building rectangles, individual solid fixtures, registered robot size
  and local station coordinates.
- `/api/occupancy?world=campus|warehouse`: all robot-inflated cells in the
  selected grid, derived from `Campus.free`.
- `/api/run?...&world=campus|warehouse`: replay against exactly that world's
  fixtures. Unsupported theme or duplicate parameters return HTTP 400.
- `scripts/generate_campus_gazebo.py`: emits campus and warehouse SDF with
  static box collision and visual geometry for every declared object.

Browser assets retain their respective upstream source references and license
attributions from `dashboard/assets/SOURCES.md` and
`integrations/reference_catalog.json`. Referenced CAD furniture is placed
only by manifest item, and is rejected if it extends beyond that item's
declared footprint. The source-licensed CAD is supplemental detail; collision
proxies are simpler than the original triangle meshes for repeatability.

## Continuous safety checks

`Campus.visible(a,b)` combines an occupied-grid **supercover** traversal with
an exact, conservative 2-D line-segment/AABB intersection against every
static fixture. Obstacles are inflated by robot radius plus an additional
10 cm modeling margin. This prevents direct shortcuts which cross an object
between grid samples. Each replay increment is collision checked again before
the position advances. A failed check causes a safe stop.

The result records `collision_checked`, `collision_objects` and
`minimum_sampled_clearance_m` together with a geometry schema identifier.
The browser independently re-checks the replay's recorded line segments
against its copy of the selected collision rectangles and displays:

- Known-static-world route validity and number of crossing segments.
- Current nearest modeled obstacle clearance.
- Declared solid count and count of robot-inflated grid cells.
- Optional wireframes for solid proxies, occupancy visualization and the
  robot radius plus clearance margin.

These are **offline geometry tests**, not a guarantee against moving
people, unmodeled obstacles, sensor error, wheel slip or incorrect calibration.

## Real Gazebo vs web replay

The real Gazebo workflows still separately verify ROS/Gazebo infrastructure
and capture odometry in a simulator. The newly generated **campus/warehouse
SDF worlds** contain static collision geometry copied from the planner
manifest, and can be syntax-checked by Gazebo; this is not yet evidence of
a full autonomous cargo run with Nav2 or physical ground-truth validation
in those two newly furnished worlds.

Unmodeled collision risks remain: exterior traffic, pedestrians, or any CAD
part that protrudes beyond its certified proxy, articulated motion, and
robot height/turning envelope. Different visual robot profiles do not change
the true planner radius; CDR-01 remains the sole kinematic vehicle.

## Acceptance tests

```bash
python3 -m unittest discover -s tests -v
python3 scripts/generate_campus_gazebo.py
python3 scripts/serve_dashboard.py
```

CI additionally checks browser behavior in Chromium at desktop, tablet and
phone sizes. It must validate both selected world themes, fixture world
provenance, optional debug layers, absence of known collisions, and E-Stop.

The renderer and planner never treat a source model's complex appearance
as a reliable collision mesh without a validated simplified footprint.
