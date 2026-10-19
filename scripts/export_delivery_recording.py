"""Export deterministic campus kinematics to ROS1-wire MCAP for Lichtblick.

This is offline modeled telemetry, not live ROS, Gazebo, physical sensors or a
ROS2 CDR recording. ROS message definitions below follow the standard ROS1
common_msgs/geometry_msgs and geometry2/tf2_msgs interfaces (BSD licensed).
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import struct
import sys

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cdr_sim.campus import ReplayOptions, replay

SOURCE = 'campus_kinematic_replay'
ROOT = Path(__file__).resolve().parents[1]
DEFINITIONS = {
    'std_msgs/Header': 'uint32 seq\ntime stamp\nstring frame_id\n',
    'geometry_msgs/Point': 'float64 x\nfloat64 y\nfloat64 z\n',
    'geometry_msgs/Vector3': 'float64 x\nfloat64 y\nfloat64 z\n',
    'geometry_msgs/Quaternion': 'float64 x\nfloat64 y\nfloat64 z\nfloat64 w\n',
    'geometry_msgs/Pose': 'geometry_msgs/Point position\ngeometry_msgs/Quaternion orientation\n',
    'geometry_msgs/PoseWithCovariance': 'geometry_msgs/Pose pose\nfloat64[36] covariance\n',
    'geometry_msgs/Twist': 'geometry_msgs/Vector3 linear\ngeometry_msgs/Vector3 angular\n',
    'geometry_msgs/TwistWithCovariance': 'geometry_msgs/Twist twist\nfloat64[36] covariance\n',
    'geometry_msgs/Transform': 'geometry_msgs/Vector3 translation\ngeometry_msgs/Quaternion rotation\n',
    'geometry_msgs/TransformStamped': 'std_msgs/Header header\nstring child_frame_id\ngeometry_msgs/Transform transform\n',
    'geometry_msgs/PoseStamped': 'std_msgs/Header header\ngeometry_msgs/Pose pose\n',
}
SCHEMAS = {
    '/tf': ('tf2_msgs/TFMessage', 'geometry_msgs/TransformStamped[] transforms\n'),
    '/odom': ('nav_msgs/Odometry', 'std_msgs/Header header\nstring child_frame_id\ngeometry_msgs/PoseWithCovariance pose\ngeometry_msgs/TwistWithCovariance twist\n'),
    '/cdr01/path': ('nav_msgs/Path', 'std_msgs/Header header\ngeometry_msgs/PoseStamped[] poses\n'),
    '/robot_description': ('std_msgs/String', 'string data\n'),
}


def ros_schema(body: str) -> bytes:
    """Embed only referenced definitions, recursively, as ROS bag schemas do."""
    seen = set()
    parts = [body]
    def dependencies(definition):
        for line in definition.splitlines():
            name = line.split()[0].split('[')[0]
            if name in DEFINITIONS and name not in seen:
                seen.add(name)
                parts.append('\n' + '=' * 80 + '\nMSG: ' + name + '\n' + DEFINITIONS[name])
                dependencies(DEFINITIONS[name])
    dependencies(body)
    return ''.join(parts).encode()


def string(value: str) -> bytes:
    data = value.encode('utf-8')
    return struct.pack('<I', len(data)) + data


def header(index: int, time_ns: int) -> bytes:
    seconds, nanos = divmod(time_ns, 1_000_000_000)
    return struct.pack('<III', index, seconds, nanos) + string('odom')


def pose(frame: dict, yaw: float) -> bytes:
    return struct.pack('<7d', frame['x_m'], frame['y_m'], 0.0,
                       0.0, 0.0, math.sin(yaw / 2), math.cos(yaw / 2))


def export_recording(output: Path, *, seed: int = 0, scenario: str = 'clear') -> int:
    """Write indexed MCAP and return sample count. Deterministic replay timestamps start at 0."""
    from mcap.writer import Writer
    if type(seed) is not int or seed < 0:
        raise ValueError('seed must be a nonnegative integer')
    result = replay(ReplayOptions(seed=seed, scenario=scenario))
    # The simulator can force its final frame at the same time as a sampled one.
    # Keep the final state for that timestamp, preserving strict per-topic order.
    frames = list({round(f['time_s'] * 1e9): f for f in result['frames']}.values())
    urdf = (ROOT / 'assets/robot/cdr01-visual-proxy.urdf').read_text()
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('wb') as stream:
        writer = Writer(stream)
        writer.start(profile='ros1', library='delivery-robot-campus-exporter')
        channels = {}
        for topic, (name, body) in SCHEMAS.items():
            schema_id = writer.register_schema(name=name, encoding='ros1msg', data=ros_schema(body))
            channels[topic] = writer.register_channel(topic=topic, message_encoding='ros1', schema_id=schema_id,
                metadata={'source': SOURCE, 'latching': '1' if topic == '/robot_description' else '0'})
        fields = {'timestamp_s': 'number', 'source': 'string', 'live': 'boolean', 'phase': 'string',
                  'status': 'string', 'reason': 'string', 'scenario': 'string', 'seed': 'integer',
                  'speed_mps': 'number', 'distance_m': 'number', 'energy_estimated_wh': 'number',
                  'soc_estimated': 'number', 'energy_model': 'string'}
        schema_id = writer.register_schema(name='cdr.DeliveryMission', encoding='jsonschema', data=json.dumps({
            'type': 'object', 'properties': {k: {'type': v} for k, v in fields.items()},
            'required': list(fields), 'additionalProperties': False}).encode())
        channels['/cdr01/mission'] = writer.register_channel(topic='/cdr01/mission', message_encoding='json', schema_id=schema_id,
            metadata={'source': SOURCE, 'live': 'false', 'energy': 'modeled_not_measured'})
        writer.add_metadata('delivery.provenance', {'source': SOURCE, 'live': 'false', 'ros2_native': 'false',
            'hardware_verified': 'false', 'gazebo_verified': 'false', 'robot_model': 'schematic_visual_proxy_not_validated_CAD'})
        def emit(topic, ns, data, seq=0):
            writer.add_message(channel_id=channels[topic], log_time=ns, publish_time=ns, sequence=seq, data=data)
        poses = []
        yaw = 0.0
        for index, frame in enumerate(frames):
            ns = round(frame['time_s'] * 1e9)
            if index + 1 < len(frames):
                next_frame = frames[index + 1]
                dx, dy = next_frame['x_m']-frame['x_m'], next_frame['y_m']-frame['y_m']
                if math.hypot(dx, dy) > 1e-9:
                    yaw = math.atan2(dy, dx)
            # Repeat immutable model context so newly opened panels receive it during replay.
            emit('/robot_description', ns, string(urdf), index)
            h = header(index, ns)
            p = pose(frame, yaw)
            emit('/tf', ns, struct.pack('<I', 1) + h + string('base_link') + p, index)
            # Covariances are unknown, represented by zero per ROS conventions;
            # no calibrated uncertainty or physical sensor accuracy is claimed.
            odom = h + string('base_link') + p + struct.pack('<36d', *([0.0]*36))
            odom += struct.pack('<6d', frame['speed_mps'], 0, 0, 0, 0, 0) + struct.pack('<36d', *([0.0]*36))
            emit('/odom', ns, odom, index)
            poses.append(h + p)
            emit('/cdr01/path', ns, h + struct.pack('<I', len(poses)) + b''.join(poses), index)
            final = index == len(frames)-1
            mission = {'timestamp_s': frame['time_s'], 'source': SOURCE, 'live': False,
                'phase': frame['phase'], 'status': result['status'] if final else 'RUNNING',
                'reason': (result['reason'] or '') if final else '', 'scenario': scenario, 'seed': seed,
                'speed_mps': frame['speed_mps'], 'distance_m': frame['distance_m'],
                'energy_estimated_wh': frame['energy_estimated_wh'], 'soc_estimated': frame['soc'],
                'energy_model': 'estimated_not_measured'}
            emit('/cdr01/mission', ns, json.dumps(mission, separators=(',', ':'), allow_nan=False).encode(), index)
        writer.finish()
    return len(frames)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--seed', type=int, default=0)
    parser.add_argument('--scenario', choices=('clear', 'construction', 'sensor_dropout', 'estop'), default='clear')
    args = parser.parse_args()
    count = export_recording(args.output, seed=args.seed, scenario=args.scenario)
    print(f'Exported {count} offline campus kinematic samples to {args.output}. Not live ROS2 or measured telemetry.')


if __name__ == '__main__':
    main()
