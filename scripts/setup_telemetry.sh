#!/usr/bin/env bash
# Reproducible setup for the vendored MPL-2.0 Lichtblick web application.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
repo_root="$PWD"
# Fail before creating a partial environment when the container is outdated.
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'Node.js >=20 and npm are required. Pull main, then run Codespaces: Rebuild Container.' >&2
  exit 1
fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  echo 'Node.js >=20 is required. Rebuild the updated dev container to install Node.js 24.' >&2
  exit 1
fi
if ! python3 -c 'import venv, ensurepip' >/dev/null 2>&1; then
  echo 'Python venv support is missing. Install python3-venv (apt-get install -y python3-venv), or rebuild the updated dev container.' >&2
  exit 1
fi
export npm_config_cache="$repo_root/.cache/npm"
export XDG_CACHE_HOME="$repo_root/.cache"
export YARN_GLOBAL_FOLDER="$repo_root/.cache/yarn-global"
export YARN_IGNORE_PATH=1
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
# Yarn requires explicit proxy settings; preserve the platform's injected route.
if [[ -n "${HTTPS_PROXY:-}" ]]; then export YARN_HTTPS_PROXY="$HTTPS_PROXY"; fi
if [[ -n "${HTTP_PROXY:-}" ]]; then export YARN_HTTP_PROXY="$HTTP_PROXY"; fi
python3 -m venv .venv
.venv/bin/python -m pip install --cache-dir "$repo_root/.cache/pip" -r requirements-telemetry.txt
# Dependency downloads can hit a transient proxy ECONNRESET in Actions.
# Retry *network installation only*; never hide errors in the actual build.
retry_dependency_install() {
  local attempt
  for attempt in 1 2 3; do
    if "$@"; then return 0; fi
    echo "Dependency network/install failed on attempt ${attempt}/3" >&2
    if (( attempt < 3 )); then sleep "$((attempt * 7))"; fi
  done
  echo 'Dependency installation failed three times; not running an unverified build.' >&2
  return 1
}
retry_dependency_install npm install --prefix "$repo_root/.tools/yarn" @yarnpkg/cli-dist@4.17.0 --ignore-scripts
cd vendor/lichtblick
retry_dependency_install node "$repo_root/.tools/yarn/node_modules/@yarnpkg/cli-dist/bin/yarn.js" install --immutable
cd "$repo_root"
bash scripts/build_telemetry.sh
