#!/usr/bin/env python3
"""Bounded ROS 2 simulation velocity stimulus through the project's watchdog.

Never publishes directly to Gazebo's DiffDrive command topic.
Physical robot deployment and safety certification are out of scope.
"""
import argparse
import time


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--drive-seconds',type=float,default=3.0)
    parser.add_argument('--speed-mps',type=float,default=0.2)
    parser.add_argument('--zero-seconds',type=float,default=4.0)
    args=parser.parse_args()
    if not 1<=args.drive_seconds<=8 or not 0<args.speed_mps<=.3 or args.zero_seconds<3:
        raise SystemExit('Unsafe test limits: 1-8 s drive, 0-.3 m/s, >=3 s stop')
    import rclpy
    from geometry_msgs.msg import Twist
    from rclpy.node import Node
    rclpy.init()
    node=Node('garden_recorded_drive_stimulus')
    pub=node.create_publisher(Twist,'/robot1/cmd_vel_requested',10)
    try:
        deadline=time.monotonic()+12
        while pub.get_subscription_count()<1 and time.monotonic()<deadline:
            rclpy.spin_once(node,timeout_sec=.1)
        if pub.get_subscription_count()<1:
            raise RuntimeError('ROS watchdog did not subscribe to requested velocity')
        def send(value,duration):
            end=time.monotonic()+duration
            msg=Twist()
            msg.linear.x=value
            while time.monotonic()<end:
                pub.publish(msg)
                rclpy.spin_once(node,timeout_sec=.05)
        send(args.speed_mps,args.drive_seconds)
        send(0.0,args.zero_seconds)
        print('ROS2 watchdog drive stimulus completed; zero held',args.zero_seconds,'s')
    finally:
        # Stop command is sent redundantly, even on exceptions.
        msg=Twist()
        for _ in range(10):
            pub.publish(msg)
            rclpy.spin_once(node,timeout_sec=.03)
        node.destroy_node()
        rclpy.shutdown()


if __name__=='__main__':
    main()
