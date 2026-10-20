# AstroGame

A web game built on top of [Stellarium Web Engine](https://github.com/Stellarium/stellarium-web-engine)
(a WebGL/WASM planetarium renderer) and Vite + TypeScript.

## Layout

- `src/engine.ts` — thin TS wrapper around the engine's global `StelWebEngine()` loader.
- `src/main.ts` — app entry point: creates the canvas, initializes the engine, and wires
  up the sky data sources below.
- `src/ui.ts` — the toggle toolbar (stars, milky way, constellations, grids, etc.).
- `src/location.ts` — points the observer at the browser's geolocation, if granted.
- `src/selection-panel.ts` — the floating panel shown when an object is selected
  (click-to-select is built into the engine; this just renders its info), in Korean
  with the original name alongside.
- `src/i18n.ts` — English → Korean name lookup, see "Korean names" below.
- `public/fonts/NotoSansKR-Variable.ttf` — loaded at runtime (`stel.setFont`) so
  Korean on-canvas labels actually have glyphs to render with; see "Korean names".
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
  step, `-Werror` on an old C/C++ codebase) so the engine builds with a current Emscripten SDK
  (the upstream repo predates Emscripten's upstream/LLVM backend), plus a small
  `src/designation.c` change so bare (non-`"NAME X"`) star/DSO names are still translatable —
  see "Korean names".
- `scripts/build-engine.sh` — rebuilds the engine and copies output into `public/engine/`.

## Running the game

```sh
npm install
npm run dev
```

This renders the full sky (stars, milky way, constellations, nebulae, a landscape
horizon, atmosphere) with WebGL for the current real time and, if you grant location
access, your actual location — with a toolbar to toggle each layer on/off. See
"Sky data" below for where that data comes from and how to swap in more of it.

**Interaction** (all built into the engine; see `src/main.ts`/`src/selection-panel.ts`):
- Drag to pan, scroll to zoom (zooming into the DSS-covered sky, or the Sun/Moon,
  reveals real imagery instead of just a dot/disc).
- Click an object to select it — a small panel shows its name, type, magnitude,
  distance, and (for stars) spectral type/color.
- With something selected, press **Space** to smoothly recenter and lock the view
  on it.

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

**Planet imagery:** the bundled data only has Sun/Moon textures; `src/main.ts` also
points `core.planets` at Stellarium's own hosted HiPS surveys
(`https://data.stellarium.org/surveys/<mercury|venus|mars|jupiter|saturn|uranus|neptune>`)
for the rest, live third-party fetches like the DSS survey below. Zoom in on a planet to
see it load (HiPS tiles only fetch once a body is close enough to be worth texturing).

**DSS photos (zoomed-in imagery of arbitrary sky objects):** `src/main.ts` also points
`core.dss` at the public CDS HiPS survey `https://alasky.cds.unistra.fr/DSS/DSSColor`
(not bundled — it's a live, third-party, many-GB tile pyramid). This is what the
"DSS Photos" toolbar toggle controls; the Sun/Moon's own bundled imagery and star/DSO
rendering work without it.

**`.gz` data gotcha:** `tle_satellite.jsonl.gz` is gunzipped by the engine itself, not
the browser. Some static file servers (Vite's dev server included — handled here via
`vite.config.ts`) set `Content-Encoding: gzip` for `.gz` files, which makes the browser
transparently decompress it first and the engine then fails to gunzip the result. If you
deploy to a host that does this (e.g. nginx with `gzip_static on`), disable that for
`/skydata/*.gz` or rename the file so it isn't autodetected as pre-compressed.

## Korean names

`public/i18n/skyculture-ko.json` is Stellarium's own English→Korean name dictionary
(vendored from `https://stellarium.sfo2.cdn.digitaloceanspaces.com/i18n/v1/skyculture/ko.json`,
~7000 entries: planets/moons/stars/constellations/DSOs). `src/i18n.ts` looks names up in
it; anything missing (catalog IDs like `M 31`, `HIP 1234`) is left in English, by design.

- **Selection panel** (`src/selection-panel.ts`): always shows "한글명 (English name)".
- **On-canvas labels** (planets, stars, DSOs): wired via the engine's `translateFn`
  hook, same dictionary. Two things had to be fixed for this to actually show up:
  1. The engine only translates designations in a `"NAME X"` format
     (`designation_cleanup` in `src/designation.c`); most star/DSO names in the bundled
     `apps/test-skydata` are stored bare (e.g. `"Sirius"`, not `"NAME Sirius"`) and were
     silently skipped. `engine/patches/0001-emscripten-latest-compat.patch` adds a
     fallback that tries translating bare names too — this needs the engine rebuilt
     (`bash scripts/build-engine.sh`) to take effect, since it's a C change.
  2. The engine's *built-in* font is a heavily subset, Latin-only NotoSans (~16KB) baked
     into the WASM — translated Korean text has no glyphs to render with and silently
     disappears. `src/main.ts` loads `public/fonts/NotoSansKR-Variable.ttf` at runtime via
     `stel.setFont('regular'/'bold', url)`, which the engine tries *before* falling back
     to its built-in font — no rebuild needed for this part, just the font asset.
  - **Still English:** constellation names/lines (`src/modules/constellations.c`'s
    `skycultures_get_label()` falls back to the raw, untranslated id when the skyculture's
    name database has no entry for it — true for most constellations in this reduced
    dataset — and we didn't patch that path) and Bayer/Flamsteed-style star designations
    (e.g. "Iota Aurigae": a different, unpatched code path, and not something Stellarium's
    dictionary covers anyway).

## License

`stellarium-web-engine` is **AGPL-3.0** (`engine/stellarium-web-engine/LICENSE-AGPL-3.0.txt`).
Distributing or running this game as a network service requires making the complete
corresponding source available to users, including this project's own code, per AGPL §13.

`public/fonts/NotoSansKR-Variable.ttf` (Google's Noto Sans KR, from the
[google/fonts](https://github.com/google/fonts/tree/main/ofl/notosanskr) repo) is
**SIL Open Font License 1.1** — see `public/fonts/NotoSansKR-OFL.txt`.
