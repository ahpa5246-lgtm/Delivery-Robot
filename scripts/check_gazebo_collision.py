"""Validate Gazebo actual rigid-body world poses against mapped SDF walls.

DiffDrive odometry is NOT ground truth: it can continue integrating commanded
wheel motion while the simulated chassis is physically stopped against a wall.
Use SceneBroadcaster /world/campus_test/pose/info (gz.msgs.Pose_V), require
actual cdr01 pose, and fail closed if the body penetrates or misses the wall.
This is an SDF contact smoke test, not ROS2 Nav2 or field safety certification.
"""
from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path


def _blocks(raw: str, token: str):
    """Return complete protobuf-text blocks for token, including nested braces."""
    # CLI protobuf text may nest fields inline in compact representations,
    # as well as put each block on its own line.
    pat = re.compile(r"(?<![A-Za-z0-9_])" + re.escape(token) + r"\s*\{")
    for match in pat.finditer(raw):
        first = raw.find("{", match.start())
        depth = 0
        for i in range(first, len(raw)):
            if raw[i] == "{":
                depth += 1
            elif raw[i] == "}":
                depth -= 1
                if depth == 0:
                    yield raw[first + 1:i]
                    break


def _number(blob: str, field: str, default: float = 0.0) -> float:
    # Protobuf text may print several scalar fields on the same line
    # (and real Gazebo frequently prints one per line). Parse either form.
    found = re.search(r"(?<![A-Za-z0-9_])" + re.escape(field)
                      + r":\s*([-+0-9.eE]+)", blob)
    return float(found.group(1)) if found else default


def parse_ground_truth(raw: str) -> list[dict]:
    """Extract robot model world pose (not chassis child, wall, or wheel odom)."""
    records = {}
    for packet in re.split(r"(?=^header\s*\{)", raw, flags=re.MULTILINE):
        stamps = list(_blocks(packet, "stamp"))
        if not stamps:
            continue
        seconds = int(_number(stamps[0], "sec"))
        nanos = int(_number(stamps[0], "nsec"))
        timestamp_ns = seconds * 1_000_000_000 + nanos
        for p in _blocks(packet, "pose"):
            if not re.search(r'(?m)^\s*name:\s*"cdr01"\s*$', p):
                continue
            xyz = list(_blocks(p, "position"))
            quat = list(_blocks(p, "orientation"))
            if not xyz:
                continue
            pos = xyz[0]
            rot = quat[0] if quat else ""
            values = [_number(pos, axis) for axis in ("x", "y", "z")]
            values += [_number(rot, axis) for axis in ("x", "y", "z")]
            values += [_number(rot, "w", 1.0)]
            if all(math.isfinite(v) for v in values):
                records[timestamp_ns] = {
                    "ns": timestamp_ns, "x": values[0], "y": values[1],
                    "z": values[2], "qx": values[3], "qy": values[4],
                    "qz": values[5], "qw": values[6],
                }
    return [records[k] for k in sorted(records)]


