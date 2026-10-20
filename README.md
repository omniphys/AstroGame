# AstroGame

A web game built on top of [Stellarium Web Engine](https://github.com/Stellarium/stellarium-web-engine)
(a WebGL/WASM planetarium renderer) and Vite + TypeScript.

## Layout

- `src/engine.ts` — thin TS wrapper around the engine's global `StelWebEngine()` loader.
- `src/main.ts` — app entry point: creates the canvas, initializes the engine, and wires
  up the sky data sources below.
- `src/ui.ts` — the toggle toolbar (stars, milky way, constellations, grids, etc.).
- `public/engine/` — the built `stellarium-web-engine.js` / `.wasm` (committed so the
  app runs without rebuilding; regenerate with `scripts/build-engine.sh` after
  updating the submodule or patch).
- `public/skydata/` — star/constellation/landscape/etc. data, see "Sky data" below.
- `vite.config.ts` — dev-server tweak so `.gz` data isn't double-decompressed (see
  "Sky data" below).
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

This renders the full sky (stars, milky way, constellations, nebulae, a landscape
horizon, atmosphere) with WebGL, with a toolbar to toggle each layer on/off — see
"Sky data" below for where that data comes from and how to swap in more of it.

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

`public/skydata/` is a copy of the submodule's `apps/test-skydata/` — a small (~5MB)
bundle with a reduced star catalog, the western sky culture, one landscape panorama,
a low-res milky way survey, minor planet/comet/satellite elements, and sun/moon
imagery. `src/main.ts` wires it up via `core.<module>.addDataSource({ url, key })`.
It's enough to render a real sky (see the toolbar toggles in the running app), but it's
a test dataset, not the full Gaia catalog Stellarium Web uses in production — swap in a
fuller bundle (from Stellarium's data releases, or generated via the submodule's
`tools/make-*.py` scripts) under `public/skydata/` the same way for more stars/DSOs/
landscapes/sky cultures.

If you re-copy `apps/test-skydata/` after updating the submodule:

```sh
rm -rf public/skydata && cp -r engine/stellarium-web-engine/apps/test-skydata public/skydata
```

**`.gz` data gotcha:** `tle_satellite.jsonl.gz` is gunzipped by the engine itself, not
the browser. Some static file servers (Vite's dev server included — handled here via
`vite.config.ts`) set `Content-Encoding: gzip` for `.gz` files, which makes the browser
transparently decompress it first and the engine then fails to gunzip the result. If you
deploy to a host that does this (e.g. nginx with `gzip_static on`), disable that for
`/skydata/*.gz` or rename the file so it isn't autodetected as pre-compressed.

## License

`stellarium-web-engine` is **AGPL-3.0** (`engine/stellarium-web-engine/LICENSE-AGPL-3.0.txt`).
Distributing or running this game as a network service requires making the complete
corresponding source available to users, including this project's own code, per AGPL §13.
