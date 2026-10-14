# Real Gaussian Garden + robot, shared renderer (experimental)

This is a **different integration** from the visual-only SuperSplat iframe.
Open `/robot-garden` after starting `python3 scripts/serve_dashboard.py`.

Use **Download** on [the original Mip-NeRF 360 Garden scene](https://superspl.at/scene/bc0906cd) and select its actual `.sog`, Gaussian `.ply`, `.spz`, or `.json` content file. The scene owner lists it as CC BY 4.0. A third-party CDN-hosted, version-pinned MIT PlayCanvas viewer creates one graphics engine instance. A CDR-01 3D robot mesh is added to the **same** scene graph, camera, and renderer. Neither an iframe nor a video is involved.

This is a **visual proof of integration, NOT yet a valid Garden Gazebo simulation**. A developer must survey at least 3 ground control points, fit a metric frame transformation, reconstruct a solid ground and obstacle collision map, and run Gazebo against that geometry. A Gaussian Splat alone does not model contacts. PlayCanvas viewer only moves visible entities; the browser does not calculate a robot's actual motor torque, battery, or LiDAR. This preview intentionally displays prominent warnings until validated.

Movement paths are strictly opt-in and labeled:
- *Manual positioning*: user controls directly, not robotics physics.
- *Scripted campus replay*: from `/api/run` (2D Python surrogate) and **not** Gazebo.
- *Imported Gazebo odometry*: CSV headers `time_s,x_m,y_m,yaw_rad`; recorder provenance should be preserved. Still not necessarily accurate to the real Garden.

The importer currently uses third-party CDN JS, and the user must acquire the source file. Browser-compatible GPU and CORS are required. Original remote scene embed remains a separate source preview. The public SuperSplat scene page did **not** expose a stable direct model URL to our automated cloud inspection (2026-10-14).

Don't tell instructors that the robot's plotted path is a verified physical operation in the Garden. To establish it, add the Garden collision geometry to Gazebo, run recorded experiments, and publish collision/odometry/ground-truth validation.
