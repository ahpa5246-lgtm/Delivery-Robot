"""Loopback-only diagnostic dashboard for offline campus replay; never controls motors."""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cdr_sim.campus import Campus, ReplayOptions, replay

ROOT = Path(__file__).resolve().parents[1] / "dashboard"
STATIC = {"/": ("index.html", "text/html; charset=utf-8"),
          "/app.js": ("app.js", "text/javascript; charset=utf-8"),
          "/scene3d.js": ("scene3d.js", "text/javascript; charset=utf-8"),
          "/vendor/three.min.js": ("vendor/three.min.js", "text/javascript; charset=utf-8"),
          "/style.css": ("style.css", "text/css; charset=utf-8"),
          "/vendor/STLLoader.js": ("vendor/STLLoader.js", "text/javascript; charset=utf-8"),
          "/vendor/ColladaLoader.js": ("vendor/ColladaLoader.js", "text/javascript; charset=utf-8"),
          "/command-center.css": ("command-center.css", "text/css; charset=utf-8"),
          "/cad-enhancement.js": ("cad-enhancement.js", "text/javascript; charset=utf-8"),
          "/analytics.js": ("analytics.js", "text/javascript; charset=utf-8")}
# Asset paths are fixed and reviewed. Never allow arbitrary file system traversal.
for _name in (
    "robot/rbot-wheel.stl", "robot/rbot-camera.stl", "robot/delivery-cad-part.stl",
    "world/warehouse-shelf.dae", "world/warehouse-lamp.dae",
    "world/warehouse-cargo.dae", "world/warehouse-roof.dae",
    "world/cafe-table.dae", "world/clearpath-office.dae",
):
    STATIC["/assets/" + _name] = ("assets/" + _name,
        "model/stl" if _name.endswith(".stl") else "model/vnd.collada+xml")
for _name in ("Maple.jpg", "Wood_Floor_Dark.jpg"):
    _asset = "assets/world/" + _name
    STATIC["/" + _asset] = (_asset,"image/jpeg")
for _name in (
    "ShelfD_01","ShelfD_02","ShelfD_03","ShelfD_04",
    "Lamp_01","RoofB_01","ClutteringA_01","ClutteringA_02","ClutteringA_03"
):
    _asset = "assets/materials/textures/aws_robomaker_warehouse_" + _name + ".png"
    STATIC["/" + _asset] = (_asset,"image/png")


def response_for(path: str) -> tuple[int, str, bytes]:
    parsed = urlsplit(path)
    if parsed.path in STATIC:
        filename, media_type = STATIC[parsed.path]
        return 200, media_type, (ROOT / filename).read_bytes()
    if parsed.path == "/api/references":
        catalog = Path(__file__).resolve().parents[1] / "integrations/reference_catalog.json"
        return 200, "application/json", catalog.read_bytes()
    if parsed.path == "/api/gazebo-evidence":
        # Archived physics-engine odometry from an identified historical CI run.
        # Never label these values as current, live or hardware measurements.
        evidence = Path(__file__).resolve().parents[1] / "experiments/gazebo_smoke/motion_summary.json"
        return 200, "application/json", evidence.read_bytes()
    if parsed.path == "/api/map":
        return 200, "application/json", json.dumps(Campus().as_dict()).encode()
    if parsed.path == "/api/run":
        try:
            query = parse_qs(parsed.query, strict_parsing=True)
            if any(len(v) != 1 for v in query.values()):
                raise ValueError("duplicate options not allowed")
            unknown = set(query)-{"destination", "scenario", "seed", "handover"}
            if unknown:
                raise ValueError("unknown option")
            seed = int(query.get("seed", ["7"])[0])
            if not 0 <= seed <= 1000000:
                raise ValueError("seed out of range")
            handover = query.get("handover", ["authorized"])[0]
            if handover not in ("authorized", "denied"):
                raise ValueError("invalid handover")
            options = ReplayOptions(
                seed=seed, destination=query.get("destination", ["library"])[0],
                scenario=query.get("scenario", ["construction"])[0],
                authorized_handover=(handover == "authorized"))
            return 200, "application/json", json.dumps(replay(options)).encode()
        except (TypeError, ValueError) as exc:
            return 400, "application/json", json.dumps({"error": str(exc)}).encode()
    return 404, "application/json", b'{"error":"not found"}'


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        code, media_type, body = response_for(self.path)
        self.send_response(code)
        self.send_header("Content-Type", media_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; script-src 'self'; style-src 'self'; "
                         "img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)


def main():
    import argparse
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--port", type=int, default=8765)
    args = p.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
        print(f"Campus diagnostic console: http://127.0.0.1:{server.server_port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
