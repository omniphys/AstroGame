import type { StelInstance } from './engine'

interface ToggleSpec {
  label: string
  getObj: (stel: StelInstance) => any
  attr: string
}

// 별/은하수/성운·은하/DSS 사진은 토글 없이 엔진 기본값 그대로 표시한다
// (main.ts의 addDataSource만으로 켜짐/꺼짐이 정해짐).
const TOGGLES: ToggleSpec[] = [
  { label: '별자리', getObj: (s) => s.core.constellations, attr: 'lines_visible' },
  { label: '별자리 그림', getObj: (s) => s.core.constellations, attr: 'images_visible' },
  { label: '대기', getObj: (s) => s.core.atmosphere, attr: 'visible' },
  { label: '풍경', getObj: (s) => s.core.landscapes, attr: 'visible' },
  { label: '적도 좌표망', getObj: (s) => s.core.lines.equatorial, attr: 'visible' },
  { label: '지평 좌표망', getObj: (s) => s.core.lines.azimuthal, attr: 'visible' },
]

export function createToolbar(stel: StelInstance): HTMLDivElement {
  const bar = document.createElement('div')
  bar.id = 'sky-toolbar'

  for (const toggle of TOGGLES) {
    const obj = toggle.getObj(stel)
    const btn = document.createElement('button')
    btn.className = 'sky-toggle'
    btn.textContent = toggle.label

    const sync = () => btn.classList.toggle('active', !!obj[toggle.attr])
    sync()

    btn.addEventListener('click', () => {
      obj[toggle.attr] = !obj[toggle.attr]
      sync()
    })

    bar.appendChild(btn)
  }

  document.body.appendChild(bar)
  return bar
}
