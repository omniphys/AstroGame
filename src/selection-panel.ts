import type { StelInstance } from './engine'

function formatDistance(au: number): string {
  if (!isFinite(au)) return '—'
  if (au < 1000) return `${au.toFixed(3)} AU`
  const lightYears = au / 63241.08
  return `${lightYears.toFixed(2)} ly`
}

// Rough B-V color-index -> sRGB approximation (standard amateur-astronomy
// piecewise fit), just for a visual swatch - not colorimetrically exact.
function bvToColor(bv: number): string {
  const stops: [number, [number, number, number]][] = [
    [-0.4, [155, 176, 255]],
    [0.0, [202, 215, 255]],
    [0.3, [248, 247, 255]],
    [0.6, [255, 244, 234]],
    [1.0, [255, 210, 161]],
    [1.5, [255, 163, 81]],
    [2.0, [255, 97, 41]],
  ]
  const t = Math.max(stops[0][0], Math.min(stops[stops.length - 1][0], bv))
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]
    const [t1, c1] = stops[i + 1]
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0)
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f)
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f)
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f)
      return `rgb(${r},${g},${b})`
    }
  }
  return 'rgb(255,255,255)'
}

// obj.path isn't populated for most individual sky objects (only for
// modules), so infer the kind from the shape of its jsonData instead -
// each klass's get_json_data() fills in different fields.
function describeType(obj: any): string {
  const data = obj.jsonData || {}
  const md = data.model_data || {}
  if (typeof md.BVMag === 'number' || typeof md.spect_t === 'string') return 'Star'
  if (typeof md.morpho === 'string' || typeof md.dimx === 'number') return 'Deep-sky object'
  if (typeof md.horizons_id === 'number') return 'Planet / Moon / Sun'
  if (data.can_orbit !== undefined) return 'Minor planet / satellite'
  if (/^[A-Z]?\/\d{4}/.test(obj.id || '')) return 'Comet'
  return 'Celestial object'
}

function row(label: string, valueHtml: string): string {
  return `<div class="row"><span class="label">${label}</span><span class="value">${valueHtml}</span></div>`
}

export function createSelectionPanel(stel: StelInstance): void {
  const panel = document.createElement('div')
  panel.id = 'selection-panel'
  document.body.appendChild(panel)

  function render(obj: any) {
    if (!obj) {
      panel.classList.remove('visible')
      return
    }

    const name = obj.designations()[0] || obj.id || 'Unknown'
    const vmag = obj.getInfo('vmag')
    const distanceAu = obj.getInfo('distance')
    const data = obj.jsonData
    const md = data && data.model_data

    let rows = row('Type', describeType(obj))
    if (typeof vmag === 'number' && isFinite(vmag)) {
      rows += row('Magnitude', vmag.toFixed(2))
    }
    if (typeof distanceAu === 'number' && isFinite(distanceAu)) {
      rows += row('Distance', formatDistance(distanceAu))
    }
    if (md && typeof md.spect_t === 'string' && md.spect_t) {
      rows += row('Spectral type', md.spect_t)
    }
    if (md && typeof md.BVMag === 'number') {
      const color = bvToColor(md.BVMag)
      rows += row(
        `Color (B-V ${md.BVMag.toFixed(2)})`,
        `<span class="swatch" style="background:${color}"></span>`,
      )
    }
    if (md && typeof md.morpho === 'string' && md.morpho) {
      rows += row('Morphology', md.morpho)
    }

    panel.innerHTML =
      `<div class="title">${name}</div>${rows}` +
      `<div class="hint">Space: center on it &middot; scroll: zoom in</div>`
    panel.classList.add('visible')
  }

  stel.change((obj: any, attr: string) => {
    if (attr === 'selection' && obj.path === 'core') {
      render(stel.core.selection)
    }
  })
}
