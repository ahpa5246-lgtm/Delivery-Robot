"""Sensitivity sweep for the Python surrogate; not real hardware or Gazebo."""
import csv
from pathlib import Path
from cdr_sim import Config, run_mission

def main():
    out=Path('experiments/parameter_sweep_270.csv')
    out.parent.mkdir(parents=True,exist_ok=True)
    rows=[]
    for grade in [0,3,5]:
        for payload in [0,2.5,5]:
            for friction in [0.3,0.6,0.9]:
                for seed in range(10):
                    r=run_mission(seed,cfg=Config(grade_deg=grade,payload_kg=payload,friction=friction))
                    rows.append([grade,payload,friction,seed,r['status'],r['collision_samples'],
                                 r['duration_sim_s'],r['energy_estimated_wh'],r['maximum_wheel_torque_estimated_nm']])
    with out.open('w',newline='') as f:
        w=csv.writer(f);w.writerow(['grade_deg','payload_kg','friction','seed','status','contacts','time_sim_s','energy_est_wh','max_torque_est_nm']);w.writerows(rows)
    print(f"runs={len(rows)} completed={sum(x[4]=='COMPLETED' for x in rows)} contacts={sum(x[5] for x in rows)}")
    print(f"est_energy_range_Wh={min(x[7] for x in rows):.5f}..{max(x[7] for x in rows):.5f}")
    print(f"max_est_wheel_torque_Nm={max(x[8] for x in rows):.5f}")
if __name__=='__main__': main()
