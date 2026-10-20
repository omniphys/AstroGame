# AstroGame

A web game built on top of [Stellarium Web Engine](https://github.com/Stellarium/stellarium-web-engine)
(a WebGL/WASM planetarium renderer) and Vite + TypeScript.

## Layout

- `src/engine.ts` — thin TS wrapper around the engine's global `StelWebEngine()` loader.
- `src/main.ts` — app entry point: creates the canvas and initializes the engine.
- `public/engine/` — the built `stellarium-web-engine.js` / `.wasm` (committed so the
  app runs without rebuilding; regenerate with `scripts/build-engine.sh` after
  updating the submodule or patch).
- `engine/stellarium-web-engine/` — the engine source, as a git submodule.
- `engine/patches/0001-emscripten-latest-compat.patch` — fixes a handful of build flags
  (`EXTRA_EXPORTED_RUNTIME_METHODS` → `EXPORTED_RUNTIME_METHODS`, deprecated `allocate`/
  `ALLOC_NORMAL`/`_malloc`/`_free` runtime methods, link-only flags leaking into the compile
  step, `-Werror` on an old C/C++ codebase) so the engine builds with a current Emscripten SDK.
  The upstream repo predates Emscripten's upstream/LLVM backend.
- `scripts/build-engine.sh` — rebuilds the engine and copies output into `public/engine/`.

## Running the game

```sh
npm install
npm run dev
```

This renders the sky engine (atmosphere, horizon, cardinal points) with WebGL,
but **no stars/constellations/landscapes will show yet** — see "Sky data" below.

## Rebuilding the engine

You only need this if you change the submodule version or the patch. Requires WSL
(or any Linux shell) with Emscripten + SCons:

```sh
# one-time toolchain setup
mkdir -p ~/astrogame-build && cd ~/astrogame-build
python3 -m venv venv && venv/bin/pip install scons
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest

# whenever you need to rebuild
git submodule update --init --recursive
bash scripts/build-engine.sh
```

On Windows, run this from inside WSL (`wsl`), not PowerShell/cmd — the engine's
build system (`make js` → `emscons scons`) is POSIX/shell-script based.

If you re-clone the submodule on Windows, make sure autocrlf doesn't mangle the
shell/Python build scripts' line endings:

```sh
git -C engine/stellarium-web-engine config core.autocrlf false
git -C engine/stellarium-web-engine checkout-index -a -f
```

## Sky data (stars, constellations, landscapes, planets)

The engine source only ships shaders/fonts/textures — the actual astronomical data
(star catalog, sky cultures, DSOs, landscape panoramas, milky way survey tiles, orbital
elements, etc.) is a separate, much larger bundle that upstream's demo apps
(`apps/simple-html`, `apps/web-frontend`) expect to find under a `skydata/` directory,
loaded via `core.<module>.addDataSource({ url, key })` calls. It is **not** included in
the `stellarium-web-engine` repo or in this project.

You'll need to source or build this yourself (e.g. from Stellarium's data releases, or by
generating your own via the `tools/make-*.py` scripts in the submodule) and then wire it
up in `src/main.ts` where the `addDataSource` calls are stubbed out as comments.

## License

`stellarium-web-engine` is **AGPL-3.0** (`engine/stellarium-web-engine/LICENSE-AGPL-3.0.txt`).
Distributing or running this game as a network service requires making the complete
corresponding source available to users, including this project's own code, per AGPL §13.
