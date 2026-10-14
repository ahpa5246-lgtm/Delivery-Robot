"""Five-agent offline dispatch demonstration with geometric sensing and reservations.

NOT ROS Nav2 or Gazebo physics. All agent movements and 16-beam 2D range scans
are computed from the same static obstacle world as the existing A* planner.
A reciprocal swept-disc separation check prohibits two modeled robots crossing
during the same one-second simulation tick. Waiting is a legitimate outcome.
"""
from __future__ import annotations

from math import atan2, cos, hypot, isfinite, pi, sin
from bisect import bisect_right
from dataclasses import dataclass
from cdr_sim.campus import Campus, ReplayOptions, astar, replay, NoRoute


FLEET_IDS = ("R-01", "R-02", "R-03", "R-04", "R-05")
DESTINATIONS = ("library", "engineering", "student_center", "library", "engineering")
STEP_S = 1.0
MAX_HORIZON_S = 420
BEAMS = 16
RANGE_MAX_M = 8.0


def _pose(frames: list[dict], elapsed: float) -> dict:
    if elapsed <= frames[0]["time_s"]:
        return frames[0]
    if elapsed >= frames[-1]["time_s"]:
        return frames[-1]
    index = bisect_right([v["time_s"] for v in frames], elapsed)
    a, b = frames[index - 1], frames[index]
    alpha = (elapsed-a["time_s"]) / max(.000001,b["time_s"]-a["time_s"])
    return {key: a[key] + (b[key]-a[key])*alpha
            for key in ("x_m","y_m","speed_mps","soc","distance_m","energy_estimated_wh")} | {
            "phase": a["phase"]}


def _segment_separation(a: tuple, b: tuple, c: tuple, d: tuple) -> float:
    """Minimum relative distance for two linearly moving discs over [0, 1]."""
    px, py = a[0]-c[0], a[1]-c[1]
    vx, vy = (b[0]-a[0])-(d[0]-c[0]), (b[1]-a[1])-(d[1]-c[1])
    denom = vx*vx+vy*vy
    t = min(1.0,max(0.0,-(px*vx+py*vy)/denom)) if denom>1e-12 else 0
    return hypot(px+vx*t,py+vy*t)


def _ray_range(x: float, y: float, dx: float, dy: float,
               rects: tuple, world: Campus) -> float:
    """Nearest box or world-boundary hit, in metres (2D ideal geometrical model)."""
    result = RANGE_MAX_M
    for rect in rects + ((0.,-1.,0.,world.height),
                         (world.width,-1.,world.width,world.height),
                         (-1.,0.,world.width,0.),
                         (-1.,world.height,world.width,world.height)):
        lo,hi=0.,result
        for origin,d,lower,upper in (
            (x,dx,rect[0],rect[2]),(y,dy,rect[1],rect[3])
        ):
            if abs(d)<1e-12:
                if origin<lower or origin>upper:
                    lo=result+1
                    break
            else:
                t0,t1=(lower-origin)/d,(upper-origin)/d
                if t0>t1:t0,t1=t1,t0
                lo=max(lo,t0)
                hi=min(hi,t1)
                if lo>hi:break
        if lo<=hi and lo>=0:result=min(result,lo)
    return result


def _scan(x: float, y: float, heading: float, world: Campus) -> list[float]:
    return [round(_ray_range(x,y,cos(heading+2*pi*i/BEAMS),
                             sin(heading+2*pi*i/BEAMS),world.obstacles,world),2)
            for i in range(BEAMS)]


def _staging(world: Campus, destinations: tuple[str, ...]) -> list[tuple]:
    """Pick five obstacle-free, separated, reachable pads without guessing coordinates."""
    candidates=[]
    for i in range(3,world.shape[0]-3,3):
        for j in range(3,world.shape[1]-3,3):
            point=world.center((i,j))
            if world.clearance(point)<world.safety_margin+.12:continue
            if not world.free((i,j)):continue
            score=hypot(point[0]-world.stops["depot"][0],
                        point[1]-world.stops["depot"][1])
            candidates.append((score,point))
    candidates.sort(key=lambda it:it[0])
    pads=[]
    for _ in destinations:
        goal=world.stops[_]
        viable=None
        for _,point in candidates:
            if any(hypot(point[0]-p[0],point[1]-p[1])<2.35 for p in pads):
                continue
            try:astar(world,point,goal)
            except NoRoute:continue
            viable=point
            break
        if viable is None:raise ValueError("could not allocate five collision-free fleet pads")
        pads.append(viable)
        candidates=[p for p in candidates if p[1]!=viable]
    return pads


