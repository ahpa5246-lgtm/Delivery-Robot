#!/usr/bin/env bash
# Single-terminal, source-verified Garden + recorded Gazebo physics preview in Codespaces.
# This does not convert photometric splats into real collision geometry or enable Gazebo GUI.
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

calibration=""
skip_physics=0
check_only=0
usage() {
  cat <<'HELP'
Usage: bash scripts/start_codespaces_full.sh [--calibration FILE] [--check] [--skip-physics]

Default: verify the ORIGINAL Garden LOD ZIP; run a real, bounded headless
Gazebo Harmonic experiment; serve the integrated Garden/robot dashboard on 8765.
The recorded physics uses a flat contact pad, NOT actual Garden collisions.

First open: Codespaces > Ports > port 8765 > Open in Browser (set Private).
Garden: assets/gaussian-garden.zip (original 113 MB SuperSplat Download).
If assets/garden-calibration.json exists it is selected; otherwise the
clearly-labelled world/garden_calibration_example.json placeholder is used.

--calibration FILE  Use the calibration exported from the Garden Settings panel
--check             Validate files/runtime only; do not start physics or server
--skip-physics      Open the viewer without recording a new experiment
HELP
}
while (($#)); do
  case "$1" in
    --calibration)
      if (($# < 2)); then echo "ERROR: --calibration requires FILE" >&2; exit 2; fi
      calibration="$2"; shift 2;;
    --check) check_only=1; shift;;
    --skip-physics) skip_physics=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "ERROR: unknown argument: $1" >&2; usage >&2; exit 2;;
  esac
done

if [[ ! -f /opt/ros/jazzy/setup.bash ]]; then
  echo "ERROR: ROS 2 Jazzy is not installed. Rebuild the Codespace using .devcontainer/." >&2
  exit 2
fi
if (( ! skip_physics )) && ! command -v gz >/dev/null 2>&1; then
  echo "ERROR: Gazebo CLI (gz) is missing; rebuild the Codespace devcontainer." >&2
  exit 2
fi
if [[ -z "$calibration" ]]; then
  if [[ -f assets/garden-calibration.json ]]; then
    calibration="assets/garden-calibration.json"
  else
    calibration="world/garden_calibration_example.json"
  fi
fi
if [[ ! -f "$calibration" ]]; then
  echo "ERROR: missing calibration: $calibration" >&2; exit 2
fi
archive="${CDR_GARDEN_ZIP:-assets/gaussian-garden.zip}"
if [[ ! -f "$archive" ]]; then
  echo "ERROR: The original Garden Gaussian ZIP is missing: $archive" >&2
  echo "Download the 113 MB Garden LOD archive from https://superspl.at/scene/bc0906cd" >&2
  echo "Upload it into Codespaces Explorer as assets/gaussian-garden.zip (do NOT unzip or commit it)." >&2
  echo "For the synthetic campus-only preview use: python3 scripts/serve_dashboard.py" >&2
  exit 2
fi

# Never claim an arbitrary replacement ZIP is the licensed, identified original.
export CDR_GARDEN_ZIP="$archive"
python3 - <<'PY'
import hashlib
import sys
from pathlib import Path
from scripts.serve_dashboard import garden_status
from scripts.generate_garden_gazebo import EXPECTED_SOURCE
path = Path(__import__('os').environ['CDR_GARDEN_ZIP'])
digest = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
if digest != EXPECTED_SOURCE:
    sys.exit("ERROR: Garden ZIP SHA256 mismatch. Expected original archive "
             + EXPECTED_SOURCE + ", got " + digest)
check = garden_status()
if not check.get('installed'):
    sys.exit("ERROR: Garden ZIP has invalid or incomplete 3DGS LOD assets")
print("PASS: Original Garden ZIP, SHA256, and LOD assets verified "
      f"({check.get('lod_levels')} levels, {check.get('entries')} entries)", flush=True)
PY

if [[ "$calibration" == "world/garden_calibration_example.json" ]]; then
  echo "NOTICE: Using EXAMPLE calibration only. Garden placement/scale is NOT surveyed."
  echo "For visual alignment, choose lawn origin in the viewer, export JSON and rerun."
else
  echo "NOTICE: Calibration is operator-supplied and NOT surveyed or terrain-validated."
fi
python3 - "$calibration" <<'PY'
import sys
from pathlib import Path
from scripts.generate_garden_gazebo import calibration_from_file
calibration_from_file(Path(sys.argv[1]))
print("PASS: Flat-proxy calibration schema and provenance validated", flush=True)
PY

if (( check_only )); then
  echo "PASS: Codespaces full preview inputs and runtime available"
  exit 0
fi
if (( ! skip_physics )); then
  echo "RECORDING: Gazebo Harmonic + ROS 2 watchdog (FLAT CONTACT PROXY ONLY)"
  bash scripts/run_garden_gazebo.sh "$calibration"
  python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("experiments/garden_gazebo/latest_run.json").read_text())
assert data["source"] == "recorded_gazebo_harmonic_odometry"
assert data["contact_mesh_validated"] is False
assert data["stopped_at_end"] is True
print(f"PASS: Gazebo recorded {data['samples']} samples / "
      f"{data['odometry_path_length_m']} m, safely stopped in simulation", flush=True)
PY
else
  echo "NOTICE: No new Gazebo run recorded (--skip-physics)"
fi

echo "READY: One dashboard with the Garden 3DGS, controllable robot and recorded Gazebo odometry."
echo "Codespaces > Ports > 8765 > Open in Browser. Keep this terminal running."
echo "In the Garden viewer: Place on lawn > Settings > Replay recorded Gazebo Garden-proxy run."
echo "Gazebo runs headless. This page does NOT contain the Gazebo desktop GUI."
export PYTHONUNBUFFERED=1
exec python3 scripts/serve_dashboard.py
