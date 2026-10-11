"""Produce a preliminary Gazebo Harmonic SDF model and paved-campus test lane.

XML structure is locally tested; actual Gazebo dynamics must be validated by a
Gazebo runtime/CI. Wheel velocity plugin is NOT an electrical/motor-torque model.
"""
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, indent, ElementTree
import math

OUT = Path(__file__).resolve().parents[1] / 'simulation' / 'campus_v0.sdf'


def child(parent, tag, value=None, **attrs):
    node = SubElement(parent, tag, attrs)
    if value is not None:
        node.text = str(value)
    return node


def box_link(model, name, pose, size, mass):
    link=child(model,'link',name=name)
    child(link,'pose',pose)
    inertial=child(link,'inertial');child(inertial,'mass',mass)
    xx,yy,zz=size
    inertia=child(inertial,'inertia')
    for axis,val in [('ixx',mass*(yy**2+zz**2)/12),('iyy',mass*(xx**2+zz**2)/12),('izz',mass*(xx**2+yy**2)/12),('ixy',0),('ixz',0),('iyz',0)]:
        child(inertia,axis,round(val,7))
    for part in ('collision','visual'):
        geom=child(child(link,part,name=name+'_'+part),'geometry')
        child(child(geom,'box'),'size',' '.join(str(x) for x in size))
    return link


def wheel_link(model,name,pose,radius,width,mass,caster=False):
    link=child(model,'link',name=name)
    child(link,'pose',pose)
    inertial=child(link,'inertial');child(inertial,'mass',mass)
    tensor=child(inertial,'inertia')
    if caster:
        i=2*mass*radius**2/5
        vals={'ixx':i,'iyy':i,'izz':i}
    else:
        # Cylinder Z axis is rotated 90deg around X to point along chassis Y.
        vals={'ixx':mass*(3*radius**2+width**2)/12,
              'iyy':mass*radius**2/2,
              'izz':mass*(3*radius**2+width**2)/12}
    for axis in ('ixx','iyy','izz','ixy','ixz','iyz'):
        child(tensor,axis,round(vals.get(axis,0),8))
    for part in ('collision','visual'):
        geom=child(child(link,part,name=name+'_'+part),'geometry')
        if caster:child(child(geom,'sphere'),'radius',radius)
        else:
            cyl=child(geom,'cylinder');child(cyl,'radius',radius);child(cyl,'length',width)
    return link


def joint(model,name,parent,link,kind='revolute',axis='0 1 0'):
    j=child(model,'joint',name=name,type=kind)
    child(j,'parent',parent);child(j,'child',link)
    if kind=='revolute':
        ax=child(j,'axis');child(ax,'xyz',axis,expressed_in='__model__')
        limit=child(ax,'limit');child(limit,'lower',-1e16);child(limit,'upper',1e16)
    return j


def generate():
    sdf=Element('sdf',version='1.9')
    world=child(sdf,'world',name='campus_test')
    physics=child(world,'physics',name='physics_step',type='ignored')
    child(physics,'max_step_size',0.005)
    child(physics,'real_time_factor',1.0)
    child(world,'gravity','0 0 -9.81')
    for filename,pname in [('gz-sim-physics-system','Physics'),('gz-sim-user-commands-system','UserCommands'),('gz-sim-scene-broadcaster-system','SceneBroadcaster'),('gz-sim-imu-system','Imu')]:
        child(world,'plugin',filename=filename,name='gz::sim::systems::'+pname)
    ground=child(world,'model',name='pavement')
    child(ground,'static','true')
    g=child(ground,'link',name='ground')
    for p in ('collision','visual'):
        geom=child(child(g,p,name='pavement_'+p),'geometry')
        child(child(geom,'box'),'size','100 12 0.2')
    child(g,'pose','0 0 -0.1 0 0 0')
    for i,(x,y) in enumerate([(8,2.5),(14,-2.4),(20,2.5)]):
        obj=child(world,'model',name=f'campus_bollard_{i}')
        child(obj,'static','true')
        link=child(obj,'link',name='body')
        child(link,'pose',f'{x} {y} 0.45 0 0 0')
        for p in ('collision','visual'):
            cyl=child(child(child(link,p,name='bollard_'+p),'geometry'),'cylinder')
            child(cyl,'radius','0.18');child(cyl,'length','0.9')
    robot=child(world,'model',name='cdr01')
    child(robot,'pose','0 0 0 0 0 0')
    chassis=box_link(robot,'chassis','0 0 0.27 0 0 0',(0.55,0.35,0.24),15.4)
    # Payload is rigid for the first Gazebo prototype; hatch and scale still pending.
    box_link(robot,'cargo','0 0 0.45 0 0 0',(0.3,0.25,0.12),5.0)
    joint(robot,'cargo_fixed','chassis','cargo','fixed')
    for side,y in [('left',0.19),('right',-0.19)]:
        wheel_link(robot,side+'_wheel',f'0 {y} 0.12 1.57079632679 0 0',0.12,0.06,2)
        joint(robot,side+'_wheel_joint','chassis',side+'_wheel')
    for location,x in [('front',0.24),('rear',-0.24)]:
        wheel_link(robot,location+'_caster',f'{x} 0 0.075 0 0 0',0.075,0.0,0.3,caster=True)
        joint(robot,location+'_caster_joint','chassis',location+'_caster',kind='ball')
    imu=child(chassis,'sensor',name='imu',type='imu');child(imu,'always_on','true');child(imu,'update_rate',100)
    child(imu,'topic','/model/cdr01/imu')
    drive=child(robot,'plugin',filename='gz-sim-diff-drive-system',name='gz::sim::systems::DiffDrive')
    for tag,value in [('left_joint','left_wheel_joint'),('right_joint','right_wheel_joint'),
         ('wheel_separation',0.38),('wheel_radius',0.12),('topic','/model/cdr01/cmd_vel'),
         ('odom_topic','/model/cdr01/odometry'),('max_linear_velocity',0.8),
         ('min_linear_velocity',-0.8),('max_linear_acceleration',0.3),('min_linear_acceleration',-0.3),
         ('max_angular_velocity',0.8),('min_angular_velocity',-0.8),('max_angular_acceleration',1.0),
         ('min_angular_acceleration',-1.0),('odom_publish_frequency',20)]:
        child(drive,tag,value)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    indent(sdf,space='  ')
    ElementTree(sdf).write(OUT,encoding='utf-8',xml_declaration=True)
    print(f'Wrote {OUT} ({OUT.stat().st_size} bytes). This is an unvalidated Gazebo candidate.')
    return OUT

if __name__=='__main__':generate()
