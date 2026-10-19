# Practical visual and workflow review — 2026-10-19

## Evidence examined

- Existing Delivery-Robot application at the main checkout: captured
  `before-campus.png` and `before-garden-missing.png` before switching to PR #19.
- PR #19 source was fetched by its Git ref and fast-forwarded into the existing
  feature branch. Its simulated studio was confirmed to be HTML/canvas, not the
  Lichtblick engine. Prior useful exporters and Garden fixes were retained.
- Lichtblick's actual source, native runtime and official upstream screenshot
  `vendor/lichtblick/resources/screenshot.png` were inspected. The native runtime
  reference capture uses the same vendored engine without Delivery's workspace
  wrapper; it shares the palette customization and is not claimed to be a
  byte-for-byte unmodified upstream release.
- Foxglove's official website returned a proxy/network `403`. No current visual
  inspection or exact parity with Foxglove is claimed. User-mentioned attached
  visual reference images were not available in this session.

## Before / after / reference

| Aspect | Previous Delivery view | Implemented native platform | Reference comparison / remaining gap |
| --- | --- | --- | --- |
| Application structure | Long page, separate hand-built charts and controls | Actual native mosaic workspace, five saved layouts, compact toolbar + workspace row | Same Lichtblick layout engine; no custom imitation docking code |
| Playback | Independent dashboard replay widgets | One native recording clock drives plots, raw data, mission state and 3D TF | Play/pause/seek and workspace changes were tested in Chromium |
| Visual hierarchy | Large section headers and many below-fold sections | Graphite canvas, native panel borders, 12px-class technical UI and restrained data accents | Native component density retained; not a new SaaS-card design |
| Robot geometry | Mixed visual proxies and imported assets | Licensed rbot CAD chassis/wheels in a TF-linked local URDF assembly | Source millimetres and mesh up-axis were checked; no mechanical validation claimed |
| Topics and frames | Dashboard-specific summaries | Native Topics, 3D transforms/settings and raw message trees | No LiDAR or camera image is invented to fill a panel |
| Diagnostics | Several independent metrics | Native State Transitions and plotted modeled values | SOC is an estimate; it is not battery telemetry |
| Missions | Buried inside a single page | Separate playback-synchronized native Missions panel | Read-only replay; dispatch/backend workflow not implemented |
| Garden robot | Camera-relative preview could float; no follow | Explicit ground anchor, corrected axes, scale, actual follow views and path overlay | Original Garden missing; synthetic Gaussian test only |
| Persistence | Fixed hand-built layout | Native IndexedDB layout persistence across workspace switch and reload | Resizing and adding a panel were tested, not just claimed |

## Defects found and addressed during inspection

1. The original branch did not reuse Lichtblick: replaced the application path with
   the actual MPL engine source.
2. JSON Schema nullable union was accepted by a generic decoder but rejected by
   Lichtblick: changed the recording's optional reason representation to a supported
   string and exercised it in the real player.
3. Workspace selection raced the native initial layout: delayed first selection
   until the native layout exists; browser test verifies the default workspace.
4. System theme selected white panels: supplied native dark defaults while retaining
   user preferences. Browser validation checks the rendered workspace color.
5. Robot model context could be absent after opening another panel mid-recording:
   repeated the immutable model context and used a locally served CAD layer.
6. STL loader's default Y-up rotated the chassis/wheels incorrectly: set ROS Z-up
   explicitly and inspected the corrected screenshot.
7. Frame labels obscured the robot: reduced axis scale and disabled label clutter;
   frame inspection remains available through native settings.
8. Garden positive yaw disagreed with motion, replay removed yaw without rotating
   positions, and distance units differed by mode: unified the transform and units.
9. Garden lacked camera tracking and could leave replay active during manual
   placement: added real follow views and canceled stale playback on manual action.
10. Arbitrary scenes could claim original Garden provenance: track scene identity,
    verify the server archive digest and guard Garden calibration export.
11. Native JointState schema subscription was gated by a nonexistent visibility
    control: added explicit schema subscription and a failing-then-passing regression.

## Critical remaining limitations

The native view currently uses an engineering grid and visual CAD assembly, not a
new photorealistic campus. Original Garden, metric registration and terrain
collision acceptance remain unverified. Small windows use native docking and can
be resized; 768px captures are desktop-software compatibility evidence, not a
claim of full phone usability. The main native bundle is large; no measured
low-end device performance claim is made. A current Foxglove comparison remains incomplete. Independent Garden and native
integration reviews identified defects that were repaired. The native review
covered asset portability, source labeling, test claims and attribution.

12. Independent native review found host-bound saved asset URLs: added tagged,
    narrowly scoped rebasing while preserving custom URDF URLs and other edits.
13. Independent review rejected URL-based source classification: the badge now
    reads active MCAP metadata and uses a neutral label for unknown sources.
14. Browser automation now verifies decoded world-position changes in addition
    to playback time. Robot visibility/scale remain manually inspected screenshot
    evidence, not an invented automated vision score.
