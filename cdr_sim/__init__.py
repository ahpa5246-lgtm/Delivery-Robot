"""CDR-01 deterministic planar engineering test harness.

A simulation-derived software baseline, NOT Gazebo, ROS 2, or measured hardware.
"""
from .core import Config, Robot, Mission, run_mission

__all__ = ["Config", "Robot", "Mission", "run_mission"]
