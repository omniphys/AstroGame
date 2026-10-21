import type { StelInstance } from './engine'

interface CuratedObject {
  label: string
  designation: string
}

// High-school-level "famous objects" only: solar system bodies plus a short
// list of well-known textbook stars/constellations/DSOs - not the full
// bundled catalog. designation is whatever stel.getObj() needs as an exact,
// case-insensitive match (e.g. bright stars only match on their SIMBAD-style
// Bayer form "* alf CMa", not "NAME Sirius"/a HIP number; DSOs need a space
// in "M 31") - verified live against the dev server, not guessed.
const CURATED_OBJECTS: CuratedObject[] = [
  { label: '태양', designation: 'NAME Sun' },
  { label: '달', designation: 'NAME Moon' },
  { label: '수성', designation: 'NAME Mercury' },
  { label: '금성', designation: 'NAME Venus' },
  { label: '화성', designation: 'NAME Mars' },
  { label: '목성', designation: 'NAME Jupiter' },
  { label: '토성', designation: 'NAME Saturn' },
  { label: '천왕성', designation: 'NAME Uranus' },
  { label: '해왕성', designation: 'NAME Neptune' },
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
  { label: '마녀머리 성운 (IC 2118)', designation: 'IC 2118' },
]

export function createObjectSearch(stel: StelInstance): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.id = 'object-search'

  const select = document.createElement('select')
  select.className = 'object-search-select'

  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = '천체 검색…'
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

  select.addEventListener('change', () => {
    const designation = select.value
    select.value = ''
    if (!designation) return

    const obj = stel.getObj(designation)
    if (!obj) {
      hint.textContent = '찾을 수 없음'
      setTimeout(() => (hint.textContent = ''), 2000)
      return
    }

    // Same effect as clicking the object on the canvas or pressing Space:
    // select it (drives selection-panel.ts) and center+lock the view on it.
    stel.core.selection = obj
    stel.pointAndLock(obj, 1.0)
  })

  wrapper.appendChild(select)
  wrapper.appendChild(hint)
  document.body.appendChild(wrapper)
  return wrapper
}
