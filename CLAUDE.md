# CLAUDE.md

Guidance for Claude Code when working in this repo. This file is committed to
git so it's shared between machines (home/work) — keep it in sync with how
the project actually works, not aspirational rules.

For project layout, running the app, rebuilding the engine, sky data, and
Korean i18n, see [README.md](README.md) — don't duplicate that here.

## Environment

Two machines, two OSes: **home is macOS**, **work is Windows + WSL**. Keep
that asymmetry in mind — don't assume a shell/tool choice from one side
works on the other.

Day-to-day dev (`npm run dev`, editing `src/`) runs the same way on both:
plain Terminal on macOS, plain PowerShell on Windows. Only rebuilding the
`stellarium-web-engine` submodule (changing the submodule version or
`engine/patches/`) needs a POSIX shell + Emscripten/SCons — native Terminal
on macOS, but **WSL on Windows** (the build is `make js` → `emscons scons`,
not PowerShell/cmd-compatible). See README's "Rebuilding the engine".

`public/engine/` (built engine JS/WASM) is committed, so a fresh checkout
runs via `npm run dev` on either machine without needing to touch the
submodule or rebuild anything.

## First checkout on a new/other machine

```sh
git clone --recurse-submodules <repo-url>
# or, if already cloned without --recurse-submodules:
git submodule update --init --recursive
npm install
```

On Windows only, if the submodule gets checked out with CRLF, fix autocrlf
before touching its build scripts (see README) — `.gitattributes` forces
`*.sh` to LF and leaves `public/skydata/**` untouched, but this covers the
submodule's own files:

```sh
git -C engine/stellarium-web-engine config core.autocrlf false
git -C engine/stellarium-web-engine checkout-index -a -f
```

Not needed on macOS.

## Code style

Match what's already in `src/`:

- No semicolons, single quotes.
- No comments unless they explain a non-obvious *why* (a workaround, a
  timing/ordering constraint, an upstream quirk) — see `src/main.ts` for the
  tone to match. Don't add comments that restate what the code does.
- `tsconfig.json` has `noUnusedLocals`/`noUnusedParameters` on — keep the
  code clean of both rather than disabling the check.

## Working across two machines

- Commit and push before switching machines; pull (with
  `git submodule update`) before resuming. There's no other sync mechanism.
- `.claude/` is gitignored on purpose (local lock files, scheduled task
  state) — don't put anything in it that needs to follow the project between
  machines. Shared instructions belong here in the repo-root `CLAUDE.md`.
