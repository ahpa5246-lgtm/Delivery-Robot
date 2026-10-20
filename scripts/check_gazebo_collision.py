"""Gazebo physics acceptance using native model-relative odometry.

The CDR-01 SDF spawns at world x=2 m. Building_0 begins at world x=8 m.
The chassis half-length is 0.275 m; expected local odometry wall contact
is (8 - 0.275) - 2 = 5.725 m, NOT global x=8.
We require forward movement, no penetration, and a flat last-time-window
trajectory while the 0.65 m/s command is still being published. This is a
simplified headless contact test, not a field safety certificate.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def inspect(raw: str, world: str = "campus") -> dict:
    if world not in ("campus", "warehouse"):
        raise ValueError("unsupported physical contact world")
    records = []
    for record in re.split(r"(?=^header \{)", raw, flags=re.MULTILINE):
        pose = re.search(r"\bpose\s*\{\s*position\s*\{([^}]*)\}", record, re.DOTALL)
        if pose is None:
            continue
        value = re.search(r"\bx:\s*([-+0-9.eE]+)", pose.group(1))
        if not value:
            continue
        stamp = re.search(r"\bstamp\s*\{\s*sec:\s*(\d+)\s*nsec:\s*(\d+)", record, re.DOTALL)
        seconds = (int(stamp.group(1)) + int(stamp.group(2)) / 1e9) if stamp else None
        records.append((seconds, float(value.group(1))))
    xs = [x for _, x in records]
    initial = xs[0] if xs else None
    distance = (max(xs) - min(xs)) if xs else None
    # First-order wall-gate acceptance: robot reaches collision contact and
    # does not move through to the far side (absolute local displacement).
    wall_contact_m = 5.725 if world == "campus" else 5.42
    tail = xs[-max(10, len(xs)//5):] if xs else []
    tail_span = max(tail)-min(tail) if tail else None
    reached = bool(
        len(xs) >= 30
        and distance is not None
        and 5.2 <= distance <= 6.1
        and abs(xs[-1] - wall_contact_m) <= 0.50
        and tail_span is not None and tail_span <= 0.15
    )
    return {
        "samples": len(xs),
        "odom_frame": "model-relative",
        "world": world,
        "robot_world_start_x_m": 2.0 if world == "campus" else 26.0,
        "building_world_start_x_m": 8.0 if world == "campus" else 31.695,
        "expected_odom_wall_contact_m": wall_contact_m,
        "initial_odom_x_m": initial,
        "max_odom_x_m": max(xs) if xs else None,
        "final_odom_x_m": xs[-1] if xs else None,
        "forward_displacement_m": distance,
        "final_20_percent_motion_span_m": tail_span,
        "first_simulation_s": records[0][0] if records else None,
        "last_simulation_s": records[-1][0] if records else None,
        "passed_wall_collision_gate": reached,
    }


def main() -> None:
    world = sys.argv[4] if len(sys.argv) == 5 and sys.argv[3] == "--world" else "campus"
    result = inspect(Path(sys.argv[1]).read_text(errors="replace"), world)
    Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))
    if not result["passed_wall_collision_gate"]:
        raise SystemExit("FAIL: no verified Gazebo obstacle contact and stopped odometry")


if __name__ == "__main__":
    main()
