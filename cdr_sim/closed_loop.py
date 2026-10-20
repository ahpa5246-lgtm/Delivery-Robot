"""Deterministic closed-loop, range-triggered 2-D delivery testbed.

The scenario uses a *synthetic* range observation of one obstacle hidden from
A* until observed. It is not LiDAR, Gazebo, ROS2 or validated wheel dynamics.
Every integration step checks the exact swept robot disk against the obstacle
and the authoritative static map. Braking is limited by a fixed deceleration.
"""
from __future__ import annotations

from math import hypot, isfinite
from typing import Sequence

from cdr_sim.campus import (
    Campus, ReplayOptions, NoRoute, astar, path_length, swept_rect_intersects,
)

Point = tuple[float, float]


def point_segment_distance(center: Point, a: Point, b: Point) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    norm = dx * dx + dy * dy
    if norm <= 1e-18:
        return hypot(center[0] - a[0], center[1] - a[1])
    t = max(0.0, min(1.0, ((center[0] - a[0]) * dx + (center[1] - a[1]) * dy) / norm))
    return hypot(center[0] - (a[0] + dx * t), center[1] - (a[1] + dy * t))


def point_along(points: Sequence[Point], at_m: float) -> Point:
    if len(points) < 2 or not (isfinite(at_m) and at_m >= 0):
        raise ValueError("expected a nonempty finite path and nonnegative distance")
    remaining = at_m
    for a, b in zip(points, points[1:]):
        span = hypot(b[0] - a[0], b[1] - a[1])
        if remaining <= span and span > 1e-12:
            f = remaining / span
            return (a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]))
        remaining -= span
    return points[-1]


