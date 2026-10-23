import {
  type ApproachKind,
  type ApproachResult,
  type ApproachTuning,
  type LandingState,
  type OrbitState,
  landingParamsFor,
  initialLandingState,
  stepLanding,
  landingOutcome,
  orbitParamsFor,
  initialOrbitState,
  stepOrbit,
  orbitOutcome,
  LANDING_CANVAS_WIDTH,
  LANDING_CANVAS_HEIGHT,
} from './approach-minigame-sim'

let active = false

export function isApproachMinigameActive(): boolean {
  return active
}

// sim.ts의 ORBIT_MAX_RADIUS(140)보다 여유 있게 커야 궤도 반경이 캔버스
// 밖으로 나가지 않음 - 둘을 같이 조정할 때 유의.
const ORBIT_CANVAS_SIZE = 300
const ORBIT_PLANET_RADIUS = 30
const ORBIT_SPIN_RADIANS_PER_SEC = 1.4

function buildOverlay(kind: ApproachKind): { overlay: HTMLDivElement; canvas: HTMLCanvasElement; fuelFill: HTMLDivElement } {
  const overlay = document.createElement('div')
  overlay.id = 'approach-minigame-overlay'
  overlay.className = `visible approach-minigame-${kind}`
  overlay.innerHTML =
    kind === 'landing'
      ? `
        <div class="approach-hint">방향키로 조작해 중앙 착륙장에 안착하세요.</div>
        <canvas class="approach-canvas" width="${LANDING_CANVAS_WIDTH}" height="${LANDING_CANVAS_HEIGHT}"></canvas>
        <div class="approach-fuel-bar"><div class="approach-fuel-fill"></div></div>
      `
      : `
        <div class="approach-hint">방향키로 궤도 반경을 목표 범위 안으로 맞추고 안정시키세요.</div>
        <canvas class="approach-canvas" width="${ORBIT_CANVAS_SIZE}" height="${ORBIT_CANVAS_SIZE}"></canvas>
        <div class="approach-fuel-bar"><div class="approach-fuel-fill"></div></div>
      `
  document.body.appendChild(overlay)
  return {
    overlay,
    canvas: overlay.querySelector('.approach-canvas')!,
    fuelFill: overlay.querySelector('.approach-fuel-fill')!,
  }
}

function drawLanding(ctx: CanvasRenderingContext2D, state: LandingState, params: ReturnType<typeof landingParamsFor>) {
  const { canvasWidth, canvasHeight, groundY, targetHalfWidth } = params
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  ctx.fillStyle = '#0d1c30'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  ctx.fillStyle = '#16304f'
  ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY)

  const targetCenter = canvasWidth / 2
  ctx.fillStyle = 'rgba(255, 181, 71, 0.5)'
  ctx.fillRect(targetCenter - targetHalfWidth, groundY - 4, targetHalfWidth * 2, 4)

  ctx.beginPath()
  ctx.arc(state.x, state.y, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#ffd79a'
  ctx.fill()
}

function drawOrbit(ctx: CanvasRenderingContext2D, state: OrbitState, params: ReturnType<typeof orbitParamsFor>, angle: number) {
  const size = ORBIT_CANVAS_SIZE
  const centerX = size / 2
  const centerY = size / 2
  ctx.clearRect(0, 0, size, size)

  ctx.fillStyle = '#05070c'
  ctx.fillRect(0, 0, size, size)

  ctx.beginPath()
  ctx.arc(centerX, centerY, params.targetRadius + params.targetHalfWidth, 0, Math.PI * 2)
  ctx.arc(centerX, centerY, params.targetRadius - params.targetHalfWidth, 0, Math.PI * 2, true)
  ctx.fillStyle = 'rgba(110, 220, 255, 0.2)'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(centerX, centerY, ORBIT_PLANET_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = '#6edcff'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(centerX, centerY, state.radius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.stroke()

  const shipX = centerX + state.radius * Math.cos(angle)
  const shipY = centerY + state.radius * Math.sin(angle)
  ctx.beginPath()
  ctx.arc(shipX, shipY, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
}

export function runApproachMinigame(kind: ApproachKind, tuning: ApproachTuning): Promise<ApproachResult> {
  active = true

  return new Promise((resolve) => {
    const { overlay, canvas, fuelFill } = buildOverlay(kind)
    const ctx = canvas.getContext('2d')!
    let resolved = false
    let rafHandle = 0
    const heldKeys = new Set<string>()

    function finish(result: ApproachResult) {
      if (resolved) return
      resolved = true
      cancelAnimationFrame(rafHandle)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      overlay.remove()
      active = false
      resolve(result)
    }

    const TRACKED_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

    function onKeyDown(e: KeyboardEvent) {
      if (!TRACKED_CODES.has(e.code)) return
      e.preventDefault()
      heldKeys.add(e.code)
    }
    function onKeyUp(e: KeyboardEvent) {
      if (!TRACKED_CODES.has(e.code)) return
      heldKeys.delete(e.code)
    }
    function onBlur() {
      heldKeys.clear()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    if (kind === 'landing') {
      const params = landingParamsFor(tuning)
      const startX = params.canvasWidth / 2 + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80)
      let state = initialLandingState(params, startX)

      let lastTs = performance.now()
      const tick = (ts: number) => {
        const dtMs = Math.min(ts - lastTs, 100)
        lastTs = ts
        const keys = { up: heldKeys.has('ArrowUp'), left: heldKeys.has('ArrowLeft'), right: heldKeys.has('ArrowRight') }
        state = stepLanding(state, dtMs, keys, params)
        drawLanding(ctx, state, params)
        fuelFill.style.width = `${(state.fuel / params.maxFuel) * 100}%`

        const outcome = landingOutcome(state, params)
        if (outcome !== null) {
          finish(outcome)
          return
        }
        rafHandle = requestAnimationFrame(tick)
      }
      rafHandle = requestAnimationFrame(tick)
    } else {
      const params = orbitParamsFor(tuning)
      let state = initialOrbitState(params)
      let angle = 0

      let lastTs = performance.now()
      const tick = (ts: number) => {
        const dtMs = Math.min(ts - lastTs, 100)
        lastTs = ts
        angle += ORBIT_SPIN_RADIANS_PER_SEC * (dtMs / 1000)
        const keys = { up: heldKeys.has('ArrowUp'), down: heldKeys.has('ArrowDown') }
        state = stepOrbit(state, dtMs, keys, params)
        drawOrbit(ctx, state, params, angle)
        fuelFill.style.width = `${(state.fuel / params.maxFuel) * 100}%`

        const outcome = orbitOutcome(state, params)
        if (outcome !== null) {
          finish(outcome)
          return
        }
        rafHandle = requestAnimationFrame(tick)
      }
      rafHandle = requestAnimationFrame(tick)
    }
  })
}

