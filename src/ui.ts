import type { StelInstance } from './engine'

interface ToggleSpec {
  label: string
  getObj: (stel: StelInstance) => any
  attr: string
}

const TOGGLES: ToggleSpec[] = [
  { label: 'Stars', getObj: (s) => s.core.stars, attr: 'visible' },
  { label: 'Milky Way', getObj: (s) => s.core.milkyway, attr: 'visible' },
  { label: 'Constellations', getObj: (s) => s.core.constellations, attr: 'lines_visible' },
  { label: 'Constellation Art', getObj: (s) => s.core.constellations, attr: 'images_visible' },
  { label: 'Nebulae', getObj: (s) => s.core.dsos, attr: 'visible' },
  { label: 'Atmosphere', getObj: (s) => s.core.atmosphere, attr: 'visible' },
  { label: 'Landscape', getObj: (s) => s.core.landscapes, attr: 'visible' },
  { label: 'Equatorial Grid', getObj: (s) => s.core.lines.equatorial, attr: 'visible' },
  { label: 'Azimuthal Grid', getObj: (s) => s.core.lines.azimuthal, attr: 'visible' },
  { label: 'DSS Photos', getObj: (s) => s.core.dss, attr: 'visible' },
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
