# Implementation plan

1. Preserve the baseline and existing PR #19 branch; capture old views. Vendor upstream source with its exact SHA and licensing; install immutable dependencies and build the web target before customization. Confirm real runtime in Chromium.
2. Add Delivery presets using native LayoutData and a workspace bar using LayoutManager/CurrentLayout APIs. Use native 3D/Plot/Raw/State Transitions and persistence. Add a source-labeled, read-only Missions panel. Test layout selection and saved edits.
3. Export executed campus replay to MCAP with valid ROS1-encoded TF, odometry, path and URDF plus explicit modeled mission messages. Round-trip messages and invalid inputs in tests. Open it in the real engine and configure paths/frames.
4. Fix Garden coordinate orientation, units, input validation, source claims and camera focus/follow. Test real rendering with a clearly labeled fixture. Report original archive as missing.
5. Run relevant Python, native web tests and production build, then browser playback/seek, resize and persistence checks. Review screenshots against the unmodified engine and official Foxglove descriptions. Request independent review and resolve findings. Commit coherent stages, push existing branch and update/create draft PR when available.

Review focus: incorrect TF/URDF alignment; timestamps beginning at zero; changing workspace without losing custom layouts; source labels that could imply hardware; Garden scene identity and direction of travel; network/data-source failures; missing assets in production.
