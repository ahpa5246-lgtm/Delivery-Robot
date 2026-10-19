# Draft PR: Run Delivery-Robot on the actual Lichtblick engine

The previous studio used custom HTML/canvas panels and could not provide native
robotics workspaces. This change makes the actual MPL-2.0 Lichtblick React engine
the primary application, vendored as ordinary source files in this repository.
No GitHub fork or submodule is required.

The implementation adds five saved Delivery workspaces, real MCAP playback with
TF/odometry/model context, licensed CAD in the native 3D view, synchronized plots
and a read-only Missions panel. Gaussian-viewer fixes address coordinate axes,
ground placement, replay/manual transitions, camera follow, path overlay and
scene provenance. No sensor streams or live physics are invented.

Validation: 102 Delivery Python tests, 201 relevant native tests, 5 Garden math
tests, production build, dependency license check, native/Gaussian browser runs
and actual ROS 2 Jazzy DDS diagnostics passed. The main native entry is about
7.6 MiB before HTTP compression; Webpack reports size warnings. See
[full evidence](DELIVERY_PLATFORM_TESTS.md) and
[visual comparison](DELIVERY_PLATFORM_VISUAL_REVIEW.md).

Screenshots are in `docs/evidence/lichtblick/`: native-perception-motion.png,
native-missions-seek.png, native-diagnostics.png, native-tablet.png,
native-missing-source.png and synthetic-start/end.png. The original old dashboard
and missing-Garden screen are also captured. Synthetic Gaussian evidence is not
original Garden acceptance.

Remaining acceptance: original Garden archive and metric/terrain validation;
official ROS bridge installation and live browser-to-ROS verification; current
Foxglove comparison and remaining visual-evidence gates. `packages.ros.org`,
`foxglove.dev` and GitHub API requests returned network `403`. No merge, public
deployment or visibility change was performed.

Reuse notices: Lichtblick MPL-2.0, rbot CAD Apache-2.0, Inter/IBM Plex SIL OFL-1.1,
existing PlayCanvas viewer MIT. Original source copyright and license notices
are retained, and the compiled local app includes relevant notice files.

Run `bash scripts/setup_telemetry.sh`, then `bash scripts/start_telemetry.sh`
(loopback port 8080). The initial recording is explicitly modeled campus replay.

---

Delivery note: API access was blocked, so PR draft state could not be inspected
or changed. Inspect existing PR #19 and any open PR for
`feature/lichtblick-mcap-integration` before creating another PR. Reuse the matching
existing PR and set it to draft where supported. This prepared description is
reviewable source text; it is not evidence that a GitHub PR update succeeded.
