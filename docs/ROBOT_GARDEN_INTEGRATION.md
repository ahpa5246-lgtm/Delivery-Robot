# Real Gaussian Garden + robot, shared renderer (experimental)

This is a **different integration** from the visual-only SuperSplat iframe.
Open `/robot-garden` after starting `python3 scripts/serve_dashboard.py`.

The actual CC BY 4.0 model download requires a **free signed-in SuperSplat session**. An unauthenticated headless-browser attempt on 2026-10-14 returned `Please log in to download this splat.` We have **not downloaded the Garden model yet**. Sign in yourself on [the original Mip-NeRF 360 Garden scene](https://superspl.at/scene/bc0906cd), use Download, and select its actual `.sog`, Gaussian `.ply`, `.spz`, or `.json` content file in the `/robot-garden` page. Do not share passwords or session cookies. The file is loaded in the browser, not uploaded to our server. The scene owner lists it as CC BY 4.0. A third-party CDN-hosted, version-pinned MIT PlayCanvas viewer creates one graphics engine instance. A CDR-01 3D robot mesh is added to the **same** scene graph, camera, and renderer. Neither an iframe nor a video is involved.

This is a **visual proof of integration, NOT yet a valid Garden Gazebo simulation**. A developer must survey at least 3 ground control points, fit a metric frame transformation, reconstruct a solid ground and obstacle collision map, and run Gazebo against that geometry. A Gaussian Splat alone does not model contacts. PlayCanvas viewer only moves visible entities; the browser does not calculate a robot's actual motor torque, battery, or LiDAR. This preview intentionally displays prominent warnings until validated.

Movement paths are strictly opt-in and labeled:
- *Manual positioning*: user controls directly, not robotics physics.
- *Scripted campus replay*: from `/api/run` (2D Python surrogate) and **not** Gazebo.
- *Imported Gazebo odometry*: CSV headers `time_s,x_m,y_m,yaw_rad`; recorder provenance should be preserved. Still not necessarily accurate to the real Garden.

The importer currently uses third-party CDN JS, and the user must acquire the source file. Browser-compatible GPU and CORS are required. Original remote scene embed remains a separate source preview. The public SuperSplat scene page did **not** expose a stable direct model URL to our automated cloud inspection (2026-10-14).

Don't tell instructors that the robot's plotted path is a verified physical operation in the Garden. To establish it, add the Garden collision geometry to Gazebo, run recorded experiments, and publish collision/odometry/ground-truth validation.

## Provenance and code separation

- `https://github.com/google-research/multinerf` is a research implementation of Mip-NeRF 360 (Apache 2.0), **not** the published Gaussian Garden asset. We do not need to retrain this 2026 splat.
- The creator's workflow is [transkatgirl's 3DGS article](https://transkatgirl.github.io/writings/2026/my-3dgs-workflow.html). It includes `splat-transform` export and voxel generation; generated visual collision voxels are *not* a validated Gazebo mesh.
- Preserve credit: *Mip-NeRF 360 "Garden" – transkatgirl, CC BY 4.0. Original capture data: Mip-NeRF 360.*
- Once acquired, keep the >100 MB Garden asset **out of ordinary Git commits**. Use an asset store (e.g. GitHub Release / object storage) after reviewing download license and CORS; locally it can be loaded through the file picker, and recordings must report their provenance.
- Required before claiming robot motion **inside a physically simulated Garden**: known metric scale and frame rotation, surveyed registration, ground/obstacle collision representation with test cases, Gazebo loaded with the Garden collision world, and a recorded ROS2/Gazebo run with synchronized pose and independent ground truth.

## Original Garden ZIP received and verified (2026-10-14)

The user supplied a 113.36 MiB uncompressed/ZIP-stored original SuperSplat
multi-file **LOD archive** with 98 entries: `license.txt`, `lod-meta.json`,
and WebP/Gaussian metadata in 12 tile directories. Verified by `ZipFile.testzip()`
(no errors) and `lod-meta.json` references (all present). SHA256:

`e2c82908d3c871c47dc4e6498529944afaebd7d01cf130b65aa0bf01202086c3`

**Place the ZIP itself** at `assets/gaussian-garden.zip` inside your
Codespace (GitHub editor Explorer → assets folder → Upload), then run
`python3 scripts/serve_dashboard.py` and open `/robot-garden`.

The dashboard server exposes only whitelisted archive contents under
`/garden-assets/...`; the PlayCanvas viewer loads its
`/garden-assets/lod-meta.json` and streams child tiles as needed. The
original file does **not** belong in ordinary Git (exceeds 100MB single-file
limit). No second, larger source file is necessary merely to render the LOD
capture. The physics/collision limitations documented above still apply.

Confirm installation using `/api/garden-asset`, which responds with
`{"installed": true, "entries": 98, "lod_levels": 4}` when detected.
If the user chooses a separate Codespaces workspace, the ZIP must be
transferred into that workspace; uploads attached in ChatGPT are not
automatically present in GitHub or Codespaces.

## No external SuperSplat website sidebar

The root Garden tab routes directly to `/robot-garden`, where the PlayCanvas
`createViewer` loads the 3DGS LOD ZIP with `ui:false` and adds the CDR robot
as an engine entity. No third-party iframe is used. The user sees a large
Garden renderer and compact manual robot controls. Advanced calibration and
replay settings are collapsed by default. A camera-relative visual placement
keeps the robot in view on first load but **does not** align it to the floor:
it must never be misrepresented as physical contact, collision avoidance, or
a valid Gard​en Gazebo run. The genuine ZIP must already be in Codespaces.

## Full dashboard retained and no floating robot

The first-party real Garden viewer is now embedded inside the full existing
mission studio, using a **same-origin** `/robot-garden?embed=1` component.
The actual Gaussian data and robot mesh continue to live in one PlayCanvas
renderer inside that component. Dashboard mission controls, analytics, physics
archive and diagnostic widgets remain present. Their output is explicitly
from the **separate scripted campus** and must never be attributed to the
Garden capture. A small dedicated manual Garden readout receives verified
same-origin pose events and labels distances as *uncalibrated scene units*.

The old auto spawn in front of the camera was removed after a screenshot
showed the robot floating above the hedges. **On each model load the robot
starts hidden**, and the user is prompted to choose a patch of lawn/paving
in the 3DGS rendering. Screen coordinates are projected as a ray against
a configurable horizontal Y-plane (initial -2.0 scene units); the robot
base is placed at the intersection. If ray/plane intersection fails, no
flying robot is shown and a clear error is displayed. The floor-Y field
can be adjusted by the operator. The plane is a user calibration aid,
not an actual Gaussian collision mesh, so this remains visual-only.
The physical Gazebo world remains to be reconstructed.
