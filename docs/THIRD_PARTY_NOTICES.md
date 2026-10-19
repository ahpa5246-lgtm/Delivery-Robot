# Reused source and attribution

| Reuse | Location | License and retained notices |
| --- | --- | --- |
| Actual Lichtblick React application and native panel/data engines, upstream c5478a3d44a48467a741134cfed8ecd2325692c2 | `vendor/lichtblick` | MPL-2.0, upstream LICENSE and per-file SPDX/copyright retained. Some files additionally incorporate Apache-2.0 work; retain those notices too. |
| Delivery-specific workspace layouts, wrapper and Missions panel | `vendor/lichtblick/web/src/delivery`, `packages/suite-base/src/panels/DeliveryMissions` | MPL-2.0, Delivery-Robot contributor attribution. The local lint override checks the correct author notice instead of incorrectly asserting BMW ownership. |
| rbot CAD chassis and wheel meshes | `dashboard/assets/robot` and bundled `models` output | Apache-2.0. Copyright Robolabs AI. Source/asset blob attribution in `dashboard/assets/SOURCES.md`; full license in `integrations/upstream_samples/rbot-nav2/LICENSE`. Adapted URDF positions/scales are visual only. |
| Inter and IBM Plex Mono fonts | Vendored native font assets | SIL OFL-1.1. Full notices retrieved from the font authors are retained in `docs/licenses/Inter-OFL.txt` and `docs/licenses/IBM-Plex-OFL.txt`. |
| Existing PlayCanvas / SuperSplat viewer | Gaussian diagnostic page | MIT; existing pinned browser imports and source notices retained. |
| Original Mip-NeRF 360 Garden | **Not included** | CC BY 4.0, transkatgirl. Source archive absent; no claim of testing or redistribution of its bytes. |
| Python MCAP runtime and ROS1 decoder | `requirements-telemetry.txt` | Installed package metadata declares MIT; retain upstream notices including vendored ROS message code. |
| ROS common message definitions | Campus MCAP exporter schemas | Standard ROS common interfaces, BSD terms; no ROS implementation code is copied from Foxglove. |
| Foxglove commercial product | Comparison reference only | No proprietary code or assets copied. Its website was inaccessible in this environment. |

The original Lichtblick license check completed successfully against installed
dependencies. Its report is retained in the test evidence. This is a dependency
inventory check, not legal certification. The upstream checker excludes
`gl-vec3@1.1.3`; that pre-existing exception was not expanded. Preserve the package's
own notice when distributing dependencies.

MPL-covered source and modifications remain available in this repository.
Distributing a compiled application requires making the covered source available
and retaining MPL and third-party notices. This task prepared a local build; it
did not publish a binary release or deploy publicly. Preserve generated bundle
license comments and perform a distribution-specific license inventory before
publishing Electron installers or another packaged distribution.

Font notice sources checked on 2026-10-19: https://github.com/rsms/inter/blob/master/LICENSE.txt and https://github.com/IBM/plex/blob/master/LICENSE.txt. Existing font bytes were retained without modification.
