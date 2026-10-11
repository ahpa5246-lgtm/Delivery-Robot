# Gazebo Harmonic starter prototype
**Status: Unverified dynamic model**. This directory is separate from the executed 2D software surrogate.

From the checked-in [model generator](../scripts/generate_gazebo_world.py), create a 25 kg loaded 3-D robot with two powered cylindrical wheels, front/rear ball casters, a rigid 5 kg cargo module, IMU, Gazebo DiffDrive plugin, a paved lane and roadside bollards.

```bash
python3 scripts/generate_gazebo_world.py
gz sdf -k simulation/campus_v0.sdf
gz sim -s -r simulation/campus_v0.sdf
```

In a Jazzy environment with `ros-jazzy-ros-gz` installed, run from another shell:
```bash
source /opt/ros/jazzy/setup.bash
ros2 launch ros_gz_bridge ros_gz_bridge.launch.py bridge_name:=cdr01_bridge config_file:="$(pwd)/simulation/ros_gz_bridge.yaml"
ros2 topic echo /robot1/odom
```

Alternatively, `bash scripts/run_ros2_gazebo.sh` starts Gazebo and the ROS bridge (requires the above packages). The generator does **not** yet include LiDAR, SLAM, Nav2, cargo latch behavior, motor torque limits, pedestrian simulation, real power consumption, or certified stop mechanisms. DiffDrive here is a **velocity-control plugin**, not the final dynamic `ros2_control` architecture in the engineering specification. Add these subsystems and validate the resulting contact physics before using odometry/power figures as engineering evidence.

The GitHub [Gazebo smoke workflow](../.github/workflows/gazebo-headless.yml) separately tests installation/start-up and attempts to record an actual Gazebo odometry topic. A passing *geometry-only* unittest must never be confused with a passing Gazebo runtime.
