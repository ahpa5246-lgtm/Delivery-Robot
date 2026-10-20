"""Turn REAL Gazebo Harmonic odometry into ROS1-wire MCAP for Lichtblick.

Run only after the headless SDF collision gate passes. Gazebo simulation
observations are not hardware measurements, live ROS1 data, or a dynamically
controlled obstacle avoidance run. Original transport: gz.msgs.Odometry.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import re
import struct
import sys

# Standalone invocation via `python scripts/export_gazebo_observation.py`
# starts with /scripts on sys.path, rather than the repository root.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.export_delivery_recording import SCHEMAS, header, ros_schema, string, ROOT


def parse_observations(raw: str) -> list[dict]:
    by_stamp = {}
    for chunk in re.split(r"(?=^header\s*\{)", raw, flags=re.MULTILINE):
        stamp = re.search(r"stamp\s*\{\s*sec:\s*(\d+)\s*nsec:\s*(\d+)", chunk)
        p = re.search(r"pose\s*\{\s*position\s*\{([^}]*)\}", chunk, re.DOTALL)
        if stamp is None or p is None:
            continue
        def component(blob: str, name: str, default: float = 0.0) -> float:
            match = re.search(r"\b" + name + r":\s*([-+\d.eE]+)", blob)
            return float(match.group(1)) if match else default
        orient = re.search(r"orientation\s*\{([^}]*)\}", chunk, re.DOTALL)
        vx = re.search(r"twist\s*\{\s*linear\s*\{([^}]*)\}", chunk, re.DOTALL)
        omega = re.search(r"angular\s*\{([^}]*)\}", chunk, re.DOTALL)
        ns = int(stamp.group(1))*1_000_000_000 + int(stamp.group(2))
        x, y = component(p.group(1), "x"), component(p.group(1), "y")
        qz = component(orient.group(1), "z") if orient else 0.0
        qw = component(orient.group(1), "w", 1.0) if orient else 1.0
        speed = component(vx.group(1), "x") if vx else 0.0
        rate = component(omega.group(1), "z") if omega else 0.0
        if all(math.isfinite(v) for v in (x,y,qz,qw,speed,rate)):
            by_stamp[ns] = dict(ns=ns,x=x,y=y,qz=qz,qw=qw,speed=speed,rate=rate)
    return [by_stamp[n] for n in sorted(by_stamp)]


def export_observations(source: Path, target: Path, world: str) -> int:
    from mcap.writer import Writer
    if world not in ("campus", "warehouse"):
        raise ValueError("unknown Gazebo world")
    frames = parse_observations(source.read_text(errors="replace"))
    if len(frames) < 30 or max(f["x"] for f in frames)-min(f["x"] for f in frames) < 4:
        raise ValueError("insufficient Gazebo motion; refusing to mark physics as verified")
    urdf = (ROOT / "assets/robot/cdr01-visual-proxy.urdf").read_text()
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("wb") as output:
        writer = Writer(output)
        writer.start(profile="ros1", library="delivery-gazebo-physics-exporter")
        channels = {}
        for topic in ("/odom", "/tf", "/robot_description"):
            name, body = SCHEMAS[topic]
            schema = writer.register_schema(name=name,encoding="ros1msg",data=ros_schema(body))
            channels[topic] = writer.register_channel(topic=topic,message_encoding="ros1",
                schema_id=schema,metadata={"source":"gazebo_harmonic_observation","world":world})
        fields = {"timestamp_s":"number","source":"string","live":"boolean",
                  "world":"string","phase":"string","status":"string","reason":"string",
                  "speed_mps":"number","distance_m":"number","energy_estimated_wh":["number","null"],
                  "soc_estimated":["number","null"],"sensor_model":"string",
                  "obstacle_range_m":["number","null"],"minimum_clearance_m":["number","null"],
                  "obstacle_detected":"boolean","replans":"integer","collision_checked":"boolean",
                  "gazebo_verified":"boolean"}
        schema = writer.register_schema(name="cdr.DeliveryMission",encoding="jsonschema",
            data=json.dumps({"type":"object","properties":{k:{"type":v} for k,v in fields.items()},
                             "required":list(fields),"additionalProperties":False}).encode())
        channels["/cdr01/mission"] = writer.register_channel(topic="/cdr01/mission",
            message_encoding="json",schema_id=schema)
        writer.add_metadata("delivery.provenance", {
            "source":"gazebo_harmonic_observation", "world":world,
            "hardware_verified":"false", "gazebo_verified":"true", "ros2_native":"false",
            "original_transport":"gz.msgs.Odometry",
            "test":"constant_speed_static_wall_contact_not_replanning",
            "covariance":"unknown_zero_placeholder"})
        t0 = frames[0]["ns"]
        prev = (frames[0]["x"],frames[0]["y"])
        distance = 0.0
        for i, f in enumerate(frames):
            ns = f["ns"] - t0
            # SDF spawn pose (2,2,0) + model-local Gazebo odometry.
            x, y = 2.0+f["x"], 2.0+f["y"]
            qnorm=math.hypot(f["qz"],f["qw"]) or 1.0
            p = struct.pack("<7d",x,y,0,0,0,f["qz"]/qnorm,f["qw"]/qnorm)
            h = header(i,ns)
            msg = h + string("base_link") + p + struct.pack("<36d",*([0.0]*36))
            msg += struct.pack("<6d",f["speed"],0,0,0,0,f["rate"]) + struct.pack("<36d",*([0.0]*36))
            def emit(topic, data):
                writer.add_message(channel_id=channels[topic],log_time=ns,
                                   publish_time=ns,sequence=i,data=data)
            emit("/odom",msg)
            emit("/tf",struct.pack("<I",1)+h+string("base_link")+p)
            emit("/robot_description",string(urdf))
            distance += math.hypot(f["x"]-prev[0],f["y"]-prev[1])
            prev=(f["x"],f["y"])
            info = dict(timestamp_s=ns/1e9,source="gazebo_harmonic_observation",live=False,
                world=world,phase="PHYSICS",status="OBSERVED_WALL_CONTACT",
                reason="constant_velocity_test_not_navigation",speed_mps=abs(f["speed"]),
                distance_m=round(distance,6),energy_estimated_wh=None,soc_estimated=None,
                sensor_model="Gazebo_simulated_odometry_not_hardware",
                obstacle_range_m=None,minimum_clearance_m=None,obstacle_detected=False,
                replans=0,collision_checked=False,gazebo_verified=True)
            emit("/cdr01/mission",json.dumps(info,allow_nan=False,separators=(",",":")).encode())
        writer.finish()
    return len(frames)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--world",required=True,choices=("campus","warehouse"))
    parser.add_argument("--input",required=True,type=Path)
    parser.add_argument("--output",required=True,type=Path)
    args=parser.parse_args()
    print(f"Gazebo observations: {export_observations(args.input,args.output,args.world)} frames -> {args.output}")
