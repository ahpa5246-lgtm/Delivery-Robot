"""Planar 2-D differential-drive delivery simulator: scoped *software surrogate*.

Uses force limits, grade/rolling resistance, synthetic ranging, odometry noise and
battery bookkeeping. NOT a calibrated vehicle/contact simulation or a ROS node.
"""
from dataclasses import dataclass, field
from math import atan2, cos, sin, hypot, pi, radians
import random


def wrap(a):
    return (a + pi) % (2 * pi) - pi


@dataclass(frozen=True)
class Config:
    mass_empty_kg: float = 20.0
    payload_kg: float = 5.0
    wheel_radius_m: float = 0.12
    wheel_track_m: float = 0.38
    continuous_wheel_torque_nm: float = 5.0
    max_speed_mps: float = 0.8
    accel_limit_mps2: float = 0.3
    angular_speed_limit_radps: float = 0.8
    angular_accel_limit_radps2: float = 1.0
    rolling_resistance: float = 0.03
    grade_deg: float = 0.0
    friction: float = 0.6
    robot_radius_m: float = 0.32
    battery_wh: float = 480.0
    initial_soc: float = 0.85
    base_power_w: float = 22.0
    motor_efficiency: float = 0.70
    lidar_noise_sigma_m: float = 0.012
    odom_scale_error: float = 0.002
    odom_noise_sigma_m: float = 0.001
    dt_s: float = 0.05
    safety_stop_distance_m: float = 1.85
    contact_distance_m: float = 0.32
    goal_tolerance_m: float = 0.18
    route_length_m: float = 25.0
    stop_timeout_s: float = 0.5
    max_simulation_s: float = 180.0

    def __post_init__(self):
        if not 0 <= self.payload_kg <= 5:
            raise ValueError("payload outside 0–5kg target")
        if not 0 <= self.grade_deg <= 5:
            raise ValueError("grade outside documented ODD 0–5deg")
        if not 0 < self.dt_s <= 0.1 or self.mass_empty_kg <= 0:
            raise ValueError("invalid simulation time-step or mass")
        if not 0 < self.initial_soc <= 1 or self.friction <= 0:
            raise ValueError("invalid battery state or friction")


@dataclass
class Mission:
    request_id: str
    state: str = "IDLE"
    payload_present: bool = False
    compartment_locked: bool = True
    door_open: bool = False
    authorized_handover: bool = False
    events: list = field(default_factory=list)

    def transition(self, state: str, t: float):
        self.state = state
        self.events.append({"sim_time_s": round(t, 3), "state": state})

    def load(self, t: float):
        if self.state != "PICKUP" or self.payload_present:
            raise ValueError("payload unavailable for loading")
        self.door_open = True
        self.compartment_locked = False
        self.payload_present = True
        self.door_open = False
        self.compartment_locked = True
        self.transition("IN_TRANSIT", t)

    def handover(self, t: float, authorized: bool):
        if self.state != "ARRIVED" or not authorized:
            raise PermissionError("authorized arrival required")
        self.authorized_handover = True
        self.compartment_locked = False
        self.door_open = True
        self.payload_present = False  # explicit synthetic recipient-removal event
        self.door_open = False
        self.compartment_locked = True
        self.transition("COMPLETED", t)


