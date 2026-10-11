#!/usr/bin/env python3
"""ROS 2 Jazzy software velocity command watchdog for *simulation only*.

Subscribes to /robot1/cmd_vel_requested, clamps request to configured limits,
publishes to /robot1/cmd_vel at 20 Hz. Always emits zero if the source stops
publishing for 0.5s, including after launch and after safety inhibit.

This ROS 2 node is NOT a safety-certified emergency-stop mechanism. Gazebo's
DiffDrive plugin can hold an old nonzero velocity; do not send directly to its
command topic outside controlled test procedures.
"""
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cdr_sim.watchdog import CommandWatchdog


def main():
    import rclpy
    from geometry_msgs.msg import Twist
    from std_srvs.srv import SetBool
    from rclpy.node import Node

    class VelocityWatchdog(Node):
        def __init__(self):
            super().__init__('velocity_watchdog')
            self.declare_parameter('command_timeout_s', 0.5)
            self.logic = CommandWatchdog(timeout_s=self.get_parameter('command_timeout_s').value)
            self.publisher = self.create_publisher(Twist, '/robot1/cmd_vel', 10)
            self.sub = self.create_subscription(Twist, '/robot1/cmd_vel_requested', self.on_command, 10)
            self.inhibit_srv = self.create_service(SetBool, '/robot1/safety/inhibit', self.set_inhibit)
            self.timer = self.create_timer(0.05, self.tick)
            self.get_logger().info('Command watchdog active. Only /robot1/cmd_vel_requested is authorized.')

        def on_command(self, msg):
            try:
                self.logic.receive(msg.linear.x, msg.angular.z, time.monotonic())
            except ValueError:
                self.get_logger().error('Non-finite motion command rejected; motion inhibited')

        def set_inhibit(self, request, response):
            if request.data:
                self.logic.inhibit()
                response.message = 'Motion inhibited'
            else:
                self.logic.release()
                response.message = 'Motion allowed, fresh command required'
            response.success = True
            return response

        def tick(self):
            v, w = self.logic.output(time.monotonic())
            safe = Twist()
            safe.linear.x = v
            safe.angular.z = w
            self.publisher.publish(safe)

        def destroy_node(self):
            # Best effort, publish zeros before node shutdown.
            safe = Twist()
            for _ in range(5):
                self.publisher.publish(safe)
            super().destroy_node()

    rclpy.init()
    node = VelocityWatchdog()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
