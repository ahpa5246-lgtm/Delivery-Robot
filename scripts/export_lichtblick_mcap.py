"""Export source-verified Garden Gazebo odometry as a Lichtblick-compatible MCAP.

Requires: python -m pip install mcap
This converts *recorded* simulated Gazebo odometry, not live ROS or physical telemetry.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def validate_recording(data: dict) -> list[dict]:
    if (
        data.get("schema") != "cdr-garden-gazebo-replay-v1"
        or data.get("source") != "recorded_gazebo_harmonic_odometry"
        or data.get("physics_world") != "flat_contact_proxy_not_real_garden_terrain"
        or data.get("contact_mesh_validated") is not False
    ):
        raise ValueError("Refusing unverified or unsupported recording provenance")
    frames = data.get("frames")
    if not isinstance(frames, list) or len(frames) < 2 or len(frames) > 200000:
        raise ValueError("Expected 2–200000 recorded odometry frames")
    if data.get("samples") != len(frames):
        raise ValueError("Recorded sample count does not match frames")
    previous = -1.0
    for frame in frames:
        if not isinstance(frame, dict):
            raise ValueError("Invalid frame")
        try:
            values = [frame[k] for k in ("time_s", "x_m", "y_m", "yaw_rad")]
        except KeyError as exc:
            raise ValueError("Missing odometry field") from exc
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in values):
            raise ValueError("Non-finite or non-numeric odometry")
        if values[0] <= previous or values[0] < 0:
            raise ValueError("Odometry timestamps must be strictly increasing")
        previous = values[0]
    return frames


def export_mcap(source: Path, destination: Path) -> int:
    from mcap.writer import Writer

    if source.stat().st_size > 16 * 1024 * 1024:
        raise ValueError("Recording exceeds 16 MiB input limit")
    data = json.loads(source.read_text(encoding="utf-8"))
    frames = validate_recording(data)
    schema = {
        "type": "object",
        "properties": {
            "timestamp_s": {"type": "number"},
            "x_m": {"type": "number"},
            "y_m": {"type": "number"},
            "yaw_rad": {"type": "number"},
            "source": {"type": "string"},
            "physics_world": {"type": "string"},
            "contact_mesh_validated": {"type": "boolean"}
        },
        "required": ["timestamp_s", "x_m", "y_m", "yaw_rad", "source", "physics_world", "contact_mesh_validated"],
        "additionalProperties": False
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as stream:
        writer = Writer(stream)
        writer.start()
        schema_id = writer.register_schema(
            name="cdr.GardenGazeboOdometry",
            encoding="jsonschema",
            data=json.dumps(schema).encode("utf-8"),
        )
        channel_id = writer.register_channel(
            topic="/cdr01/garden_gazebo/odometry",
            message_encoding="json",
            schema_id=schema_id,
            metadata={"provenance": "recorded_gazebo_harmonic_odometry",
                      "terrain": "flat_contact_proxy_not_real_garden_terrain"},
        )
        for frame in frames:
            timestamp_ns = round(frame["time_s"] * 1_000_000_000)
            payload = {
                "timestamp_s": frame["time_s"],
                "x_m": frame["x_m"],
                "y_m": frame["y_m"],
                "yaw_rad": frame["yaw_rad"],
                "source": data["source"],
                "physics_world": data["physics_world"],
                "contact_mesh_validated": False,
            }
            writer.add_message(
                channel_id=channel_id,
                log_time=timestamp_ns,
                publish_time=timestamp_ns,
                data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
            )
        writer.finish()
    return len(frames)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recording", type=Path)
    parser.add_argument("--output", type=Path, default=Path("experiments/garden_gazebo/cdr01.mcap"))
    args = parser.parse_args()
    count = export_mcap(args.recording, args.output)
    print(f"Exported {count} recorded Gazebo odometry samples to {args.output}")
    print("SIMULATION ONLY: flat contact proxy; Garden obstacle collisions NOT modeled.")


if __name__ == "__main__":
    main()