@dataclass
class Robot:
    cfg: Config
    seed: int
    x: float = 0.0
    y: float = 0.0
    yaw: float = 0.0
    v: float = 0.0
    omega: float = 0.0
    t: float = 0.0
    estimated_x: float = 0.0
    estimated_y: float = 0.0
    estimated_yaw: float = 0.0
    min_soc: float = 1.0
    energy_wh: float = 0.0
    distance_m: float = 0.0
    max_motor_torque_nm: float = 0.0
    max_speed_observed_mps: float = 0.0
    contact_events: int = 0
    safe_stop_events: int = 0
    battery_soc: float = 0.0
    interlocked: bool = False
    stale_sensor: bool = False
    latched_stop: bool = False
    last_sensor_t: float = 0.0
    first_stop_latency_s: float | None = None

    def __post_init__(self):
        self.rng = random.Random(self.seed)
        self.battery_soc = self.cfg.initial_soc
        self.min_soc = self.battery_soc

    def command(self, desired_v: float, desired_omega: float, closest_obstacle_m: float,
                mission: Mission | None = None):
        c = self.cfg
        if mission and (mission.door_open or not mission.compartment_locked):
            self.interlocked = True
        unsafe = (self.interlocked or self.latched_stop or self.stale_sensor or
                  self.t - self.last_sensor_t > c.stop_timeout_s or
                  closest_obstacle_m < c.safety_stop_distance_m)
        if unsafe:
            if desired_v > 0.0 and self.v > 0.001:
                self.safe_stop_events += 1
            desired_v = desired_omega = 0.0
        desired_v = max(-c.max_speed_mps, min(c.max_speed_mps, desired_v))
        desired_omega = max(-c.angular_speed_limit_radps, min(c.angular_speed_limit_radps, desired_omega))
        return desired_v, desired_omega, unsafe

    def step(self, target_v: float, target_omega: float):
        c = self.cfg
        dt = c.dt_s
        m = c.mass_empty_kg + c.payload_kg
        resist_n = m * 9.81 * (sin(radians(c.grade_deg)) + c.rolling_resistance * cos(radians(c.grade_deg)))
        drive_force_n = min(2 * c.continuous_wheel_torque_nm / c.wheel_radius_m, c.friction * m * 9.81)
        available_accel = max(0.0, (drive_force_n - resist_n) / m)
        a_limit = min(c.accel_limit_mps2, available_accel)
        desired_dv = target_v - self.v
        # Braking treated as software-limited to a_limit, with additional emergency allowance.
        a_step = max(-c.accel_limit_mps2 * dt, min(a_limit * dt, desired_dv))
        old_v = self.v
        self.v = max(-c.max_speed_mps, min(c.max_speed_mps, self.v + a_step))
        self.omega += max(-c.angular_accel_limit_radps2 * dt,
                          min(c.angular_accel_limit_radps2 * dt, target_omega - self.omega))
        self.omega = max(-c.angular_speed_limit_radps, min(c.angular_speed_limit_radps, self.omega))
        self.yaw = wrap(self.yaw + self.omega * dt)
        dx = self.v * cos(self.yaw) * dt
        dy = self.v * sin(self.yaw) * dt
        self.x += dx
        self.y += dy
        delta = hypot(dx, dy)
        self.distance_m += delta
        self.t += dt
        # Traction demand and speed logged at wheel level (approximation; caster drag unmodelled).
        demand_force = min(drive_force_n, resist_n + m * max(0.0, (self.v-old_v)/dt))
        self.max_motor_torque_nm = max(self.max_motor_torque_nm, abs(demand_force*c.wheel_radius_m/2))
        self.max_speed_observed_mps = max(self.max_speed_observed_mps, abs(self.v))
        wheel_power_w = max(0.0, demand_force * abs(self.v)) / c.motor_efficiency
        self.energy_wh += (wheel_power_w + c.base_power_w) * dt / 3600.0
        self.battery_soc = max(0.0, c.initial_soc - self.energy_wh / c.battery_wh)
        self.min_soc = min(self.min_soc, self.battery_soc)
        # Dead reckoning from simulated wheel odometry, not access to truth pose.
        odom_step = delta * (1 + c.odom_scale_error) + self.rng.gauss(0, c.odom_noise_sigma_m)
        est_omega = self.omega + self.rng.gauss(0, 0.002)
        self.estimated_yaw = wrap(self.estimated_yaw + est_omega*dt)
        self.estimated_x += odom_step * cos(self.estimated_yaw)
        self.estimated_y += odom_step * sin(self.estimated_yaw)


def obstacle_range(x: float, y: float, obstacles: list[tuple[float,float,float]]) -> float:
    """Short-range circular-obstacle proximity surrogate, not a raytraced LiDAR scan."""
    return min((max(0.0, hypot(x-ox, y-oy) - radius)
                for ox,oy,radius in obstacles), default=100.0)


