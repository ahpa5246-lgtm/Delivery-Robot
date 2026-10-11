# Python surrogate 270-run sensitivity sweep — 2026-10-11
**Category:** Executed numerical simulation outputs, **not** Gazebo and **not** physical measurements.

Run command from repository root: `python -m scripts.run_parameter_sweep`.

| Experiment setting | Values |
| --- | --- |
| Payload mass | 0, 2.5, 5 kg |
| Incline | 0°, 3°, 5° |
| Friction coefficient | 0.3, 0.6, 0.9 |
| Seeds per combination | 0–9 |
| Total runs | 270 |
| Completed | 270 |
| Detected contacts | 0 |
| Computed electrical energy range | 0.28438–0.55550 Wh per run |
| Maximum **calculated** wheel torque | 2.17227 N·m |

The 270/270 completion ratio is limited to *the scripted straight 25 m corridor* and a safety controller given the pedestrian's scripted future movement. It cannot be generalized to an autonomous sidewalk delivery robot, physical motor characteristics, or untested obstacles. Variation is sensitive to assumptions in the simple power equations and lacks calibrated contact/tire slip; this experiment is a code/sensitivity sanity check rather than physics validation.

Raw CSV is generated locally by the included script; the Gazebo physics validation remains a separate acceptance gate.
