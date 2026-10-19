#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ "${1:-}" == "--dev" ]]; then
  shift
  mkdir -p artifacts
  .venv/bin/python scripts/export_delivery_recording.py --output artifacts/campus.mcap --seed 0 --scenario clear
  exec bash scripts/telemetry_yarn.sh web:serve --host 127.0.0.1 --port "${PORT:-8080}" "$@"
fi
if (($#)); then echo 'Usage: start_telemetry.sh [--dev]' >&2; exit 2; fi
exec node scripts/serve_telemetry.cjs
