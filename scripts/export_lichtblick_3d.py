"""Export recorded Gazebo poses as ROS1 PoseStamped and Path MCAP channels.

ROS1 wire encoding is used for Lichtblick compatibility; the source remains
Gazebo Harmonic (not ROS1). Coordinates are in the local flat-proxy odometry
frame, not georeferenced or validated against Garden collision geometry.
"""
from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path

from scripts.export_lichtblick_mcap import validate_recording

POSE_DEFINITION = """std_msgs/Header header
geometry_msgs/Pose pose
================================================================================
MSG: std_msgs/Header
uint32 seq
time stamp
string frame_id
================================================================================
MSG: geometry_msgs/Pose
geometry_msgs/Point position
geometry_msgs/Quaternion orientation
================================================================================
MSG: geometry_msgs/Point
float64 x
float64 y
float64 z
================================================================================
MSG: geometry_msgs/Quaternion
float64 x
float64 y
float64 z
float64 w
"""
PATH_DEFINITION = """std_msgs/Header header
geometry_msgs/PoseStamped[] poses
================================================================================
MSG: std_msgs/Header
uint32 seq
time stamp
string frame_id
================================================================================
MSG: geometry_msgs/PoseStamped
std_msgs/Header header
geometry_msgs/Pose pose
================================================================================
MSG: geometry_msgs/Pose
geometry_msgs/Point position
geometry_msgs/Quaternion orientation
================================================================================
MSG: geometry_msgs/Point
float64 x
float64 y
float64 z
================================================================================
MSG: geometry_msgs/Quaternion
float64 x
float64 y
float64 z
float64 w
"""


def ros_time(t: float) -> tuple[int, int]:
    ns = round(t * 1_000_000_000)
    secs, nsecs = divmod(ns, 1_000_000_000)
    if secs > 0xFFFFFFFF:
        raise ValueError("ROS timestamp out of range")
    return secs, nsecs


def ros_string(value: str) -> bytes:
    data = value.encode("utf-8")
    return struct.pack("<I", len(data)) + data


def header(t: float, seq: int, frame: str) -> bytes:
    secs, nsecs = ros_time(t)
    return struct.pack("<III", seq, secs, nsecs) + ros_string(frame)


def pose(frame: dict) -> bytes:
    half = frame["yaw_rad"] / 2
    return struct.pack(
        "<7d", frame["x_m"], frame["y_m"], 0.0,
        0.0, 0.0, math.sin(half), math.cos(half),
    )


def pose_stamped(frame: dict, seq: int) -> bytes:
    return header(frame["time_s"], seq, "odom") + pose(frame)


def path_message(frames: list[dict]) -> bytes:
    payload = bytearray(header(frames[-1]["time_s"], 0, "odom"))
    payload.extend(struct.pack("<I", len(frames)))
    for seq, frame in enumerate(frames):
        payload.extend(pose_stamped(frame, seq))
    return bytes(payload)


def export(source: Path, output: Path) -> int:
    from mcap.writer import Writer

    if source.stat().st_size > 16 * 1024 * 1024:
        raise ValueError("Recording exceeds size limit")
    recording = json.loads(source.read_text(encoding="utf-8"))
    frames = validate_recording(recording)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as stream:
        writer = Writer(stream)
        writer.start()
        pose_schema = writer.register_schema(
            name="geometry_msgs/PoseStamped", encoding="ros1msg",
            data=POSE_DEFINITION.encode(),
        )
        path_schema = writer.register_schema(
            name="nav_msgs/Path", encoding="ros1msg",
            data=PATH_DEFINITION.encode(),
        )
        pose_channel = writer.register_channel(
            topic="/cdr01/pose", message_encoding="ros1",
            schema_id=pose_schema,
            metadata={"source": "recorded_gazebo_harmonic_odometry",
                      "frame": "local_flat_proxy_odom"},
        )
        path_channel = writer.register_channel(
            topic="/cdr01/path", message_encoding="ros1",
            schema_id=path_schema,
            metadata={"source": "recorded_gazebo_harmonic_odometry",
                      "frame": "local_flat_proxy_odom"},
        )
        for seq, frame in enumerate(frames):
            ns = round(frame["time_s"] * 1e9)
            writer.add_message(
                channel_id=pose_channel, log_time=ns, publish_time=ns,
                data=pose_stamped(frame, seq),
            )
        ns = round(frames[-1]["time_s"] * 1e9)
        writer.add_message(
            channel_id=path_channel, log_time=ns, publish_time=ns,
            data=path_message(frames),
        )
        writer.finish()
    return len(frames)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recording", type=Path)
    parser.add_argument("--output", type=Path, default=Path("experiments/garden_gazebo/cdr01-3d.mcap"))
    args = parser.parse_args()
    count = export(args.recording, args.output)
    print(f"Exported {count} Gazebo poses + one Path to {args.output}")
    print("Recorded flat-proxy simulation only; not live, not Garden collision validated.")


if __name__ == "__main__":
    main()
