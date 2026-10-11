"""Execute simulator-derived data baseline (not ROS/Gazebo/hardware measurements)."""
import argparse, csv, json, math, os, statistics, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cdr_sim import Config,run_mission

def evaluate(count,output,with_obstacle=True):
    output=Path(output); output.mkdir(parents=True,exist_ok=True)
    records=[run_mission(seed,obstacle=with_obstacle) for seed in range(count)]
    cols=['seed','status','failure_reason','duration_sim_s','path_m','final_true_x_m','position_rmse_m','energy_estimated_wh','final_soc_estimated','maximum_speed_mps','maximum_wheel_torque_estimated_nm','collision_samples','safety_stop_events','max_lidar_proximity_noise_m','model']
    with (output/'results.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=cols);w.writeheader();w.writerows({k:r[k] for k in cols} for r in records)
    completed=[r for r in records if r['status']=='COMPLETED']
    failures=[r for r in records if r['status']!='COMPLETED']
    # Wilson score interval for a binomial proportion.
    k=len(completed);n=len(records);z=1.959963984540054
    p=k/n if n else 0
    den=1+z*z/n if n else 1
    center=(p+z*z/(2*n))/den if n else 0
    half=z*math.sqrt((p*(1-p)+z*z/(4*n))/n)/den if n else 0
    summary={'status':'MEASURED FROM EXECUTED PYTHON SIMULATOR',
             'model':'planar-non-ros-surrogate-v0.1','not_gazebo':True,'not_hardware':True,
             'seeds':list(range(count)),'scenario':'single-straight-campus-lane-moving-crossing-pedestrian',
             'count':n,'completed':k,'success_fraction':p,
             'success_95pct_wilson_interval':[round(max(0,center-half),5),round(min(1,center+half),5)],
             'collision_samples_total':sum(r['collision_samples'] for r in records),
             'duration_sim_s_mean_completed':round(statistics.mean(r['duration_sim_s'] for r in completed),4) if completed else None,
             'duration_sim_s_p95_completed':round(sorted(r['duration_sim_s'] for r in completed)[math.ceil(.95*len(completed))-1],4) if completed else None,
             'rmse_m_mean_all':round(statistics.mean(r['position_rmse_m'] for r in records),5),
             'energy_estimated_wh_mean_all':round(statistics.mean(r['energy_estimated_wh'] for r in records),5),
             'max_speed_mps_all':max(r['maximum_speed_mps'] for r in records),
             'max_wheel_torque_estimated_nm_all':max(r['maximum_wheel_torque_estimated_nm'] for r in records),
             'failure_reasons':{s:sum(r['failure_reason']==s for r in failures) for s in sorted(set(r['failure_reason'] for r in failures))},
             'config':vars(Config())}
    (output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    (output/'trace_seed_0.json').write_text(json.dumps(records[0],indent=2)+'\n')
    return summary
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--count',type=int,default=100);p.add_argument('--output',default='experiments/planar_baseline');args=p.parse_args()
    print(json.dumps(evaluate(args.count,args.output),indent=2))
