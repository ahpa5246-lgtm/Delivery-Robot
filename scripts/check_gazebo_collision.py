"""Independent Gazebo odometry acceptance: collision with first solid campus wall.

Robot starts at (2,2) facing +X. Authoritative model building_0 begins at
x=8.0 with y in [0,6]; the chassis cannot cross its collision surface.
This is a motor/geometry smoke test, not a calibrated robot safety certificate.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def inspect(raw: str) -> dict:
    samples = []
    for record in re.split(r'(?=^header \{)', raw, flags=re.MULTILINE):
        pose = re.search(r'\bpose\s*\{\s*position\s*\{([^}]*)\}', record, re.DOTALL)
        if pose is None:
            continue
        value = re.search(r'\bx:\s*([-+0-9.eE]+)', pose.group(1))
        if value:
            samples.append(float(value.group(1)))
    return {
        "samples": len(samples),
        "initial_x_m": samples[0] if samples else None,
        "maximum_x_m": max(samples) if samples else None,
        "final_x_m": samples[-1] if samples else None,
        "motion_m": max(samples) - min(samples) if samples else None,
        "passed_wall_collision_gate": bool(
            len(samples) > 15 and max(samples) >= 6.6 and
            max(samples) <= 8.05 and max(samples) - min(samples) >= 4.0
        ) if samples else False,
    }


def main() -> None:
    observed = inspect(Path(sys.argv[1]).read_text(errors="replace"))
    Path(sys.argv[2]).write_text(json.dumps(observed, indent=2) + "\n")
    print(json.dumps(observed))
    if not observed["passed_wall_collision_gate"]:
        raise SystemExit("FAIL: model did not demonstrably approach and stop at the first real SDF wall")


if __name__ == "__main__":
    main()
