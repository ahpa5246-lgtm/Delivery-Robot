"""Dependency-free campus route planning and delivery *kinematic* replay.

A deterministic software testbed, NOT a ROS/Gazebo controller. Known buildings
form an offline map; a scripted construction closure is revealed to the planner
only on the simulated detection event. The source of simulated truth is not fed
to a live robot. No physical actuation occurs here.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from heapq import heappop, heappush
from math import hypot, isfinite
import random


Point = tuple[float, float]
Cell = tuple[int, int]


@dataclass(frozen=True)
class Campus:
    width: float = 32.0
    height: float = 20.0
    resolution: float = 0.5
    robot_radius: float = 0.35
    buildings: tuple[tuple[float, float, float, float], ...] = (
        (8.0, 0.0, 13.0, 6.0),
        (8.0, 11.0, 13.0, 20.0),
        (19.0, 7.0, 24.0, 13.0),
        (2.0, 8.0, 5.0, 11.0),
    )
    stops: dict[str, Point] = field(default_factory=lambda: {
        "depot": (2.0, 2.0),
        "engineering": (5.5, 16.0),
        "library": (28.0, 16.0),
        "student_center": (28.0, 3.0),
    })

    @property
    def shape(self) -> tuple[int, int]:
        return (round(self.width / self.resolution), round(self.height / self.resolution))

    def cell(self, point: Point) -> Cell:
        return (int(point[0] / self.resolution), int(point[1] / self.resolution))

    def center(self, cell: Cell) -> Point:
        return ((cell[0] + 0.5) * self.resolution, (cell[1] + 0.5) * self.resolution)

    def free(self, cell: Cell, closure: frozenset[Cell] = frozenset()) -> bool:
        nx, ny = self.shape
        x, y = self.center(cell)
        pad = self.robot_radius
        if not (0 <= cell[0] < nx and 0 <= cell[1] < ny):
            return False
        if x < pad or y < pad or x > self.width - pad or y > self.height - pad:
            return False
        if cell in closure:
            return False
        return all(not (x0-pad <= x <= x1+pad and y0-pad <= y <= y1+pad)
                   for x0, y0, x1, y1 in self.buildings)

    def disk_cells(self, point: Point, radius: float) -> frozenset[Cell]:
        if radius <= 0 or not isfinite(radius):
            raise ValueError("radius must be positive and finite")
        cx, cy = self.cell(point)
        reach = int((radius + self.resolution) / self.resolution) + 1
        return frozenset(
            (i, j)
            for i in range(cx-reach, cx+reach+1)
            for j in range(cy-reach, cy+reach+1)
            if hypot(*(a-b for a, b in zip(self.center((i, j)), point))) <= radius+self.robot_radius
        )

    def visible(self, a: Point, b: Point, closure: frozenset[Cell] = frozenset()) -> bool:
        """Supercover cell traversal: *every* grid square touched must be free.

        A grid sample test can skip a thin occupied sliver between samples,
        leading to false-free straight-line shortcuts. Explicit cell traversal
        uses boundary crossing times (2-D DDA) and checks corner neighbors.
        """
        from math import inf
        start, target = self.cell(a), self.cell(b)
        if not self.free(start, closure) or not self.free(target, closure):
            return False
        if start == target:
            return True
        dx, dy = b[0]-a[0], b[1]-a[1]
        step_x = (1 if dx > 0 else -1) if dx else 0
        step_y = (1 if dy > 0 else -1) if dy else 0
        delta_x = abs(self.resolution/dx) if dx else inf
        delta_y = abs(self.resolution/dy) if dy else inf
        x, y = start
        bound_x = (x+1 if dx > 0 else x)*self.resolution
        bound_y = (y+1 if dy > 0 else y)*self.resolution
        t_x = (bound_x-a[0])/dx if dx else inf
        t_y = (bound_y-a[1])/dy if dy else inf
        # A segment cannot traverse more grid cells than the map perimeter.
        for _ in range(sum(self.shape)+5):
            if (x, y) == target:
                return True
            if t_x < t_y-1e-12:
                x += step_x
                t_x += delta_x
            elif t_y < t_x-1e-12:
                y += step_y
                t_y += delta_y
            else:
                if not (self.free((x+step_x,y),closure)
                        and self.free((x,y+step_y),closure)):
                    return False
                x += step_x
                y += step_y
                t_x += delta_x
                t_y += delta_y
            if not self.free((x,y),closure):
                return False
        return False

    def as_dict(self) -> dict:
        return {"width_m": self.width, "height_m": self.height,
                "resolution_m": self.resolution, "robot_radius_m": self.robot_radius,
                "buildings": [list(r) for r in self.buildings],
                "stops": {k: list(v) for k, v in self.stops.items()}}


class NoRoute(Exception):
    """Destination cannot be reached within the known occupancy grid."""


def astar(campus: Campus, start: Point, goal: Point,
          closure: frozenset[Cell] = frozenset()) -> list[Point]:
    """Inflated 8-connected A*; rejects diagonal corner-cutting and blocked goals."""
    s, g = campus.cell(start), campus.cell(goal)
    if not campus.free(s, closure) or not campus.free(g, closure):
        raise NoRoute("blocked start or goal")
    neighbors = ((1, 0), (0, 1), (-1, 0), (0, -1),
                 (1, 1), (1, -1), (-1, 1), (-1, -1))
    queue = [(hypot(g[0]-s[0], g[1]-s[1]), 0.0, s)]
    cost = {s: 0.0}
    parent: dict[Cell, Cell] = {}
    while queue:
        _, current_cost, cell = heappop(queue)
        if current_cost > cost[cell] + 1e-8:
            continue
        if cell == g:
            chain = [g]
            while chain[-1] != s:
                chain.append(parent[chain[-1]])
            chain.reverse()
            # Conservative line-of-sight shortcut only, checked against inflated occupancy.
            points = [start]
            route = [campus.center(p) for p in chain[1:-1]] + [goal]
            i = 0
            while i < len(route):
                j = len(route)-1
                while j > i and not campus.visible(points[-1], route[j], closure):
                    j -= 1
                if not campus.visible(points[-1], route[j], closure):
                    raise NoRoute("grid route was not segment-safe")
                points.append(route[j])
                i = j+1
            return points
        for dx, dy in neighbors:
            nxt = (cell[0]+dx, cell[1]+dy)
            if not campus.free(nxt, closure):
                continue
            if dx and dy and (not campus.free((cell[0]+dx, cell[1]), closure)
                              or not campus.free((cell[0], cell[1]+dy), closure)):
                continue
            candidate = current_cost + hypot(dx, dy)
            if candidate + 1e-8 < cost.get(nxt, float("inf")):
                cost[nxt] = candidate
                parent[nxt] = cell
                h = hypot(g[0]-nxt[0], g[1]-nxt[1])
                heappush(queue, (candidate + h, candidate, nxt))
    raise NoRoute("no free corridor to destination")


def path_length(route: list[Point]) -> float:
    return sum(hypot(b[0]-a[0], b[1]-a[1]) for a, b in zip(route, route[1:]))


@dataclass(frozen=True)
class ReplayOptions:
    seed: int = 0
    destination: str = "library"
    scenario: str = "clear"
    initial_soc: float = 0.85
    authorized_handover: bool = True
    # Kinematic limits, deliberately NOT a validated motor or contact model.
    speed_mps: float = 0.65
    accel_mps2: float = 0.30
    dt_s: float = 0.2
    battery_wh: float = 480.0
    base_power_w: float = 22.0
    drive_wh_per_m: float = 0.075
    reserve_soc: float = 0.20
    max_duration_s: float = 600.0

    def __post_init__(self):
        if self.scenario not in {"clear", "construction", "sensor_dropout", "estop"}:
            raise ValueError("unknown scenario")
        values = (self.initial_soc, self.speed_mps, self.accel_mps2, self.dt_s,
                  self.battery_wh, self.base_power_w, self.drive_wh_per_m,
                  self.reserve_soc, self.max_duration_s)
        if not all(isfinite(v) for v in values):
            raise ValueError("nonfinite replay option")
        if not (0 <= self.initial_soc <= 1 and 0 <= self.reserve_soc < 1):
            raise ValueError("invalid state of charge")
        if min(self.speed_mps, self.accel_mps2, self.dt_s,
               self.battery_wh, self.max_duration_s) <= 0:
            raise ValueError("invalid kinematics or battery")
        if self.base_power_w < 0 or self.drive_wh_per_m < 0 or self.seed < 0:
            raise ValueError("invalid energy or seed")


def replay(options: ReplayOptions = ReplayOptions(), campus: Campus | None = None) -> dict:
    """Simulate pickup -> destination -> explicitly authorized handover -> dock.

    Returns timed poses/event log for an operator dashboard. Never sends commands
    to ROS or Gazebo. Closure detection and stale-sensor event are scripted.
    """
    world = campus or Campus()
    if options.destination not in world.stops or options.destination == "depot":
        raise ValueError("invalid delivery destination")
    home, goal = world.stops["depot"], world.stops[options.destination]
    rng = random.Random(options.seed)
    position = home
    time_s = 0.0
    velocity = 0.0
    distance = 0.0
    energy = 0.0
    replans = 0
    closure: frozenset[Cell] = frozenset()
    events: list[dict] = []
    frames: list[dict] = []
    phase = "VALIDATING"
    status = "RUNNING"
    reason = None
    collision = False
    injected = False
    route: list[Point] = []
    planned_routes: list[dict] = []

    def soc() -> float:
        return max(0.0, options.initial_soc-energy/options.battery_wh)

    def event(name: str, description: str) -> None:
        events.append({"time_s": round(time_s, 2), "state": name, "detail": description})

    def frame(force: bool = False) -> None:
        if force or not frames or time_s-frames[-1]["time_s"] >= 0.79:
            frames.append({"time_s": round(time_s, 2), "x_m": round(position[0], 3),
                           "y_m": round(position[1], 3), "speed_mps": round(velocity, 3),
                           "soc": round(soc(), 6), "energy_estimated_wh": round(energy, 4),
                           "phase": phase})

    def plan(destination: Point) -> list[Point]:
        candidate = astar(world, position, destination, closure)
        planned_routes.append({"time_s": round(time_s, 2),
                               "points": [[round(x, 3), round(y, 3)] for x, y in candidate]})
        return candidate

    def enough_energy(length_m: float) -> bool:
        # Conservative baseline for base load during the approximate trip duration.
        estimate = 1.5 * (length_m * options.drive_wh_per_m +
                          length_m / options.speed_mps * options.base_power_w / 3600)
        return soc()*options.battery_wh - estimate >= options.reserve_soc*options.battery_wh

    event("VALIDATING", "Checking route and modeled battery reserve")
    frame(True)
    try:
        outward = plan(goal)
        backward = astar(world, goal, home)
    except NoRoute:
        status, reason, phase = "REJECTED", "NO_ROUTE", "REJECTED"
    else:
        if not enough_energy(path_length(outward)+path_length(backward)):
            status, reason, phase = "REJECTED", "LOW_BATTERY_RESERVE", "REJECTED"
        else:
            phase = "PICKUP"
            event(phase, "Synthetic cargo loaded; compartment closed and locked")
            phase = "OUTBOUND"
            event(phase, "Autonomous kinematic route replay started")
            route = outward

    if status == "RUNNING":
        while time_s < options.max_duration_s:
            # Synthetic sensors reveal new information at this point. Scripted fault
            # injection is NOT a substitute for a real proximity or freshness monitor.
            if not injected and distance >= 4.0:
                if options.scenario in ("estop", "sensor_dropout"):
                    phase = "PAUSED_SAFE"
                    status = "PAUSED_SAFE"
                    reason = ("ESTOP_LATCHED" if options.scenario == "estop"
                              else "SENSOR_STALE")
                    velocity = 0.0
                    event(phase, reason + ": no further movement permitted")
                    break
                if options.scenario == "construction":
                    # Construction geometry becomes part of *known* occupancy only now.
                    # Place it further down the current planned route, not under robot.
                    ahead = route[min(len(route)-2, max(1, len(route)//2))]
                    if hypot(ahead[0]-position[0], ahead[1]-position[1]) < 2.0:
                        ahead = (min(world.width-2, position[0]+3.0), position[1])
                    closure = world.disk_cells(ahead, 0.95+rng.uniform(0.0, 0.15))
                    injected = True
                    velocity = 0.0
                    event("REPLANNING", "Simulated construction blockage detected by sensor")
                    try:
                        route = plan(goal if phase == "OUTBOUND" else home)
                        replans += 1
                    except NoRoute:
                        status, reason, phase = "PAUSED_SAFE", "ROUTE_BLOCKED", "PAUSED_SAFE"
                        event(phase, reason)
                        break
                    if not enough_energy(path_length(route) +
                                         (path_length(astar(world,goal,home,closure))
                                          if phase=="OUTBOUND" else 0)):
                        status, reason, phase = "PAUSED_SAFE", "LOW_BATTERY_RESERVE", "PAUSED_SAFE"
                        event(phase, reason)
                        break
                    event(phase, "New safe route selected")
            destination = goal if phase == "OUTBOUND" else home
            if hypot(position[0]-destination[0], position[1]-destination[1]) <= 0.10:
                velocity = 0.0
                if phase == "OUTBOUND":
                    phase = "AWAITING_HANDOVER"
                    event(phase, "Arrived with synthetic locked cargo")
                    if not options.authorized_handover:
                        status, reason = "AWAITING_HANDOVER", "AUTHORIZATION_REQUIRED"
                        break
                    phase = "DELIVERED"
                    event(phase, "Authorized synthetic recipient removed cargo")
                    phase = "RETURNING"
                    event(phase, "Returning empty compartment to depot")
                    try:
                        route = plan(home)
                    except NoRoute:
                        status, reason, phase = "PAUSED_SAFE", "RETURN_ROUTE_BLOCKED", "PAUSED_SAFE"
                        event(phase, reason)
                        break
                    continue
                phase = "DOCKED"
                status = "COMPLETED"
                event(phase, "Returned to depot; simulated mission complete")
                break
            # Consume waypoints only once reached. Segment interpolation is collision
            # checked against the known inflated occupancy grid.
            while len(route) > 1 and hypot(position[0]-route[1][0],
                                           position[1]-route[1][1]) < 1e-6:
                route.pop(0)
            if len(route) <= 1:
                status, reason, phase = "PAUSED_SAFE", "INVALID_ROUTE", "PAUSED_SAFE"
                event(phase, reason)
                break
            waypoint = route[1]
            step_v = min(options.speed_mps, velocity+options.accel_mps2*options.dt_s)
            step = min(step_v*options.dt_s,
                       hypot(waypoint[0]-position[0],waypoint[1]-position[1]))
            if step < 1e-8:
                status, reason, phase = "PAUSED_SAFE", "ZERO_PROGRESS", "PAUSED_SAFE"
                event(phase, reason)
                break
            ratio = step/hypot(waypoint[0]-position[0],waypoint[1]-position[1])
            next_point = (position[0]+(waypoint[0]-position[0])*ratio,
                          position[1]+(waypoint[1]-position[1])*ratio)
            if not world.visible(position, next_point, closure):
                status, reason, phase = "PAUSED_SAFE", "OBSTACLE_PROXIMITY", "PAUSED_SAFE"
                velocity = 0.0
                event(phase, reason)
                break
            position = next_point
            velocity = step/options.dt_s
            distance += step
            time_s += options.dt_s
            energy += step*options.drive_wh_per_m+options.base_power_w*options.dt_s/3600
            frame()
            if soc() < options.reserve_soc:
                status, reason, phase = "PAUSED_SAFE", "BATTERY_RESERVE_REACHED", "PAUSED_SAFE"
                velocity = 0.0
                event(phase, reason)
                break
        else:
            status, reason, phase = "FAILED", "REPLAY_TIMEOUT", "FAILED"
            velocity = 0.0
            event(phase, reason)
    frame(True)
    return {
        "model": "campus-kinematic-replay-v1", "hardware_verified": False,
        "gazebo_verified": False, "ros_navigation_verified": False,
        "seed": options.seed, "scenario": options.scenario,
        "destination": options.destination, "status": status, "reason": reason,
        "phase": phase, "duration_sim_s": round(time_s, 2),
        "distance_m": round(distance, 3), "energy_estimated_wh": round(energy, 4),
        "final_soc_estimated": round(soc(), 6), "replans": replans,
        "collision_detected_in_known_map": collision,
        "final_pose_m": [round(x, 3) for x in position],
        "closure_cells": [list(c) for c in sorted(closure)],
        "routes": planned_routes, "events": events, "frames": frames
    }
