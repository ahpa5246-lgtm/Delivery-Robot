"""Monotonic-time fail-safe linear/angular motion command gate.

This module is used by the ROS 2 velocity watchdog adapter. It is NOT a
safety-certified emergency stop and does not replace an independent hardware
power cutoff in a physical robot.
"""
from dataclasses import dataclass
from math import isfinite


@dataclass
class CommandWatchdog:
    timeout_s: float = 0.5
    max_linear_mps: float = 0.8
    max_angular_radps: float = 0.8

    def __post_init__(self):
        if not (self.timeout_s > 0 and isfinite(self.timeout_s)):
            raise ValueError("timeout_s must be finite and > 0")
        self.last_command_at: float | None = None
        self.request_linear = 0.0
        self.request_angular = 0.0
        self.inhibited = False

    def receive(self, linear: float, angular: float, monotonic_now: float):
        if not all(map(isfinite, (linear, angular, monotonic_now))):
            self.inhibit()
            raise ValueError("nonfinite velocity command or timestamp")
        self.request_linear = max(-self.max_linear_mps, min(self.max_linear_mps, linear))
        self.request_angular = max(-self.max_angular_radps, min(self.max_angular_radps, angular))
        self.last_command_at = monotonic_now
        return self.output(monotonic_now)

    def inhibit(self):
        self.inhibited = True
        self.request_linear = 0.0
        self.request_angular = 0.0

    def release(self):
        self.inhibited = False
        self.last_command_at = None
        self.request_linear = 0.0
        self.request_angular = 0.0

    def output(self, monotonic_now: float):
        if (self.inhibited or self.last_command_at is None or
                monotonic_now < self.last_command_at or
                monotonic_now - self.last_command_at > self.timeout_s):
            return 0.0, 0.0
        return self.request_linear, self.request_angular