def run_mission(seed: int, cfg: Config | None = None, *, obstacle: bool = True,
                inject_sensor_fault: bool = False) -> dict:
    """Execute one reproducible scripted delivery to a point in a 2D physics-inspired model."""
    c = cfg or Config()
    bot = Robot(c, seed)
    mission = Mission(request_id=f"benchmark-{seed}")
    mission.transition("VALIDATING", bot.t)
    mission.transition("PICKUP", bot.t)
    mission.load(bot.t)
    goal = c.route_length_m
    # Stationary obstacles lie off the lane; one seeded pedestrian crosses the lane near x=12.
    px = 12.0 + bot.rng.uniform(-1.0, 1.0)
    py0 = -2.5 - bot.rng.uniform(0.0, 0.5)
    crossing_speed = 0.55 + bot.rng.uniform(0.0, 0.2)
    crossing_start = 10 + bot.rng.uniform(0, 8)
    contact_details=[]
    localization_errors_sq=[]
    sample=[]
    max_lidar_error=0
    fault_injected=False
    reported_failure_reason=None
    n_steps=int(c.max_simulation_s / c.dt_s)
    for i in range(n_steps):
        if inject_sensor_fault and not fault_injected and bot.x >= 6.0:
            bot.stale_sensor=True
            fault_injected=True
            mission.transition("PAUSED_SAFE",bot.t)
        pedestrian_y = py0+crossing_speed*max(0.0,bot.t-crossing_start)
        pedestrian_y = min(2.5,pedestrian_y)
        obstacles=([(px,pedestrian_y,0.28),(8.0,2.0,0.35),(20.0,-1.8,0.35)] if obstacle else [])
        actual_proximity = obstacle_range(bot.x,bot.y,obstacles)
        # Prospective stop checks are restricted to obstacles in the drive corridor.
        # This is NOT a Nav2 costmap or a full obstacle-tracking algorithm.
        pedestrian_future_y = min(2.5, py0+crossing_speed*max(0.0,bot.t+8.0-crossing_start))
        driving_hazards = []
        for j,(ox,oy,rr) in enumerate(obstacles):
            future_y = pedestrian_future_y if j == 0 else oy
            corridor = c.robot_radius_m+rr+0.25
            if ox > bot.x - 0.3 and (abs(oy-bot.y)<=corridor or
                                    (j==0 and min(oy,future_y)<=corridor and max(oy,future_y)>=-corridor)):
                driving_hazards.append((ox,oy,rr))
        # Use conservative along-track clearance for a crossing hazard; avoid
        # optimistic diagonal range as the pedestrian moves toward the lane.
        forward_proximity = min((max(0.0,ox-bot.x-rr) for ox,oy,rr in driving_hazards),default=100.0)
        noisy_proximity=max(0, forward_proximity+bot.rng.gauss(0,c.lidar_noise_sigma_m))
        max_lidar_error=max(max_lidar_error,abs(noisy_proximity-forward_proximity))
        # Simple campus route: one straight surveyed corridor. No Nav2 or real path planner here.
        remaining=goal-bot.x
        desired_v = min(c.max_speed_mps,max(0.0, 0.6*remaining))
        desired_v=0.0 if remaining<=c.goal_tolerance_m else desired_v
        desired_omega=max(-0.5,min(0.5,-1.6*bot.y -0.8*wrap(bot.yaw)))
        bot.last_sensor_t=bot.t if not bot.stale_sensor else bot.last_sensor_t
        target_v,target_omega,_=bot.command(desired_v,desired_omega,noisy_proximity,mission)
        bot.step(target_v,target_omega)
        if actual_proximity < c.contact_distance_m:
            bot.contact_events += 1
            if len(contact_details)<3: contact_details.append([round(bot.t,2),round(bot.x,2),round(bot.v,2),round(pedestrian_y,2),round(actual_proximity,2),round(noisy_proximity,2)])
            reported_failure_reason="CONTACT_WITH_OBSTACLE"
            mission.transition("FAILED",bot.t)
        localization_errors_sq.append((bot.x-bot.estimated_x)**2+(bot.y-bot.estimated_y)**2)
        if i%20 == 0:
            sample.append({"t_s":round(bot.t,2),"x_true_m":round(bot.x,4),
                 "x_odom_m":round(bot.estimated_x,4),"v_mps":round(bot.v,4),
                 "obstacle_range_m":round(noisy_proximity,3),
                 "soc":round(bot.battery_soc,7)})
        if reported_failure_reason == "CONTACT_WITH_OBSTACLE":
            break
        if bot.battery_soc <= 0.2:
            reported_failure_reason="LOW_BATTERY"
            mission.transition("FAILED",bot.t)
            break
        if inject_sensor_fault and bot.stale_sensor and bot.v < 0.001:
            reported_failure_reason="SENSOR_STALE_SAFE_STOP"
            break
        if remaining <= c.goal_tolerance_m and abs(bot.v) < 0.06:
            mission.transition("ARRIVED", bot.t)
            mission.handover(bot.t, authorized=True)
            break
    else:
        reported_failure_reason="SIMULATION_TIMEOUT"
        mission.transition("FAILED",bot.t)
    from math import sqrt
    return {"seed":seed,"status":mission.state,"failure_reason":reported_failure_reason,
            "duration_sim_s":round(bot.t,3),"path_m":round(bot.distance_m,4),
            "final_true_x_m":round(bot.x,4),"position_rmse_m":round(sqrt(sum(localization_errors_sq)/len(localization_errors_sq)),5),
            "energy_estimated_wh":round(bot.energy_wh,5),"final_soc_estimated":round(bot.battery_soc,7),
            "maximum_speed_mps":round(bot.max_speed_observed_mps,5),
            "maximum_wheel_torque_estimated_nm":round(bot.max_motor_torque_nm,5),
            "collision_samples":bot.contact_events,"contact_details":contact_details,"safety_stop_events":bot.safe_stop_events,
            "max_lidar_proximity_noise_m":round(max_lidar_error,5),
            "mission_events":mission.events,"trace_1hz":sample,"model":"planar-non-ros-surrogate-v0.1"}
