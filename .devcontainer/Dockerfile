FROM ros:jazzy-ros-base

# ROS 2 Jazzy (Ubuntu 24.04) + Gazebo Harmonic integration.
# This cloud image may be large; do not assume it fits all free Codespaces quotas.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       ros-jazzy-ros-gz \
       ros-jazzy-xacro \
       ros-jazzy-robot-state-publisher \
       python3-colcon-common-extensions \
    && rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-c"]
RUN echo 'source /opt/ros/jazzy/setup.bash' >> /root/.bashrc
WORKDIR /workspaces
