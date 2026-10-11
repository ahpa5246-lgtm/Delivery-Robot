#!/usr/bin/env python3
"""End-to-end test of ROS2 watchdog relay while Gazebo + ros_gz_bridge are running.

Test emits finite motion commands for 2s, stops upstream commands, and verifies
ROS relay publishes zero velocity by 3.2s. It samples real Gazebo odometry to
check no sustained drive after staleness. Not a hardware safety certification.
"""
import json
import time
from pathlib import Path

import rclpy
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from rclpy.node import Node


def main():
    rclpy.init()
    node=Node('watchdog_acceptance_probe')
    publisher=node.create_publisher(Twist,'/robot1/cmd_vel_requested',10)
    record=[]
    poses=[]

    start=time.monotonic()

    def on_command(msg):
        record.append((time.monotonic()-start,msg.linear.x))

    def on_odom(msg):
        poses.append((time.monotonic()-start,msg.pose.pose.position.x))

    sub=node.create_subscription(Twist,'/robot1/cmd_vel',on_command,10)
    odom_sub=node.create_subscription(Odometry,'/robot1/odom',on_odom,10)
    last_send=0
    while time.monotonic()-start < 6:
        elapsed=time.monotonic()-start
        if elapsed < 2.0 and elapsed-last_send>=0.1:
            command=Twist();command.linear.x=0.25
            publisher.publish(command)
            last_send=elapsed
        rclpy.spin_once(node,timeout_sec=0.025)

    moving=[v for t,v in record if 0.6<=t<2]
    stale=[v for t,v in record if 3.2<=t<=5.8]
    # Compare Gazebo odometry after a settling period to avoid transient braking.
    settled=[x for t,x in poses if 4.0<=t<=5.8]
    result={'accepted_moving_commands':len(moving),
            'forwarded_moving_commands':sum(v>0.2 for v in moving),
            'post_timeout_samples':len(stale),
            'nonzero_post_timeout_samples':sum(abs(v)>1e-6 for v in stale),
            'settled_odom_samples':len(settled),
            'settled_odom_drift_m':abs(settled[-1]-settled[0]) if len(settled)>=2 else None,
            'type':'ACTUAL ROS2 + GAZEBO SIMULATION (NOT PHYSICAL HARDWARE)'}
    print(json.dumps(result,indent=2),flush=True)
    node.destroy_node()
    rclpy.shutdown()
    if not moving or not any(v>0.2 for v in moving):
        raise RuntimeError('Watchdog never forwarded active driving')
    if len(stale)<4 or any(abs(v)>1e-6 for v in stale):
        raise RuntimeError('Watchdog failed to output zero after command stale')
    if len(settled)<2:
        raise RuntimeError('Not enough Gazebo odometry to establish stationary post-timeout state')
    if result['settled_odom_drift_m']>0.05:
        raise RuntimeError('Gazebo continued to travel after watchdog timeout')


if __name__=='__main__':
    main()
