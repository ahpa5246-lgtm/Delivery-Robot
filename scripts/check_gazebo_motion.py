"""Validate Gazebo DiffDrive motion from raw gz.msgs.Odometry topic text.

This is independent of the Python planar surrogate, and only reports that the
Gazebo 3-D model actually moved under a velocity command (NOT a calibrated test).
"""
import json
import re
import sys
from pathlib import Path


def inspect(raw: str):
    xs=[]
    stamps=[]
    for record in re.split(r'(?=^header \{)', raw, flags=re.MULTILINE):
        pos=re.search(r'\bpose\s*\{\s*position\s*\{([^}]*)\}',record,re.DOTALL)
        if not pos:continue
        value=re.search(r'\bx:\s*([-+0-9.eE]+)',pos.group(1))
        xs.append(float(value.group(1)) if value else 0.0)
        stamp=re.search(r'\bsec:\s*(\d+)',record)
        stamps.append(int(stamp.group(1)) if stamp else None)
    return {'samples':len(xs),'initial_x_m':xs[0] if xs else None,
            'final_x_m':xs[-1] if xs else None,
            'maximum_x_m':max(xs) if xs else None,
            'displacement_observed_m':max(xs)-min(xs) if xs else None,
            'first_gazebo_sim_s':stamps[0] if stamps else None,
            'last_gazebo_sim_s':stamps[-1] if stamps else None}


if __name__=='__main__':
    p=Path(sys.argv[1])
    result=inspect(p.read_text(errors='replace'))
    print(json.dumps(result,indent=2))
    Path(sys.argv[2]).write_text(json.dumps(result,indent=2)+'\n')
    if result['samples']<2 or result['displacement_observed_m'] is None or result['displacement_observed_m']<0.1:
        sys.exit('ERROR: insufficient observed Gazebo motion (minimum 0.1m)')