def closed_loop_replay(options: ReplayOptions, world: Campus) -> dict:
    """Replan using synthetic sensed range; never issue robot commands."""
    if options.scenario != "clear":
        raise ValueError("closed-loop model is selected explicitly for a clear base scenario")
    home = tuple(world.stops["depot"])
    goal = tuple(world.stops[options.destination])
    if options.destination == "depot":
        raise ValueError("destination must differ from depot")
    if not (isfinite(options.accel_mps2) and options.accel_mps2 > 0):
        raise ValueError("positive braking deceleration is required")
    nominal = astar(world, home, goal)
    obstacle_radius = 0.37
    # The obstacle lies ON the nominal route, but is initially unknown to A*.
    obstacle = point_along(nominal, min(8.0, path_length(nominal) * 0.42))
    occupied = world.disk_cells(obstacle, obstacle_radius + world.safety_margin)
    safe_radius = obstacle_radius + world.robot_radius + world.safety_margin
    if hypot(home[0] - obstacle[0], home[1] - obstacle[1]) <= safe_radius + 2:
        raise ValueError("scenario obstacle must be away from initial depot")

    position: Point = home
    speed = 0.0
    elapsed = 0.0
    distance = 0.0
    energy = 0.0
    phase = "OUTBOUND"
    status = "RUNNING"
    reason = None
    detected = False
    stopping = False
    replans = 0
    collision = False
    frames: list[dict] = []
    events: list[dict] = []
    routes: list[dict] = []
    route = list(nominal)
    known_closure: frozenset[tuple[int, int]] = frozenset()
    closest = float("inf")
    min_dynamic_gap = float("inf")
    detection_range_m = 3.0

    def event(state: str, detail: str) -> None:
        events.append({"time_s": round(elapsed, 2), "state": state, "detail": detail})

    def sampled_range() -> float:
        # This is idealized circular ranging to obstacle surface, NOT noisy LiDAR.
        return max(0.0, hypot(position[0] - obstacle[0], position[1] - obstacle[1]) -
                   obstacle_radius)

    def snapshot(force: bool = False) -> None:
        if force or not frames or elapsed - frames[-1]["time_s"] >= 0.79:
            nearest_static = world.clearance(position)
            dynamic_gap = sampled_range() - world.robot_radius
            frames.append({
                "time_s": round(elapsed, 2),
                "x_m": round(position[0], 3),
                "y_m": round(position[1], 3),
                "speed_mps": round(speed, 3),
                "distance_m": round(distance, 3),
                "energy_estimated_wh": round(energy, 4),
                "soc": round(max(0, options.initial_soc - energy / options.battery_wh), 6),
                "phase": phase,
                "obstacle_range_m": round(sampled_range(), 3) if sampled_range() <= detection_range_m else -1.0,
                "minimum_clearance_m": round(min(nearest_static, dynamic_gap), 3),
                "obstacle_detected": detected,
                "replans": replans,
            })

    def verify_step(start: Point, target: Point) -> bool:
        return (world.segment_safe(start, target) and
                point_segment_distance(obstacle, start, target) > safe_radius - 1e-7)

    def replan(destination: Point) -> list[Point]:
        planned = astar(world, position, destination, known_closure)
        for a, b in zip(planned, planned[1:]):
            if not verify_step(a, b):
                raise NoRoute("replanned segment violates exact dynamic obstacle clearance")
        routes.append({"time_s": round(elapsed, 2),
                       "points": [[round(x, 4), round(y, 4)] for x, y in planned]})
        return planned

    routes.append({"time_s": 0.0, "points": [[round(x, 4), round(y, 4)] for x, y in route]})
    event("OUTBOUND", "Offline route begins; dynamic obstruction is not in known A* map")
    snapshot(True)

    while elapsed < options.max_duration_s:
        goal_now = goal if phase in ("OUTBOUND", "BRAKING", "REPLANNING") else home
        if hypot(position[0] - goal_now[0], position[1] - goal_now[1]) <= 0.10 and not stopping:
            speed = 0
            if goal_now == goal:
                if not options.authorized_handover:
                    status, reason, phase = "AWAITING_HANDOVER", "AUTHORIZATION_REQUIRED", "AWAITING_HANDOVER"
                    break
                event("DELIVERED", "Synthetic authorization and handover")
                phase = "RETURNING"
                event(phase, "Returning along map with detected obstruction retained")
                try:
                    route = replan(home)
                except NoRoute:
                    status, reason, phase = "PAUSED_SAFE", "RETURN_ROUTE_BLOCKED", "PAUSED_SAFE"
                    break
                snapshot(True)
                continue
            phase, status = "DOCKED", "COMPLETED"
            event(phase, "Returned to depot without swept-disk intersections")
            break

        # The obstacle exists in simulated ground truth from t=0, but is not
        # revealed to the route planner until a range detection during motion.
        observed_range = sampled_range()
        if not detected and observed_range <= detection_range_m:
            detected = True
            stopping = True
            phase = "BRAKING"
            # v²/(2a) is the minimum continuous-distance bound. Includes one
            # discretization step and the configured safety margin.
            bound = speed * speed / (2 * options.accel_mps2) + speed * options.dt_s
            gap_to_robot = observed_range - world.robot_radius
            event("OBSTACLE_DETECTED",
                  f"Modeled range {observed_range:.3f} m; stopping-distance bound {bound:.3f} m")
            if gap_to_robot < bound + world.safety_margin:
                status, reason, phase = "PAUSED_SAFE", "BRAKING_DISTANCE_UNAVAILABLE", "PAUSED_SAFE"
                speed = 0
                break

        if stopping and speed <= 1e-10:
            known_closure = occupied
            event("REPLANNING", "Stopped; synthetic obstacle inserted into occupied cells")
            try:
                route = replan(goal)
                replans += 1
                phase = "OUTBOUND"
                stopping = False
                event("ROUTE_UPDATED", "New A* route certified against swept static/dynamic geometry")
            except NoRoute:
                status, reason, phase = "PAUSED_SAFE", "NO_SAFE_ALTERNATIVE", "PAUSED_SAFE"
                event(phase, "Obstacle cannot be avoided using known map")
                break
            snapshot(True)
            continue

        while len(route) > 1 and hypot(position[0] - route[1][0], position[1] - route[1][1]) < 1e-6:
            route.pop(0)
        if len(route) < 2:
            status, reason, phase = "PAUSED_SAFE", "ROUTE_EXHAUSTED", "PAUSED_SAFE"
            break
        target = route[1]
        if stopping:
            proposed = max(0.0, speed - options.accel_mps2 * options.dt_s)
        else:
            proposed = min(options.speed_mps, speed + options.accel_mps2 * options.dt_s)
        advance = min(proposed * options.dt_s, hypot(target[0] - position[0], target[1] - position[1]))
        if advance < 1e-12:
            if stopping:
                speed = 0
                continue
            status, reason, phase = "PAUSED_SAFE", "ZERO_PROGRESS", "PAUSED_SAFE"
            break
        length = hypot(target[0] - position[0], target[1] - position[1])
        ratio = advance / length
        next_position = (position[0] + ratio * (target[0] - position[0]),
                         position[1] + ratio * (target[1] - position[1]))
        if not verify_step(position, next_position):
            status, reason, phase = "PAUSED_SAFE", "SWEPT_COLLISION_RISK", "PAUSED_SAFE"
            event(phase, "Motion vetoed by exact conservative collision check")
            speed = 0
            break
        position = next_position
        speed = advance / options.dt_s
        distance += advance
        elapsed += options.dt_s
        energy += advance * options.drive_wh_per_m + options.base_power_w * options.dt_s / 3600
        closest = min(closest, world.clearance(position))
        min_dynamic_gap = min(min_dynamic_gap, sampled_range() - world.robot_radius)
        snapshot()
        if options.initial_soc - energy / options.battery_wh < options.reserve_soc:
            status, reason, phase = "PAUSED_SAFE", "LOW_BATTERY_RESERVE", "PAUSED_SAFE"
            speed = 0
            break
    else:
        status, reason, phase = "FAILED", "REPLAY_TIMEOUT", "FAILED"

    speed = 0
    snapshot(True)
    checked = all(verify_step((a["x_m"], a["y_m"]), (b["x_m"], b["y_m"]))
                  for a, b in zip(frames, frames[1:]))
    if not checked:
        raise AssertionError("generated samples violated collision world")
    return {
        "model": "synthetic-range-closed-loop-v1",
        "world": world.theme,
        "geometry_schema": "cdr-shared-collision-world-v4",
        "hardware_verified": False, "gazebo_verified": False, "ros_navigation_verified": False,
        "synthetic_sensor": True, "sensor_model": "idealized_2d_range_no_noise",
        "seed": options.seed, "scenario": "reactive_obstacle",
        "destination": options.destination, "status": status, "reason": reason,
        "phase": phase, "duration_sim_s": round(elapsed, 2),
        "distance_m": round(distance, 3), "energy_estimated_wh": round(energy, 4),
        "final_soc_estimated": round(max(0, options.initial_soc - energy / options.battery_wh), 6),
        "replans": replans, "collision_detected_in_known_map": collision,
        "collision_objects": len(world.obstacles), "collision_checked": checked,
        "minimum_sampled_clearance_m": round(min(closest, min_dynamic_gap), 4),
        "final_pose_m": [round(x, 3) for x in position],
        "obstacle": {"center_m": [round(v, 4) for v in obstacle],
                     "radius_m": obstacle_radius,
                     "clearance_radius_m": safe_radius,
                     "sensor_range_m": detection_range_m,
                     "detected": detected},
        "routes": routes, "events": events, "frames": frames,
    }