def fleet_replay(world: Campus | None=None, seed: int=7) -> dict:
    if not isinstance(seed,int) or not 0<=seed<=1_000_000:
        raise ValueError("invalid seed")
    world=world or Campus()
    pads=_staging(world,DESTINATIONS)
    agents=[]
    for i,(name,goal,pad) in enumerate(zip(FLEET_IDS,DESTINATIONS,pads)):
        mission=replay(ReplayOptions(seed=seed+i*101,destination=goal,
                       scenario="clear",initial_soc=.72+.055*i,
                       start_override=pad),campus=world)
        agents.append({"id":name,"destination":goal,"pad":[round(p,2) for p in pad],
                       "mission":mission,"elapsed":0.0,"wait_s":0.0,
                       "pose":pad,"heading":0.0,"frames":[]})
    min_sep=2*world.robot_radius+.12
    for t in range(0,MAX_HORIZON_S+1):
        initial=[a["pose"] for a in agents]
        planned=[v["pose"] for v in agents]
        modes=["STANDBY" for _ in agents]
        if t:
            # Older stalled jobs gain scheduling priority; do not reserve more
            # than one tick at a time or silently teleport through a collision.
            order=sorted(range(5),key=lambda k:(-agents[k]["wait_s"],k))
            accepted=[]
            for k in order:
                a=agents[k];mission=a["mission"]
                if a["elapsed"]>=mission["duration_sim_s"]-.001:
                    modes[k]="DOCKED" if mission["status"]=="COMPLETED" else "SAFE_STOP"
                    accepted.append(k);continue
                nxt=_pose(mission["frames"],min(mission["duration_sim_s"],a["elapsed"]+STEP_S))
                dest=(nxt["x_m"],nxt["y_m"])
                # Compared to already-accepted moving and all as-yet stationary
                # agents. Swept relative segment check also detects head-on swaps.
                risk=any(_segment_separation(initial[k],dest,initial[h],planned[h])
                         <min_sep-1e-8 for h in range(5) if h!=k)
                if risk:
                    modes[k]="YIELDING";a["wait_s"]+=STEP_S
                else:
                    planned[k]=dest;a["elapsed"]+=STEP_S
                    a["wait_s"]=max(0.,a["wait_s"]-1)
                    modes[k]="MOVING"
                accepted.append(k)
            # This conservative assignment never advances either vehicle
            # if the scheduled relative trajectory is unresolved.
        for k,a in enumerate(agents):
            old=a["pose"];new=planned[k]
            delta=hypot(new[0]-old[0],new[1]-old[1])
            if delta>.001:a["heading"]=atan2(new[1]-old[1],new[0]-old[0])
            a["pose"]=new
            source=_pose(a["mission"]["frames"],a["elapsed"])
            ranges=_scan(new[0],new[1],a["heading"],world) if t%2==0 else []
            record={
                "time_s":t,"x_m":round(new[0],3),"y_m":round(new[1],3),
                "heading_rad":round(a["heading"],4),"speed_mps":round(delta/STEP_S,3),
                "battery_soc_estimated":round(source["soc"],5),
                "distance_m_estimated":round(source["distance_m"],3),
                "status":modes[k] if t else "STANDBY",
                "range_scan_m":ranges,
                "nearest_static_clearance_m":round(world.clearance(new),3)
            }
            a["frames"].append(record)
        if t>20 and all(a["elapsed"]>=a["mission"]["duration_sim_s"]-.001
                        or a["mission"]["status"]!="COMPLETED" for a in agents):
            break
    frames_len=len(agents[0]["frames"])
    no_conflicts=all(
        _segment_separation((a["frames"][i-1]["x_m"],a["frames"][i-1]["y_m"]),
                            (a["frames"][i]["x_m"],a["frames"][i]["y_m"]),
                            (b["frames"][i-1]["x_m"],b["frames"][i-1]["y_m"]),
                            (b["frames"][i]["x_m"],b["frames"][i]["y_m"]))>=min_sep-.005
        for i in range(1,frames_len) for ki,a in enumerate(agents) for b in agents[ki+1:])
    if not no_conflicts:raise RuntimeError("fleet relative trajectory separation validation failed")
    return {
        "model":"five-agent-geometric-dispatch-v1",
        "provenance":"OFFLINE KINEMATIC MODEL, NOT LIVE SENSORS OR GAZEBO CONTACT PHYSICS",
        "world":world.theme,"seed":seed,"robot_count":len(agents),
        "duration_sim_s":frames_len-1,"sample_interval_s":STEP_S,
        "collision_separation_m":min_sep,"separation_checked":True,
        "sensor_model":{"lidar":"16 ideal 2D geometric rays against static footprints",
                        "proximity":"nearest static footprint, modeled",
                        "wheel_odometry":"derived from replay displacement",
                        "imu":"heading derived from XY displacement",
                        "rgbd":"NOT CONNECTED","gps":"NOT CONNECTED"},
        "robots":[{"id":a["id"],"destination":a["destination"],"pad":a["pad"],
                   "mission_status":a["mission"]["status"],
                   "arrived":a["elapsed"]>=a["mission"]["duration_sim_s"]-.001,
                   "yielding_seconds":round(a["wait_s"],1),
                   "frames":a["frames"]} for a in agents]
    }
