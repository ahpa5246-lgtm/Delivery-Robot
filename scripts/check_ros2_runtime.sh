#!/usr/bin/env bash
# An actual DDS transport check using diagnostic text, not invented robot telemetry.
set -euo pipefail
image_ref='ros:jazzy-ros-base@sha256:103b6c417973394659af6804d4917cd489b91e5ed22eb7bef263025a3bed2410'
docker run --rm -i --memory=2g --cpus=2 "$image_ref" python3 - <<'PY'
import time
import rclpy
from std_msgs.msg import String
rclpy.init()
source = rclpy.create_node('delivery_setup_source')
sink = rclpy.create_node('delivery_setup_sink')
received = []
subscription = sink.create_subscription(String, '/delivery_setup_check', lambda m: received.append(m.data), 10)
publisher = source.create_publisher(String, '/delivery_setup_check', 10)
message = String()
message.data = 'setup diagnostic fixture: not robot telemetry'
deadline = time.monotonic() + 10
try:
    while not received and time.monotonic() < deadline:
        publisher.publish(message)
        rclpy.spin_once(sink, timeout_sec=0.2)
    assert received and received[0] == message.data, received
    print('PASS ROS 2 Jazzy: actual DDS publish/subscribe; bridge and hardware not validated')
finally:
    source.destroy_node()
    sink.destroy_node()
    rclpy.shutdown()
PY
