import {
  type ApproachKind,
  type ApproachResult,
  landingParamsForEasiness,
  initialLandingState,
  stepLanding,
  landingOutcome,
  orbitParamsForEasiness,
  needlePosition,
  orbitPressOutcome,
  orbitTimeoutResult,
  ORBIT_ZONE_CENTER,
} from './approach-minigame-sim'

let active = false

export function isApproachMinigameActive(): boolean {
  return active
}

function buildOverlay(kind: ApproachKind): HTMLDivElement {
  const overlay = document.createElement('div')
  overlay.id = 'approach-minigame-overlay'
  overlay.className = `visible approach-minigame-${kind}`
  overlay.innerHTML =
    kind === 'landing'
      ? `
        <div class="approach-hint">Space를 누르고 있으면 역추진합니다 — 안전한 속도로 착륙하세요.</div>
        <div class="approach-landing-track"><div class="approach-landing-fill"></div></div>
        <div class="approach-speed-readout">하강 속도 <span class="approach-speed-value">0</span></div>
      `
      : `
        <div class="approach-hint">바늘이 안전 구간 안에 있을 때 Space를 누르세요.</div>
        <div class="approach-orbit-track">
          <div class="approach-orbit-zone"></div>
          <div class="approach-orbit-needle"></div>
        </div>
      `
  document.body.appendChild(overlay)
  return overlay
}

export function runApproachMinigame(kind: ApproachKind, easiness: number): Promise<ApproachResult> {
  active = true

  return new Promise((resolve) => {
    const overlay = buildOverlay(kind)
    let resolved = false
    let rafHandle = 0

    function finish(result: ApproachResult) {
      if (resolved) return
      resolved = true
      cancelAnimationFrame(rafHandle)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      overlay.remove()
      active = false
      resolve(result)
    }

    let onKeyDown: (e: KeyboardEvent) => void
    let onKeyUp: (e: KeyboardEvent) => void

    if (kind === 'landing') {
      const params = landingParamsForEasiness(easiness)
      let state = initialLandingState(params)
      let thrustHeld = false

      onKeyDown = (e) => {
        if (e.code !== 'Space') return
        e.preventDefault()
        thrustHeld = true
      }
      onKeyUp = (e) => {
        if (e.code !== 'Space') return
        thrustHeld = false
      }

      const fillEl = overlay.querySelector<HTMLDivElement>('.approach-landing-fill')!
      const speedEl = overlay.querySelector<HTMLSpanElement>('.approach-speed-value')!

      let lastTs = performance.now()
      const tick = (ts: number) => {
        const dtMs = Math.min(ts - lastTs, 100)
        lastTs = ts
        state = stepLanding(state, dtMs, thrustHeld, params)
        fillEl.style.height = `${state.altitude}%`
        speedEl.textContent = String(Math.round(state.speed))

        const outcome = landingOutcome(state, params)
        if (outcome !== null) {
          finish(outcome)
          return
        }
        rafHandle = requestAnimationFrame(tick)
      }
      rafHandle = requestAnimationFrame(tick)
    } else {
      const params = orbitParamsForEasiness(easiness)
      const startTs = performance.now()

      onKeyDown = (e) => {
        if (e.code !== 'Space' || e.repeat || resolved) return
        e.preventDefault()
        const elapsedMs = performance.now() - startTs
        finish(orbitPressOutcome(elapsedMs, params))
      }
      onKeyUp = () => {}

      const zoneEl = overlay.querySelector<HTMLDivElement>('.approach-orbit-zone')!
      const needleEl = overlay.querySelector<HTMLDivElement>('.approach-orbit-needle')!
      const zoneStart = ORBIT_ZONE_CENTER - params.zoneWidth / 2
      zoneEl.style.left = `${zoneStart}%`
      zoneEl.style.width = `${params.zoneWidth}%`

      const tick = (ts: number) => {
        const elapsedMs = ts - startTs
        if (elapsedMs >= params.timeLimitMs) {
          finish(orbitTimeoutResult())
          return
        }
        needleEl.style.left = `${needlePosition(elapsedMs, params)}%`
        rafHandle = requestAnimationFrame(tick)
      }
      rafHandle = requestAnimationFrame(tick)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
  })
}
