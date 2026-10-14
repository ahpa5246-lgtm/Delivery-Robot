#!/usr/bin/env bash
# Headless, bounded physics experiment. Requires Gazebo Harmonic; not a real robot.
set -euo pipefail
cd "$(dirname "$0")/.."
CALIBRATION="${1:-assets/garden-calibration.json}"
mkdir -p experiments/garden_gazebo
OUT="experiments/garden_gazebo"
python3 scripts/generate_garden_gazebo.py --calibration "$CALIBRATION"
gz sdf -k simulation/garden_physics_proxy.sdf > "$OUT/sdf_validation.txt"
gz sim -s -r -v 2 simulation/garden_physics_proxy.sdf > "$OUT/gazebo_server.log" 2>&1 &
SIM_PID=$!
RECORD_PID=''
cleanup(){
  # Stop the entire disposable Gazebo world after this scripted run.
  if [[ -n "$RECORD_PID" ]];then kill "$RECORD_PID" 2>/dev/null || true;fi
  kill "$SIM_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
for n in $(seq 1 30);do
  if gz topic -l | grep -q '^/model/cdr01/odometry$';then break;fi
  sleep 1
done
gz topic -l | grep -q '^/model/cdr01/odometry$' || { echo 'ERROR: Gazebo odometry topic missing'; exit 1; }
timeout 27 gz topic -e -t /model/cdr01/odometry > "$OUT/odometry_raw.txt" 2>&1 &
RECORD_PID=$!
sleep 2
# Explicit 4 s speed-limited command in a disposable simulation; always zero.
for n in $(seq 1 40);do
  gz topic -t /model/cdr01/cmd_vel -m gz.msgs.Twist -p 'linear: {x: 0.20}' >/dev/null
  sleep .1
done
for n in $(seq 1 20);do
  gz topic -t /model/cdr01/cmd_vel -m gz.msgs.Twist -p 'linear: {x: 0.0}' >/dev/null
  sleep .1
done
sleep 2
kill "$RECORD_PID" 2>/dev/null || true
wait "$RECORD_PID" 2>/dev/null || true
RECORD_PID=''
python3 scripts/export_garden_odometry.py "$OUT/odometry_raw.txt" \
  --provenance simulation/garden_physics_proxy.provenance.json \
  --output "$OUT/latest_run.json"
python3 - <<'PY'
import json
r=json.load(open('experiments/garden_gazebo/latest_run.json'))
if r['samples']<5 or r['odometry_displacement_m']<0.10:
    raise SystemExit('FAIL: insufficient measured odometry displacement from Gazebo')
print('PASS: authentic Gazebo odometry observed. NOT validated Garden surface collision.')
PY
