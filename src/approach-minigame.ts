import {
  type ApproachKind,
  type ApproachResult,
  type ApproachTuning,
  type LandingState,
  type OrbitState,
  type LandingSurfaceKind,
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
import { createThrustLoop } from './sound'

export interface ApproachVisuals {
  planetTextureFile?: string // public/textures/planets/*.jpg - 궤도 진입 미니게임에서만 사용
  landingSurfaceKind?: LandingSurfaceKind // 착륙 미니게임에서만 사용
  landingSurfaceColor?: string
}

let active = false

export function isApproachMinigameActive(): boolean {
  return active
}

// sim.ts의 ORBIT_MAX_RADIUS(140)보다 여유 있게 커야 궤도 반경이 캔버스
// 밖으로 나가지 않음 - 둘을 같이 조정할 때 유의.
const ORBIT_CANVAS_SIZE = 300
const ORBIT_PLANET_RADIUS = 22

const INTRO_TEXT: Record<ApproachKind, { title: string; controls: string[]; blurb: string; startLabel: string }> = {
  landing: {
    title: '🛬 착륙 미션',
    controls: ['← 왼쪽 분사기 분사 → 오른쪽으로 이동', '→ 오른쪽 분사기 분사 → 왼쪽으로 이동', '↓ 아래쪽 분사기 분사 → 위로 떠올라 감속(브레이크)'],
    blurb: '중력에 끌려 떨어지는 탐사선을 조종해 중앙 착륙장에 사뿐히 내려놓으세요. 너무 빨리 떨어지거나 착륙장을 벗어나면 실패합니다. 연료는 한정되어 있으니 필요할 때만 분사하세요.',
    startLabel: '착륙 시작',
  },
  orbit: {
    title: '🛰️ 궤도 진입 미션',
    controls: ['↑ 진행 방향으로 분사(프로그레이드) → 속도 증가', '↓ 진행 방향과 반대로 분사(레트로그레이드) → 속도 감소'],
    blurb: '탐사선은 지금 행성 둘레를 원운동하고 있습니다. 속도를 바꾸면 궤도가 타원으로 늘어졌다가, 시간이 지나며 그 속도에 맞는 원 궤도로 자연스럽게 둥글어집니다. 그 원 궤도가 목표 범위 안에 들어오면 한 바퀴 돌 때까지 유지해야 성공입니다. 연료도 시간 제한도 없으니 천천히 맞춰 보세요. 다만 속도를 너무 줄이면 행성에 충돌하고, 너무 높이면 궤도를 벗어나 화면 밖으로 날아가 버립니다.',
    startLabel: '진입 시작',
  },
}

function buildOverlay(kind: ApproachKind): {
  overlay: HTMLDivElement
  canvas: HTMLCanvasElement
  fuelFill: HTMLDivElement | null
  introPanel: HTMLDivElement
  startButton: HTMLButtonElement
} {
  const intro = INTRO_TEXT[kind]
  const overlay = document.createElement('div')
  overlay.id = 'approach-minigame-overlay'
  overlay.className = `visible approach-minigame-${kind}`
  overlay.innerHTML =
    kind === 'landing'
      ? `
        <div class="approach-hint">방향키로 분사기를 조작해 중앙 착륙장에 안착하세요.</div>
        <canvas class="approach-canvas" width="${LANDING_CANVAS_WIDTH}" height="${LANDING_CANVAS_HEIGHT}"></canvas>
        <div class="approach-fuel-bar"><div class="approach-fuel-fill"></div></div>
      `
      : `
        <div class="approach-hint">방향키로 속도를 조절해 궤도 반경을 목표 범위 안으로 맞추고, 그 상태로 한 바퀴 돌 때까지 유지하세요. 연료도 시간 제한도 없습니다.</div>
        <canvas class="approach-canvas" width="${ORBIT_CANVAS_SIZE}" height="${ORBIT_CANVAS_SIZE}"></canvas>
      `
  overlay.insertAdjacentHTML(
    'beforeend',
    `
      <div class="approach-intro">
        <div class="approach-intro-card">
          <h3 class="approach-intro-title">${intro.title}</h3>
          <ul class="approach-intro-controls">${intro.controls.map((c) => `<li>${c}</li>`).join('')}</ul>
          <p class="approach-intro-blurb">${intro.blurb}</p>
          <button class="approach-start-button">${intro.startLabel}</button>
        </div>
      </div>
    `,
  )
  document.body.appendChild(overlay)
  return {
    overlay,
    canvas: overlay.querySelector('.approach-canvas')!,
    fuelFill: overlay.querySelector('.approach-fuel-fill'),
    introPanel: overlay.querySelector('.approach-intro')!,
    startButton: overlay.querySelector('.approach-start-button')!,
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

// 분사기가 뿜는 가스는 항상 힘의 반대 방향으로 그린다 - 왼쪽 분사기가 힘을
// 오른쪽으로 내므로 불꽃은 왼쪽(-1,0)으로, 그 반대쌍도 마찬가지.
function drawFlame(ctx: CanvasRenderingContext2D, nx: number, ny: number, dx: number, dy: number) {
  const len = 9 + Math.random() * 7
  const grad = ctx.createLinearGradient(nx, ny, nx + dx * len, ny + dy * len)
  grad.addColorStop(0, 'rgba(255, 246, 200, 0.95)')
  grad.addColorStop(1, 'rgba(255, 106, 61, 0)')
  const perpX = -dy
  const perpY = dx
  ctx.beginPath()
  ctx.moveTo(nx + perpX * 3, ny + perpY * 3)
  ctx.lineTo(nx - perpX * 3, ny - perpY * 3)
  ctx.lineTo(nx + dx * len, ny + dy * len)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
}

function drawRover(ctx: CanvasRenderingContext2D, x: number, y: number, firing: { left: boolean; right: boolean; down: boolean }, rotation = 0) {
  ctx.save()
  ctx.translate(x, y)
  if (rotation !== 0) ctx.rotate(rotation)

  ctx.fillStyle = '#2c3e5a'
  ctx.strokeStyle = '#eaf6ff'
  ctx.lineWidth = 1.5
  for (const wx of [-9, -3, 3, 9]) {
    ctx.beginPath()
    ctx.arc(wx, 7, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  ctx.fillStyle = '#9ad0ff'
  roundedRect(ctx, -13, -6, 26, 13, 3)
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = '#eaf6ff'
  ctx.beginPath()
  ctx.moveTo(-6, -6)
  ctx.lineTo(-10, -14)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(-10, -15, 2, 0, Math.PI * 2)
  ctx.fillStyle = '#ffb86b'
  ctx.fill()

  ctx.fillStyle = '#16304f'
  ctx.beginPath()
  ctx.arc(-13, -1, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(13, -1, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 7.5, 2.5, 0, Math.PI * 2)
  ctx.fill()

  if (firing.left) drawFlame(ctx, -13, -1, -1, 0)
  if (firing.right) drawFlame(ctx, 13, -1, 1, 0)
  if (firing.down) drawFlame(ctx, 0, 7.5, 0, 1)

  ctx.restore()
}

function drawSatellite(ctx: CanvasRenderingContext2D, x: number, y: number, headingAngle: number, firing: { prograde: boolean; retrograde: boolean }) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(headingAngle)

  ctx.fillStyle = '#3fc9a2'
  ctx.strokeStyle = '#eafff6'
  ctx.lineWidth = 1
  ctx.fillRect(-4, -11, 10, 5)
  ctx.strokeRect(-4, -11, 10, 5)
  ctx.fillRect(-4, 6, 10, 5)
  ctx.strokeRect(-4, 6, 10, 5)

  ctx.fillStyle = '#6be9c7'
  ctx.lineWidth = 1.5
  roundedRect(ctx, -6, -6, 12, 12, 2)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(7, 0, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#2c3e5a'
  ctx.fill()
  ctx.strokeStyle = '#eafff6'
  ctx.stroke()

  // 프로그레이드(가속)는 뒤쪽에서 반대로, 레트로그레이드(감속)는 앞쪽에서 반대로 분사.
  if (firing.prograde) drawFlame(ctx, -6, 0, -1, 0)
  if (firing.retrograde) drawFlame(ctx, 7, 0, 1, 0)

  ctx.restore()
}

function drawPlanet(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number, img: HTMLImageElement | null) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.clip()
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, centerX - radius, centerY - radius, radius * 2, radius * 2)
  } else {
    ctx.fillStyle = '#6edcff'
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)
  }
  ctx.restore()
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

// x11 RGB hex(#rrggbb)만 받는다 - 밝기를 percent만큼 올리거나(+) 낮춘다(-).
function shade(hex: string, percent: number): string {
  const n = parseInt(hex.slice(1), 16)
  const amount = Math.round(2.55 * percent)
  const r = Math.min(255, Math.max(0, ((n >> 16) & 0xff) + amount))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount))
  return `rgb(${r}, ${g}, ${b})`
}

// 매 프레임 새로 뽑으면 지면이 깜빡이므로, 한 번 생성한 난수열을 attempt
// 내내 그대로 쓴다(mulberry32) - buildGroundTexture가 캔버스에 한 번만 구워
// 두므로 애초에 프레임마다 다시 부를 일도 없다.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 착륙 미니게임의 지면을 천체 표면처럼 보이게 한 번만 구워 두는 오프스크린
// 캔버스 - 매 프레임 drawImage로 붙여넣기만 하면 되므로 크레이터/모래 무늬가
// 프레임마다 다시 그려지며 깜빡이지 않는다.
function buildGroundTexture(width: number, height: number, kind: LandingSurfaceKind, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(Math.floor(Math.random() * 2 ** 31))

  if (kind === 'desert') {
    // 화성 - 붉은 사막 토양. 완만한 모래 둔덕을 암시하는 가로 줄무늬.
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = rand() < 0.5 ? shade(color, -16) : shade(color, 14)
      const y = rand() * height
      const w = 24 + rand() * 50
      ctx.beginPath()
      ctx.ellipse(rand() * width, y, w, 1.5 + rand() * 1.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 'hazy') {
    // 금성 - 표면이 짙은 대기에 가려진 모습. 지면 질감 대신 옅은 노란 안개
    // 띠를 겹겹이 그린다.
    const grad = ctx.createLinearGradient(0, 0, 0, height)
    grad.addColorStop(0, shade(color, 22))
    grad.addColorStop(1, shade(color, -22))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    for (let i = 0; i < 4; i++) {
      const baseY = ((i + 0.5) * height) / 4
      ctx.beginPath()
      for (let x = 0; x <= width; x += 16) {
        const y = baseY + Math.sin(x * 0.05 + i * 1.7) * 2
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  } else {
    // 달/수성 - 암석질 토양 + 크레이터(분화구). 테두리는 밝게, 안쪽은
    // 어둡게 칠해 패인 모양처럼 보이게 한다.
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)
    const craterColor = shade(color, -32)
    const rimColor = shade(color, 18)
    for (let i = 0; i < 18; i++) {
      const x = rand() * width
      const y = rand() * height
      const r = 1.3 + rand() * 2.6
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2)
      ctx.fillStyle = craterColor
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(x, y - r * 0.35, r * 0.55, r * 0.22, 0, 0, Math.PI * 2)
      ctx.fillStyle = rimColor
      ctx.fill()
    }
  }

  return canvas
}

const LANDING_PAD_HEIGHT = 6

function drawLanding(
  ctx: CanvasRenderingContext2D,
  state: LandingState,
  params: ReturnType<typeof landingParamsFor>,
  firing: { left: boolean; right: boolean; down: boolean },
  rotation: number,
  groundTexture: HTMLCanvasElement,
) {
  const { canvasWidth, canvasHeight, groundY, targetHalfWidth } = params
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  ctx.fillStyle = '#0d1c30'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  ctx.drawImage(groundTexture, 0, groundY)

  // 목표 착륙장 - 지면 위에 바로 그려 바닥과 같은 높이에 있는 것처럼 보이게 함.
  const targetCenter = canvasWidth / 2
  ctx.fillStyle = 'rgba(255, 181, 71, 0.55)'
  ctx.fillRect(targetCenter - targetHalfWidth, groundY, targetHalfWidth * 2, LANDING_PAD_HEIGHT)
  ctx.strokeStyle = 'rgba(255, 221, 161, 0.9)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(targetCenter - targetHalfWidth, groundY, targetHalfWidth * 2, LANDING_PAD_HEIGHT)

  drawRover(ctx, state.x, state.y, firing, rotation)
}

function drawOrbit(ctx: CanvasRenderingContext2D, state: OrbitState, params: ReturnType<typeof orbitParamsFor>, planetImg: HTMLImageElement | null, firing: { prograde: boolean; retrograde: boolean }) {
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

  drawPlanet(ctx, centerX, centerY, ORBIT_PLANET_RADIUS, planetImg)

  const shipX = centerX + state.x
  const shipY = centerY + state.y
  ctx.beginPath()
  ctx.moveTo(centerX, centerY)
  ctx.lineTo(shipX, shipY)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.stroke()

  const headingAngle = Math.atan2(state.vy, state.vx)
  drawSatellite(ctx, shipX, shipY, headingAngle, firing)
}

export function runApproachMinigame(kind: ApproachKind, tuning: ApproachTuning, visuals: ApproachVisuals = {}): Promise<ApproachResult> {
  active = true

  return new Promise((resolve) => {
    const { overlay, canvas, fuelFill, introPanel, startButton } = buildOverlay(kind)
    const ctx = canvas.getContext('2d')!
    const thrustLoop = createThrustLoop()
    let resolved = false
    let rafHandle = 0
    const heldKeys = new Set<string>()

    let planetImg: HTMLImageElement | null = null
    if (kind === 'orbit' && visuals.planetTextureFile) {
      planetImg = new Image()
      planetImg.src = `/textures/planets/${visuals.planetTextureFile}`
    }

    function finish(result: ApproachResult) {
      if (resolved) return
      resolved = true
      cancelAnimationFrame(rafHandle)
      thrustLoop.stop()
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

    startButton.addEventListener(
      'click',
      () => {
        introPanel.remove()
        if (kind === 'landing') startLanding()
        else startOrbit()
      },
      { once: true },
    )

    function startLanding() {
      const params = landingParamsFor(tuning)
      const startX = params.canvasWidth / 2 + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80)
      let state = initialLandingState(params, startX)
      let wasFalling = true
      let bounceSpinDir = 1
      let roverRotation = 0
      const groundTexture = buildGroundTexture(
        params.canvasWidth,
        params.canvasHeight - params.groundY,
        visuals.landingSurfaceKind ?? 'cratered',
        visuals.landingSurfaceColor ?? '#9a9a9a',
      )

      let lastTs = performance.now()
      const tick = (ts: number) => {
        const dtMs = Math.min(ts - lastTs, 100)
        lastTs = ts
        const keys = { left: heldKeys.has('ArrowLeft'), right: heldKeys.has('ArrowRight'), down: heldKeys.has('ArrowDown') }
        state = stepLanding(state, dtMs, keys, params)

        // 바닥에 닿은 뒤(튕기거나 멈추는 연출 중)에는 분사기 입력을 무시한다 -
        // 결과는 이미 확정됐고, 그 결과를 보여주는 연출만 남았기 때문.
        const falling = state.phase === 'falling'
        const thrusting = falling && (keys.left || keys.right || keys.down) && state.fuel > 0
        const firing = { left: thrusting && keys.left, right: thrusting && keys.right, down: thrusting && keys.down }
        thrustLoop.setActive(firing.left || firing.right || firing.down)

        if (state.phase === 'bouncing') {
          if (wasFalling) bounceSpinDir = Math.random() < 0.5 ? -1 : 1
          roverRotation += (dtMs / 1000) * 6 * bounceSpinDir
        }
        wasFalling = falling

        drawLanding(ctx, state, params, firing, roverRotation, groundTexture)
        fuelFill!.style.width = `${(state.fuel / params.maxFuel) * 100}%`

        const outcome = landingOutcome(state, params)
        if (outcome !== null) {
          finish(outcome)
          return
        }
        rafHandle = requestAnimationFrame(tick)
      }
      rafHandle = requestAnimationFrame(tick)
    }

    function startOrbit() {
      const params = orbitParamsFor(tuning)
      let state = initialOrbitState(params)

      let lastTs = performance.now()
      const tick = (ts: number) => {
        const dtMs = Math.min(ts - lastTs, 100)
        lastTs = ts
        const keys = { up: heldKeys.has('ArrowUp'), down: heldKeys.has('ArrowDown') }
        state = stepOrbit(state, dtMs, keys, params)
        const firing = { prograde: keys.up && !keys.down, retrograde: keys.down && !keys.up }
        thrustLoop.setActive(firing.prograde || firing.retrograde)
        drawOrbit(ctx, state, params, planetImg, firing)

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
