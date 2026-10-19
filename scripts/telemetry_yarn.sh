#!/usr/bin/env bash
# Run the vendored application with its pinned Yarn release and isolated caches.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
repo_root="$PWD"
export YARN_IGNORE_PATH=1
export YARN_GLOBAL_FOLDER="$repo_root/.cache/yarn-global"
export XDG_CACHE_HOME="$repo_root/.cache"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
if [[ -n "${HTTPS_PROXY:-}" ]]; then export YARN_HTTPS_PROXY="$HTTPS_PROXY"; fi
if [[ -n "${HTTP_PROXY:-}" ]]; then export YARN_HTTP_PROXY="$HTTP_PROXY"; fi
cd vendor/lichtblick
exec node "$repo_root/.tools/yarn/node_modules/@yarnpkg/cli-dist/bin/yarn.js" "$@"