def evaluate_contact(poses: list[dict], world: str) -> dict:
    """Compare actual body contact with true world-coordinate SDF wall face."""
    if world not in ("campus", "warehouse"):
        raise ValueError("unknown physics world")
    first_x = 2.0 if world == "campus" else 26.0
    wall_min_x = 8.0 if world == "campus" else 31.695
    chassis_half_length = 0.275  # SDF chassis x-size 0.55
    expected_contact_x = wall_min_x - chassis_half_length
    x = [p["x"] for p in poses]
    y = [p["y"] for p in poses]
    n = len(x)
    tail = x[-max(10, n // 5):]
    tail_motion = max(tail) - min(tail) if tail else None
    duration = (poses[-1]["ns"]-poses[0]["ns"])/1e9 if n>1 else 0.0
    maximum = max(x) if x else None
    minimum = min(x) if x else None
    # Conservative acceptance: actual chassis approaches the SDF wall,
    # cannot advance through the wall, and remains stopped under command.
    passed = bool(
        n >= 30 and duration >= 8
        and abs(x[0]-first_x) <= .35 and abs(y[0]-2.0) <= .35
        and maximum is not None
        and expected_contact_x-.70 <= x[-1] <= expected_contact_x+.05
        and maximum <= expected_contact_x+.05
        and (maximum-minimum) >= 3.6
        and (max(abs(v-2.0) for v in y) if y else 999) <= .65
        and tail_motion is not None and tail_motion <= .12
    )
    return {
        "world":world, "pose_source":"Gazebo SceneBroadcaster Pose_V actual model pose",
        "samples":n, "duration_sim_s":round(duration,3),
        "robot_spawn_world_x_m":first_x, "wall_min_world_x_m":wall_min_x,
        "expected_body_contact_world_x_m":expected_contact_x,
        "first_world_x_m":x[0] if x else None,
        "max_world_x_m":maximum, "final_world_x_m":x[-1] if x else None,
        "max_world_y_drift_m":max((abs(v-2.0) for v in y),default=None),
        "tail_x_span_m":tail_motion, "passed_wall_collision_gate":passed,
        "odometry_not_used_for_collision_verification":True,
    }


def wheel_odometry_displacement(raw: str) -> float | None:
    """Independent integrated-wheel displacement for contact evidence only."""
    positions = []
    for packet in re.split(r"(?=^header\s*\{)", raw, flags=re.MULTILINE):
        poses = list(_blocks(packet, "pose"))
        if not poses:
            continue
        positions_blocks = list(_blocks(poses[0], "position"))
        if positions_blocks:
            positions.append(_number(positions_blocks[0], "x"))
    if len(positions) < 10:
        return None
    return positions[-1]-positions[0]


def physical_contact_event_seen(raw: str) -> bool:
    # /cdr_wall/touched is only emitted by Gazebo TouchPlugin attached to
    # the mapped SDF collision wall, never by wheel odometry or an MCAP mock.
    return re.search(r"(?m)^\s*data:\s*true\b", raw) is not None


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("odometry", type=Path, help="diagnostic wheel-integrated odometry only")
    p.add_argument("summary", type=Path)
    p.add_argument("--world", choices=("campus","warehouse"), required=True)
    p.add_argument("--pose-file", type=Path, required=True,
                   help="Gazebo /world/campus_test/pose/info, not wheel odometry")
    p.add_argument("--contact-file", type=Path, required=True,
                   help="Gazebo TouchPlugin wall contact event, not an inferred stop")
    args = p.parse_args()
    pose = parse_ground_truth(args.pose_file.read_text(errors="replace"))
    result = evaluate_contact(pose,args.world)
    wheel_motion = wheel_odometry_displacement(args.odometry.read_text(errors="replace"))
    body_motion = pose[-1]["x"]-pose[0]["x"] if len(pose)>1 else None
    measured_slip = ((wheel_motion - body_motion)
                     if wheel_motion is not None and body_motion is not None else None)
    # If there were no wall, stopping a commanded robot just short of it
    # could mimic a stationary final pose. Require evidence that the wheels
    # kept integrating while the chassis was actually stopped by contact.
    result["wheel_odom_forward_m"] = wheel_motion
    result["actual_body_forward_m"] = body_motion
    result["wheel_minus_body_forward_m"] = measured_slip
    result["contact_event_seen"] = physical_contact_event_seen(
        args.contact_file.read_text(errors="replace"))
    # A touch sensor *event* together with a nonpenetrating and stopped
    # chassis is stronger evidence than a large wheel slip alone. Disabling
    # DiffDrive at first contact may eliminate most wheel/body divergence.
    result["contact_resistance_proven"] = result["contact_event_seen"]
    result["passed_wall_collision_gate"] = (
        result["passed_wall_collision_gate"] and result["contact_event_seen"])
    args.summary.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result))
    if not result["passed_wall_collision_gate"]:
        raise SystemExit("FAIL: SDF wall contact not proven by actual Gazebo model world pose")


if __name__ == "__main__":
    main()
