import type { StelInstance } from './engine'

interface CuratedObject {
  label: string
  designation: string
  // Only set where needed (see IC 2118 below): J2000 RA/Dec in degrees to
  // fall back to with stel.lookAt() when designation isn't resolvable via
  // stel.getObj() at all - i.e. the object genuinely isn't in the bundled
  // DSO catalog (public/skydata/dso only mirrors data.stellarium.org's
  // reduced survey - see README's "DSO imagery" note), not just "its tile
  // hasn't loaded yet". Centers used already match
  // tools/mirror-nebula-dss.cjs's box for the same object.
  fallbackRaDeg?: number
  fallbackDecDeg?: number
}

// High-school-level "famous objects" only: solar system bodies plus a short
// list of well-known textbook stars/constellations/DSOs - not the full
// bundled catalog. designation is whatever stel.getObj() needs as an exact,
// case-insensitive match (e.g. bright stars only match on their SIMBAD-style
// Bayer form "* alf CMa", not "NAME Sirius"/a HIP number; DSOs need a space
// in "M 31") - verified live against the dev server, not guessed.
const CURATED_OBJECTS: CuratedObject[] = [
  // 은하수 자체는 선택 가능한 카탈로그 천체가 아니라서(엔진이 그냥 하늘 전체
  // 배경 텍스처로만 다룸 - core.selection에 대입하면 WASM에서 바로 크래시남,
  // 실측함) 은하수가 가장 짙게 보이는 궁수자리 방향으로 대신 이동시킨다.
  { label: '은하수 (궁수자리 방향)', designation: 'CON western Sgr' },
  { label: '시리우스', designation: '* alf CMa' },
  { label: '북극성', designation: '* alf UMi' },
  { label: '베가', designation: '* alf Lyr' },
  { label: '폴룩스', designation: '* bet Gem' },
  { label: '데네브', designation: '* alf Cyg' },
  { label: '베텔게우스', designation: '* alf Ori' },
  // 프록시마 센타우리(~11등급)는 번들 별 카탈로그에 없음 - 가장 가까운 항성계인
  // 같은 계의 알파 센타우리(~0등급)로 대체.
  { label: '알파 센타우리', designation: '* alf Cen' },
  { label: '오리온자리', designation: 'CON western Ori' },
  { label: '안드로메다은하 (M31)', designation: 'M 31' },
  { label: '오리온성운 (M42)', designation: 'M 42' },
  { label: '플레이아데스 (M45)', designation: 'M 45' },
  { label: '구상성단 (M22)', designation: 'M 22' },
  { label: '말머리 성운 (IC 434)', designation: 'IC 434' },
  // IC 2118 isn't in the bundled DSO catalog at all (confirmed: absent from
  // both the current mirror and the original test-skydata one it replaced),
  // so getObj() can never resolve it, no matter how long you wait - fall
  // back to pointing the view at its coordinates directly.
  { label: '마녀머리 성운 (IC 2118)', designation: 'IC 2118', fallbackRaDeg: 75.5, fallbackDecDeg: -7.9 },
  { label: '태양', designation: 'NAME Sun' },
  { label: '달', designation: 'NAME Moon' },
  { label: '수성', designation: 'NAME Mercury' },
  { label: '금성', designation: 'NAME Venus' },
  { label: '화성', designation: 'NAME Mars' },
  { label: '목성', designation: 'NAME Jupiter' },
  { label: '토성', designation: 'NAME Saturn' },
  { label: '천왕성', designation: 'NAME Uranus' },
  { label: '해왕성', designation: 'NAME Neptune' },
]

export function createObjectSearch(stel: StelInstance): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.id = 'object-search'

  const select = document.createElement('select')
  select.className = 'object-search-select'

  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = '🔭 천체 선택…'
  placeholder.disabled = true
  placeholder.selected = true
  select.appendChild(placeholder)

  for (const entry of CURATED_OBJECTS) {
    const option = document.createElement('option')
    option.value = entry.designation
    option.textContent = entry.label
    select.appendChild(option)
  }

  const hint = document.createElement('div')
  hint.className = 'object-search-hint'

  // getObj() on a DSO (e.g. IC 2118) that isn't in an already-loaded HiPS
  // tile returns null on the first call but kicks off an async load for
  // that tile in the background (dso.c's get_tile with HIPS_LOAD_IN_THREAD)
  // - so a miss doesn't mean "not found", it can just mean "not loaded yet"
  // (more likely the farther the view currently is from that object, since
  // nearby tiles are more likely already cached). Retry briefly before
  // reporting failure.
  const LOOKUP_RETRY_MS = 200
  const LOOKUP_MAX_ATTEMPTS = 15 // ~3s total

  function lookAtRaDec(raDeg: number, decDeg: number) {
    const ra = raDeg * stel.D2R
    const dec = decDeg * stel.D2R
    const cosDec = Math.cos(dec)
    const icrf = [cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec), 0]
    const observed = stel.convertFrame(stel.core.observer, 'ICRF', 'OBSERVED', icrf)
    // core.lock (set by a previous pointAndLock, e.g. any earlier real
    // object selection) keeps re-centering the view on its old target every
    // frame, which would fight a normal animated lookAt() and snap the view
    // back - and core.lock = null is a silent no-op (the JS property binding
    // collapses null/undefined into a getter call, obj.js's _call treats a
    // 0-arg string as "no arguments" = read, not write - verified live).
    // duration=0 takes a different code path in the engine (core_lookat in
    // core.c) that memsets the whole lock/animation state to zero as a side
    // effect - confirmed live this is the only way that actually clears it -
    // but it also snaps the view instantly, so do it once at the *current*
    // direction (core.observer.azalt, no visible jump) purely to drop the
    // stale lock, then animate to the real target same as pointAndLock()
    // does for every other entry.
    stel.lookAt(stel.core.observer.azalt, 0)
    stel.lookAt(observed, 1.0)
  }

  function trySelect(entry: CuratedObject, attempt: number) {
    // Entries with a fallback are known to never resolve via getObj() at
    // all (confirmed absent from the bundled catalog) - go straight to the
    // known coordinates instead of wasting the retry window first.
    if (entry.fallbackRaDeg !== undefined && entry.fallbackDecDeg !== undefined) {
      lookAtRaDec(entry.fallbackRaDeg, entry.fallbackDecDeg)
      return
    }

    const obj = stel.getObj(entry.designation)
    if (!obj) {
      if (attempt < LOOKUP_MAX_ATTEMPTS) {
        setTimeout(() => trySelect(entry, attempt + 1), LOOKUP_RETRY_MS)
        return
      }
      hint.textContent = '찾을 수 없음'
      setTimeout(() => (hint.textContent = ''), 2000)
      return
    }

    // Same effect as clicking the object on the canvas or pressing Space:
    // select it (drives selection-panel.ts) and center+lock the view on it.
    stel.core.selection = obj
    stel.pointAndLock(obj, 1.0)
  }

  select.addEventListener('change', () => {
    const designation = select.value
    select.value = ''
    if (!designation) return
    const entry = CURATED_OBJECTS.find((e) => e.designation === designation)
    if (entry) trySelect(entry, 0)
  })

  wrapper.appendChild(select)
  wrapper.appendChild(hint)
  document.body.appendChild(wrapper)
  return wrapper
}
