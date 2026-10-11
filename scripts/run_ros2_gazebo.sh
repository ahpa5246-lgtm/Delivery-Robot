#!/usr/bin/env bash
# Requires Jazzy/Harmonic; intended for the provided Codespace (NOT run in planning environment).
set -eo pipefail
cd "$(dirname "$0")/.."
source /opt/ros/jazzy/setup.bash
python3 scripts/generate_gazebo_world.py
gz sim -s -r simulation/campus_v0.sdf &
GZ_PID=$!
trap 'kill "$GZ_PID" 2>/dev/null || true' EXIT
ros2 launch ros_gz_bridge ros_gz_bridge.launch.py \
    bridge_name:=cdr01_bridge \
    config_file:="$(pwd)/simulation/ros_gz_bridge.yaml"
