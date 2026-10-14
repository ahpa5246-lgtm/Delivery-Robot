"""Generate a *flat contact proxy* for a photographed Gaussian Garden.

This is a physical Gazebo contact test on an operator-chosen local pad,
NOT a reconstruction of the lawn, hedges, table or obstacles. Scene-to-metric
registration and terrain collision must be separately calibrated.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
from xml.etree import ElementTree as ET
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.generate_gazebo_world import generate
DEFAULT_OUTPUT = ROOT / "simulation" / "garden_physics_proxy.sdf"
EXPECTED_SOURCE = "e2c82908d3c871c47dc4e6498529944afaebd7d01cf130b65aa0bf01202086c3"


def calibration_from_file(path: Path) -> dict:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("schema") != "cdr-garden-calibration-v1":
        raise ValueError("expected cdr-garden-calibration-v1")
    if raw.get("source_sha256") != EXPECTED_SOURCE:
        raise ValueError("calibration is not for the supplied original Garden LOD archive")
    if raw.get("terrain_collision_verified") is not False:
        raise ValueError("terrain_collision_verified must be false for flat proxy")
    origin = raw.get("origin_scene")
    if not isinstance(origin, dict) or set(origin) != {"x", "y", "z"}:
        raise ValueError("origin_scene must contain exactly x,y,z")
    for value in origin.values():
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or abs(value) > 10000:
            raise ValueError("invalid scene origin")
    scale = raw.get("meters_per_scene_unit")
    side = raw.get("flat_patch_size_m", 8)
    heading = raw.get("scene_yaw_deg", 0)
    if (isinstance(scale, bool) or not isinstance(scale, (float, int)) or
        not math.isfinite(scale) or not .01 <= scale <= 10):
        raise ValueError("meters_per_scene_unit must be operator-calibrated in [0.01, 10]")
    if not isinstance(side, (int, float)) or not math.isfinite(side) or not 2 <= side <= 30:
        raise ValueError("flat_patch_size_m must be between 2 and 30 meters")
    if not isinstance(heading, (int, float)) or not math.isfinite(heading) or abs(heading) > 360:
        raise ValueError("invalid scene yaw")
    if raw.get("scene_y_axis") not in ("up", "down"):
        raise ValueError("scene_y_axis must be explicitly up or down")
    return raw


def create_world(calibration: dict, output: Path = DEFAULT_OUTPUT) -> tuple[Path, Path]:
    """Start from the current CDR-01 physical SDF and change only the environment."""
    source = generate()
    tree = ET.parse(source)
    root = tree.getroot()
    world = root.find("world")
    world.set("name", "garden_flat_contact_proxy")
    for model in list(world.findall("model")):
        if model.get("name", "").startswith("campus_bollard_"):
            world.remove(model)
    ground = world.find("./model[@name='pavement']")
    ground.set("name", "garden_flat_contact_patch")
    side = float(calibration.get("flat_patch_size_m", 8))
    box = ground.find("./link[@name='ground']")
    box.find("pose").text = "0 0 -0.1 0 0 0"
    for part in ("collision", "visual"):
        box.find(f"./{part}/geometry/box/size").text = f"{side:g} {side:g} 0.2"
    robot = world.find("./model[@name='cdr01']")
    robot.find("pose").text = "0 0 0 0 0 0"
    # Keep CDR-01 inertial parameters, wheel joints, physical contact, sensors
    # and DiffDrive plugin unchanged. No invented garden obstacle geometry.
    output.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(root, space="  ")
    tree.write(output, encoding="utf-8", xml_declaration=True)
    provenance = {
        "schema": "cdr-garden-physics-proxy-v1",
        "world_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "garden_source_sha256": EXPECTED_SOURCE,
        "calibration": calibration,
        "contact_geometry": "flat_horizontal_box_only",
        "garden_obstacle_collisions": "NOT_MODELED",
        "terrain_collision_verified": False,
        "units": "Gazebo meters, visual Garden scaling operator-estimated",
        "robot_physics": "Gazebo Harmonic CDR-01 DiffDrive; not motor torque or real hardware",
    }
    report = output.with_suffix(".provenance.json")
    report.write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return output, report


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--calibration", required=True, type=Path)
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = p.parse_args()
    calibration = calibration_from_file(args.calibration)
    out, prov = create_world(calibration, args.output)
    print(f"FLAT PROXY ONLY: {out} ({out.stat().st_size} bytes)")
    print(f"Provenance: {prov}")
    print("Gazebo physics CAN run on this flat patch; Garden lawn/hedge collision NOT VALIDATED.")


if __name__ == "__main__":
    main()
