"""Parse recorded *Gazebo* text-proto odometry into source-labeled replay.

No fabricated poses or timestamps. Input is the raw output of
`gz topic -e -t /model/cdr01/odometry` from a real headless run.
"""
import argparse
import csv
import hashlib
import json
import math
import re
from pathlib import Path

FLOAT = r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?"
NUMBER = lambda key, text: re.search(r"\b"+key+r":\s*("+FLOAT+r")", text)
BLOCK = lambda key, text: re.search(r"\b"+key+r"\s*\{([^{}]*)\}", text, re.S)


def decode_odometry(raw: str) -> list[dict]:
    parsed = []
    # Gazebo text-protobuf streams successive messages beginning with 'header {'.
    for rec in re.split(r"(?=^header\s*\{)", raw, flags=re.M):
        pos = BLOCK("position", rec)
        ori = BLOCK("orientation", rec)
        secs = NUMBER("sec", rec)
        nsecs = NUMBER("nsec", rec)
        if not pos or not secs:
            continue
        x = NUMBER("x", pos.group(1))
        y = NUMBER("y", pos.group(1))
        if not x or not y:
            continue
        # Protobuf elides 0-valued fields and may omit a unit yaw quaternion;
        # never infer a nonzero yaw from missing orientation data.
        o = ori.group(1) if ori else ""
        def part(k, default=0.0):
            v = NUMBER(k, o)
            return float(v.group(1)) if v else default
        qx, qy, qz, qw = part("x"), part("y"), part("z"), part("w", 1.0)
        norm = math.sqrt(qx*qx+qy*qy+qz*qz+qw*qw)
        if norm < 1e-8:
            raise ValueError("invalid zero-norm orientation")
        qx, qy, qz, qw = [v/norm for v in (qx,qy,qz,qw)]
        yaw = math.atan2(2*(qw*qz+qx*qy),1-2*(qy*qy+qz*qz))
        stamp = float(secs.group(1)) + (float(nsecs.group(1))/1e9 if nsecs else 0)
        d = dict(time_s=stamp, x_m=float(x.group(1)),y_m=float(y.group(1)),yaw_rad=yaw)
        if not all(math.isfinite(v) for v in d.values()):
            raise ValueError("nonfinite Gazebo odometry")
        if parsed and stamp <= parsed[-1]["time_s"]:
            continue
        parsed.append(d)
    if len(parsed)<2:
        raise ValueError("not enough real Gazebo odometry messages (need >= 2)")
    t0 = parsed[0]["time_s"]
    for p in parsed:
        p["time_s"] = round(p["time_s"]-t0,6)
    if parsed[-1]["time_s"]<=0:
        raise ValueError("recording has no positive simulated duration")
    return parsed


def export(raw_path: Path, output: Path, provenance_path: Path) -> dict:
    provenance=json.loads(provenance_path.read_text(encoding="utf-8"))
    if provenance.get("schema")!="cdr-garden-physics-proxy-v1":
        raise ValueError("world provenance missing or unsupported")
    frames=decode_odometry(raw_path.read_text(encoding="utf-8",errors="replace"))
    total=sum(math.hypot(b["x_m"]-a["x_m"],b["y_m"]-a["y_m"]) for a,b in zip(frames,frames[1:]))
    displacement=math.hypot(frames[-1]["x_m"]-frames[0]["x_m"],frames[-1]["y_m"]-frames[0]["y_m"])
    result={
      "schema":"cdr-garden-gazebo-replay-v1",
      "source":"recorded_gazebo_harmonic_odometry",
      "physics_world":"flat_contact_proxy_not_real_garden_terrain",
      "contact_mesh_validated":False,
      "garden_obstacle_collisions":"NOT_MODELED",
      "garden_source_sha256":provenance["garden_source_sha256"],
      "gazebo_world_sha256":provenance["world_sha256"],
      "calibration":provenance["calibration"],
      "samples":len(frames),
      "duration_s":frames[-1]["time_s"],
      "odometry_path_length_m":round(total,4),
      "odometry_displacement_m":round(displacement,4),
      "frames":frames
    }
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("raw_odometry",type=Path)
    p.add_argument("--provenance",required=True,type=Path)
    p.add_argument("--output",type=Path,default=Path("experiments/garden_gazebo/latest_run.json"))
    args=p.parse_args()
    r=export(args.raw_odometry,args.output,args.provenance)
    print("REAL Gazebo messages:",r["samples"],"simulated s:",r["duration_s"],
          "odometry travel m:",r["odometry_path_length_m"])
    print("WARNING: flat Gazebo proxy, NOT Garden surface collision physics")


if __name__=="__main__":
    main()
