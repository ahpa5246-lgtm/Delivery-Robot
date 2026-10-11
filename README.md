# Delivery-Robot — Campus Autonomous Delivery Robot (CDR-01)

> Status: **Design specification / pre-implementation** (2026-10-11). No ROS 2 packages, simulation, hardware, or benchmark results are implemented yet.

This repository will host a simulation-first **autonomous ground delivery robot** for university campuses and controlled outdoor pedestrian walkways. The initial scope is **one robot**, with a clean interface for a future multi-robot fleet.

## Baseline decision

- **Operating environment:** paved, pedestrian-only campus paths; no road traffic, kerb climbing, stairs, heavy rain, or unknown rough terrain.
- **Robot:** custom CDR-01, differential drive, two powered wheels and two properly modelled passive casters.
- **Target payload:** 5 kg; **empty mass assumption:** 20 kg; **maximum design mass:** 25 kg.
- **Main software:** Ubuntu 24.04 + ROS 2 Jazzy + Gazebo Harmonic + ros2_control + Nav2 + SLAM Toolbox + robot_localization.
- **Development:** GitHub Codespaces / reproducible containers; headless physics first. Full graphical simulation only on an appropriately provisioned machine.
- **Primary open-source reference:** [rlxai/rbot](https://github.com/rlxai/rbot), not an unreviewed wholesale fork.
- **Secondary reference:** [linorobot2](https://github.com/linorobot/linorobot2), especially physical robot integration.
- **Later fleet extension:** Open-RMF only after one robot's behavior is measured and repeatable.

## Specification index

| Document | What it defines |
| --- | --- |
| [System requirements](docs/SYSTEM_REQUIREMENTS.md) | Operating design domain, requirements, acceptance thresholds and exclusions |
| [Robot & physics](docs/ROBOT_ENGINEERING.md) | Geometry, mass, wheel layout, actuator sizing, sensors, power and safety assumptions |
| [Software architecture](docs/SOFTWARE_ARCHITECTURE.md) | ROS 2 packages, interface contracts, state machines, data ownership and deployment |
| [Verification & validation](docs/VALIDATION_PLAN.md) | Experiments, metrics, ground-truth isolation, reports and reproducibility |
| [Open-source assessment](docs/OPEN_SOURCE_REVIEW.md) | Project comparison, chosen reusable components, license obligations and compatibility risks |
| [Implementation roadmap](docs/ROADMAP.md) | Ordered milestones with exit gates, risk register, and cloud budget strategy |

## Non-negotiable engineering principles

1. No fabricated experimental measurements. Targets and analytical estimates are **not** test results.
2. Evaluation ground truth is isolated from localization and navigation. The robot perceives only simulated sensors.
3. Simulated battery state or command velocity alone does **not** validate real-world range, current, torque, or safety.
4. Operationally unsafe conditions result in stopping, refusal of the mission or supervisor intervention.
5. A delivery is successful only after pickup, travel and handover have all been explicitly confirmed.
6. Every reported run carries version/configuration identifiers, simulation settings, seed and data files.
7. A release must pass defined exit gates before new features are added.

## Current status

Only requirements and planning documentation are being authored. **No executable simulation has been run** and no claimed performance metric has been measured.

## Primary technical references

- [Gazebo / ROS compatibility](https://gazebosim.org/docs/harmonic/ros_installation/)
- [Nav2 first-time robot setup for Gazebo](https://docs.nav2.org/jazzy/configuration_and_development/first_time_robot_setup_guide/gazebo/)
- [ros2_control integration with Gazebo](https://control.ros.org/jazzy/doc/gz_ros2_control/doc/index.html)
- [Gazebo / ROS 2 bridge](https://gazebosim.org/docs/harmonic/ros2_integration/)
