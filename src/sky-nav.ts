// Shared "go to this object" helpers used by both the curated dropdown
// (object-search.ts) and the free-text catalog search box
// (catalog-search.ts), factored out so the engine-quirk workarounds below
// only have to be understood (and fixed) in one place.
import type { StelInstance } from './engine'

// Animate the view to a fixed J2000 RA/Dec, for objects with no catalog
// entry to point/lock onto (see catalog-search.ts and object-search.ts's
// IC 2118 fallback).
export function lookAtRaDec(stel: StelInstance, raDeg: number, decDeg: number, duration = 1.0) {
  const ra = raDeg * stel.D2R
  const dec = decDeg * stel.D2R
  const cosDec = Math.cos(dec)
  const icrf = [cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec), 0]
  const observed = stel.convertFrame(stel.core.observer, 'ICRF', 'OBSERVED', icrf)
  // core.lock (set by a previous pointAndLock, e.g. any earlier real object
  // selection) keeps re-centering the view on its old target every frame,
  // which would fight a normal animated lookAt() and snap the view back -
  // and core.lock = null is a silent no-op (the JS property binding
  // collapses null/undefined into a getter call, obj.js's _call treats a
  // 0-arg string as "no arguments" = read, not write - verified live).
  // duration=0 takes a different code path in the engine (core_lookat in
  // core.c) that memsets the whole lock/animation state to zero as a side
  // effect - confirmed live this is the only way that actually clears it -
  // but it also snaps the view instantly, so do it once at the *current*
  // direction (core.observer.azalt, no visible jump) purely to drop the
  // stale lock, then animate to the real target same as pointAndLock() does
  // for a real catalog object.
  stel.lookAt(stel.core.observer.azalt, 0)
  stel.lookAt(observed, duration)
}

// Same effect as clicking the object on the canvas or pressing Space:
// select it (drives selection-panel.ts) and center+lock the view on it.
export function selectAndLock(stel: StelInstance, obj: any, duration = 1.0) {
  stel.core.selection = obj
  stel.pointAndLock(obj, duration)
}

const LOOKUP_RETRY_MS = 200
const LOOKUP_MAX_ATTEMPTS = 15 // ~3s total

// getObj() on an object whose HiPS tile isn't loaded yet returns null on the
// first call but kicks off an async load for that tile in the background
// (dso.c/stars.c's get_tile with HIPS_LOAD_IN_THREAD) - a miss doesn't mean
// "not found", it can just mean "not loaded yet", so retry briefly before
// giving up. Takes a list of candidate designations (a search result may
// not know which exact form the engine indexes it under) and, on each tick,
// tries all of them and takes whichever resolves first.
export function resolveDesignation(
  stel: StelInstance,
  candidates: string[],
  onFound: (obj: any) => void,
  onNotFound: () => void,
  attempt = 0,
) {
  for (const candidate of candidates) {
    const obj = stel.getObj(candidate)
    if (obj) {
      onFound(obj)
      return
    }
  }
  if (attempt < LOOKUP_MAX_ATTEMPTS) {
    setTimeout(() => resolveDesignation(stel, candidates, onFound, onNotFound, attempt + 1), LOOKUP_RETRY_MS)
    return
  }
  onNotFound()
}
