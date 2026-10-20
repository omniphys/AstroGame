#!/bin/bash
# Builds engine/stellarium-web-engine (a git submodule) to WebAssembly and
# copies the output into public/engine/.
#
# Run this from WSL (or any Linux shell) with Emscripten + SCons available.
# One-time toolchain setup, if you don't have it yet:
#
#   mkdir -p ~/astrogame-build
#   cd ~/astrogame-build
#   python3 -m venv venv && venv/bin/pip install scons
#   git clone https://github.com/emscripten-core/emsdk.git
#   cd emsdk && ./emsdk install latest && ./emsdk activate latest
#
# Override EMSDK_DIR / VENV_DIR below if you installed them elsewhere.

set -e

EMSDK_DIR="${EMSDK_DIR:-$HOME/astrogame-build/emsdk}"
VENV_DIR="${VENV_DIR:-$HOME/astrogame-build/venv}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENGINE_DIR="$REPO_ROOT/engine/stellarium-web-engine"
PATCH="$REPO_ROOT/engine/patches/0001-emscripten-latest-compat.patch"

if [ ! -d "$ENGINE_DIR/src" ]; then
  echo "engine/stellarium-web-engine looks empty - did you run:"
  echo "  git submodule update --init --recursive"
  exit 1
fi

cd "$EMSDK_DIR"
source ./emsdk_env.sh

cd "$ENGINE_DIR"

# Apply our modern-Emscripten compatibility patch once.
# --ignore-whitespace / --whitespace=fix because `git submodule add` on
# Windows (core.autocrlf=true) checks this submodule out with CRLF line
# endings, while the patch was generated from a pure-LF Linux checkout.
if ! git apply --reverse --check --ignore-whitespace "$PATCH" >/dev/null 2>&1; then
  git apply --ignore-whitespace --whitespace=fix "$PATCH"
  echo "Applied $PATCH"
else
  echo "Patch already applied"
fi

PATH="$VENV_DIR/bin:$PATH" emscons scons -j"$(nproc)" mode=release werror=0

mkdir -p "$REPO_ROOT/public/engine"
cp build/stellarium-web-engine.js build/stellarium-web-engine.wasm "$REPO_ROOT/public/engine/"

echo "Done. Output copied to public/engine/"
