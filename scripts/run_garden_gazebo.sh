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
BRIDGE_PID=''
WATCHDOG_PID=''
cleanup(){
  # The simulator is disposable; shutdown is a guaranteed final safeguard.
  if [[ -n "$RECORD_PID" ]];then kill "$RECORD_PID" 2>/dev/null || true;fi
  if [[ -n "$WATCHDOG_PID" ]];then kill "$WATCHDOG_PID" 2>/dev/null || true;fi
  if [[ -n "$BRIDGE_PID" ]];then kill "$BRIDGE_PID" 2>/dev/null || true;fi
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
# Gazebo DiffDrive retains a velocity if direct gz topic commands stop.
# Route ALL commands through ROS 2 + watchdog at 20Hz; timeout forces zeros.
# ROS-generated setup script assumes some unset AMENT vars; source without nounset.
set +u
source /opt/ros/jazzy/setup.bash
set -u
ros2 launch ros_gz_bridge ros_gz_bridge.launch.py \
  bridge_name:=cdr01_garden_bridge \
  config_file:="$(pwd)/simulation/ros_gz_bridge.yaml" \
  > "$OUT/ros_bridge.log" 2>&1 &
BRIDGE_PID=$!
python3 scripts/ros_velocity_watchdog.py > "$OUT/watchdog.log" 2>&1 &
WATCHDOG_PID=$!
sleep 6
python3 scripts/drive_garden_ros2.py --drive-seconds 3 --speed-mps 0.2 --zero-seconds 4
sleep 3
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
if not r['stopped_at_end']:
    raise SystemExit('FAIL: robot did NOT stop in recorded Gazebo last 2s: '+
                     str(r['final_2s_mean_odometry_speed_mps'])+' m/s')
print('PASS: real Gazebo movement and subsequent measured stop on flat proxy pad.')
PY
