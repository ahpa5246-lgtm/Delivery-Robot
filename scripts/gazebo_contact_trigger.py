"""Stop-trigger for a headless Gazebo contact challenge using actual world pose.

Reads the final 256 KiB of SceneBroadcaster Pose_V capture while Gazebo is
running. Exit code 0 means the actual robot body is within 4 cm of first SDF
contact; this only triggers deceleration. The independent full-log checker
still owns physical acceptance and must not be bypassed.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from scripts.check_gazebo_collision import parse_ground_truth


def reached_contact(poses: list[dict], world: str) -> bool:
    if world not in ("campus", "warehouse"):
        raise ValueError("invalid physics world")
    if len(poses) < 1:
        return False
    latest = poses[-1]
    expected = (8.0 if world == "campus" else 31.695) - 0.315
    # Front caster extends 0.24 + 0.075 from the model origin.
    return (expected - .04 <= latest["x"] <= expected + .08
            and abs(latest["y"] - 2.0) <= .40 and latest["z"] > -.15)


def tail_ground_truth(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    with path.open("rb") as stream:
        size = stream.seek(0,2)
        stream.seek(max(0,size-262144))
        return parse_ground_truth(stream.read().decode(errors="replace"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source",type=Path)
    parser.add_argument("--world",required=True,choices=("campus","warehouse"))
    args=parser.parse_args()
    raise SystemExit(0 if reached_contact(tail_ground_truth(args.source),args.world) else 1)
