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
          "/style.css": ("style.css", "text/css; charset=utf-8")}


def response_for(path: str) -> tuple[int, str, bytes]:
    parsed = urlsplit(path)
    if parsed.path in STATIC:
        filename, media_type = STATIC[parsed.path]
        return 200, media_type, (ROOT / filename).read_bytes()
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
