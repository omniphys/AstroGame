import type { StelInstance } from './engine'
import { koWithEn } from './i18n'

function formatDistance(au: number): string {
  if (!isFinite(au)) return '—'
  if (au < 1000) return `${au.toFixed(3)} AU`
  const lightYears = au / 63241.08
  return `${lightYears.toFixed(2)} 광년`
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

// M = m - 5*log10(d_pc) + 5, d_pc from the AU distance already read off the
// object (1 pc = 206264.8 AU).
function absoluteMagnitude(vmag: number, distanceAu: number): number {
  const distancePc = distanceAu / 206264.8
  return vmag - 5 * Math.log10(distancePc) + 5
}

// Ballesteros' formula (B-V -> effective temperature), a standard
// closed-form approximation - valid roughly for -0.4 < bv < 2. It's a poor
// fit at the hot end though: a blackbody's B-V stops changing much past
// ~20000K (the flux peak has moved into the UV, out of B/V's reach), so the
// formula compresses the entire O/early-B range into values way below their
// real temperatures - confirmed live: Alnitak (O9.7, catalog B-V -0.20)
// comes out ~13600K here vs. ~29500-33000K in the literature.
function ballesterosTemperatureFromBV(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
}

// Short calibration table for the hot end (O3V-A0V), b-v and Teff from the
// Pecaut & Mamajek (2013) main-sequence sequence - a modern, widely-cited
// calibration that (unlike Ballesteros) stays well-behaved down to the
// hottest O stars. Below the table's blue end, clamp to the O3V point
// rather than extrapolating a fit with no calibration data behind it.
// Above its red end (~A0V), hand off to Ballesteros, which is fine from
// here redward.
//
// This still won't fully fix an individual very blue star whose catalog
// B-V is reddened by interstellar dust (common for O/B stars - they're
// often embedded in the dust they ionize, Alnitak included): reddening
// shifts the *observed* B-V redder than the star's true color, so any
// B-V-only formula - this one too - will still undershoot for it. There's
// no per-star extinction data in the bundled catalog to correct for that.
const HOT_STAR_BV_TEFF: [bv: number, teffK: number][] = [
  [-0.33, 44900], // O3V
  [-0.3, 33000], // O9V/B0V
  [-0.26, 26000], // B1V
  [-0.24, 21000], // B2V
  [-0.2, 17000], // B3V
  [-0.17, 15700], // B5V
  [-0.11, 11900], // B8V
  [-0.02, 9700], // A0V
]

// Orion's Belt - all three are O/early-B supergiants embedded in the
// dusty Orion OB1 association, so their catalog B-V is reddened enough
// that even the hot-star table above still undershoots badly (e.g.
// Alnitak's B-V of -0.20 implies B3V territory, but it's really O9.7Ib).
// Rather than guess a per-star dereddening correction with data we don't
// have, use literature effective temperatures directly for these three.
// Values are the commonly-cited figures for each (Alnitak O9.7Ib, Alnilam
// B0Ia, Mintaka O9.5II); expect +-1500K depending on source.
const LITERATURE_TEMPERATURE_K: Record<string, number> = {
  Alnitak: 29500,
  Alnilam: 27000,
  Mintaka: 29500,
}

function temperatureFromBV(bv: number): number {
  const table = HOT_STAR_BV_TEFF
  if (bv >= table[table.length - 1][0]) return ballesterosTemperatureFromBV(bv)
  if (bv <= table[0][0]) return table[0][1]
  for (let i = 0; i < table.length - 1; i++) {
    const [bv0, t0] = table[i]
    const [bv1, t1] = table[i + 1]
    if (bv >= bv0 && bv <= bv1) return t0 + ((bv - bv0) / (bv1 - bv0)) * (t1 - t0)
  }
  return ballesterosTemperatureFromBV(bv) // unreachable, keeps TS happy
}

// obj.path isn't populated for most individual sky objects (only for
// modules), so infer the kind from the shape of its jsonData instead -
// each klass's get_json_data() fills in different fields.
function describeType(obj: any): string {
  const data = obj.jsonData || {}
  const md = data.model_data || {}
  if (typeof md.BVMag === 'number' || typeof md.spect_t === 'string') return '별'
  if (typeof md.morpho === 'string' || typeof md.dimx === 'number') return '성운·은하'
  if (typeof md.horizons_id === 'number') return '행성·달·태양'
  if (data.can_orbit !== undefined) return '소행성·인공위성'
  if (/^[A-Z]?\/\d{4}/.test(obj.id || '')) return '혜성'
  return '천체'
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

    // "NAME X" is the engine's convention for a translatable proper name
    // (e.g. "NAME Sun", "NAME Jupiter") - strip it before dictionary lookup,
    // same as the engine's own sys_translate("sky", dsgn + 5) does.
    const rawName = obj.designations()[0] || obj.id || 'Unknown'
    const lookupName = rawName.startsWith('NAME ') ? rawName.slice(5) : rawName
    const name = koWithEn(lookupName)
    const vmag = obj.getInfo('vmag')
    const distanceAu = obj.getInfo('distance')
    const data = obj.jsonData
    const md = data && data.model_data
    // getInfo('distance') also returns a (heliocentric/geocentric) value for
    // planets, but the inverse-square absolute-magnitude formula below only
    // means anything for a self-luminous star - gate it on the same
    // BVMag/spect_t signal describeType() uses to mean "this is a star".
    const isStar = !!md && (typeof md.BVMag === 'number' || typeof md.spect_t === 'string')

    let rows = row('종류', describeType(obj))
    if (isStar) {
      // 별은 연주시차 -> 거리 -> 겉보기 등급 -> 절대 등급 -> 색지수 -> 표면온도 순.
      if (md && typeof md.plx === 'number' && isFinite(md.plx) && md.plx > 0) {
        rows += row('연주시차', `${(md.plx / 1000).toFixed(3)}″`)
      }
      if (typeof distanceAu === 'number' && isFinite(distanceAu)) {
        rows += row('거리', formatDistance(distanceAu))
      }
      if (typeof vmag === 'number' && isFinite(vmag)) {
        rows += row('겉보기 등급', vmag.toFixed(2))
        if (typeof distanceAu === 'number' && isFinite(distanceAu)) {
          rows += row('절대 등급', absoluteMagnitude(vmag, distanceAu).toFixed(2))
        }
      }
      if (typeof md.BVMag === 'number') {
        const color = bvToColor(md.BVMag)
        rows += row(
          `색지수 (B-V ${md.BVMag.toFixed(2)})`,
          `<span class="swatch" style="background:${color}"></span>`,
        )
        const litMatch = obj.designations().find((d: string) => d in LITERATURE_TEMPERATURE_K)
        const teff = litMatch ? LITERATURE_TEMPERATURE_K[litMatch] : temperatureFromBV(md.BVMag)
        rows += row('표면온도', `약 ${Math.round(teff)} K`)
      }
      if (typeof md.spect_t === 'string' && md.spect_t) {
        rows += row('분광형', md.spect_t)
      }
    } else {
      if (typeof vmag === 'number' && isFinite(vmag)) {
        rows += row('겉보기 등급', vmag.toFixed(2))
      }
      if (typeof distanceAu === 'number' && isFinite(distanceAu)) {
        rows += row('거리', formatDistance(distanceAu))
      }
      if (md && typeof md.morpho === 'string' && md.morpho) {
        rows += row('형태 분류', md.morpho)
      }
    }

    panel.innerHTML =
      `<div class="title">${name}</div>${rows}` +
      `<div class="hint">스페이스바: 가운데로 이동 · 휠: 확대</div>`
    panel.classList.add('visible')
  }

  stel.change((obj: any, attr: string) => {
    if (attr === 'selection' && obj.path === 'core') {
      render(stel.core.selection)
    }
  })
}
