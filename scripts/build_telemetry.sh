#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p artifacts
.venv/bin/python scripts/export_delivery_recording.py --output artifacts/campus.mcap --seed 0 --scenario clear
.venv/bin/python scripts/export_delivery_recording.py --output artifacts/campus-reactive.mcap --seed 0 --world campus --scenario reactive_obstacle
.venv/bin/python scripts/export_delivery_recording.py --output artifacts/warehouse-reactive.mcap --seed 0 --world warehouse --scenario reactive_obstacle
exec bash scripts/telemetry_yarn.sh web:build:prod
