export type ApproachKind = 'landing' | 'orbit'

// 착륙 미니게임의 지면 질감 - 암석형 천체마다 다른 모습으로 그리는 데 쓰임.
export type LandingSurfaceKind = 'cratered' | 'desert' | 'hazy'

export type ApproachFailureReason = 'off-target' | 'overspeed' | 'out-of-fuel' | 'crashed' | 'escaped'

export type ApproachResult = { success: true } | { success: false; reason: ApproachFailureReason }

export interface ApproachTuning {
  baseEasiness: number // 0-0.95, 대상의 기본 난이도(장비 없이) - 높을수록 쉬움
  fuelBonus: number // 탐사선 단계 + 부스터/생명유지 모듈에서 나오는 연료 보너스 합
  toleranceBonus: number // 정밀 관측 장비에서 나오는 목표 범위 보너스
}

function clampEasiness(easiness: number): number {
  return Math.min(0.95, Math.max(0, easiness))
}

// --- 착륙 (암석형 천체) ---
//
// 분사기는 로버 측면/아래에 달려 있으므로 분사 방향과 힘의 방향은 반대: 왼쪽
// 분사기가 가스를 뿜으면(←) 그 반작용으로 배는 오른쪽으로 밀리고, 오른쪽
// 분사기(→)는 왼쪽으로, 아래쪽 분사기(↓)는 위로 밀어 중력에 맞서 속도를 줄인다.

export interface LandingParams {
  canvasWidth: number
  canvasHeight: number
  groundY: number
  gravity: number
  verticalThrust: number
  lateralThrust: number
  safeLandingSpeed: number
  targetHalfWidth: number
  maxFuel: number
  timeLimitMs: number
}

// 바닥에 닿는 순간 성공/실패가 바로 끝나버리면 플레이어가 착지/충돌 장면을
// 볼 수 없으므로, 세 단계로 나눈다: 'falling'(하강) → 바닥에 닿는 순간
// 그 속도/위치로 결과(verdict)를 확정하고 → 안전 속도였으면 'settling'(그
// 자리에 부드럽게 멈춰서는 연출), 너무 빨랐으면 'bouncing'(튕겨 나가다가
// 에너지를 잃고 'settling'으로 전환)으로 들어간다. landingOutcome은
// 'settling' 연출이 다 끝난 뒤에야 확정된 verdict를 돌려준다.
export type LandingPhase = 'falling' | 'bouncing' | 'settling'

export interface LandingState {
  x: number
  y: number
  vx: number
  vy: number
  fuel: number
  elapsedMs: number
  phase: LandingPhase
  verdict: ApproachResult | null // phase가 'falling'을 벗어나는 순간 확정되고 이후 바뀌지 않음
  settleMs: number // 'settling' 단계에 들어온 뒤 경과 시간 - 연출 길이를 잼
}

export interface LandingKeys {
  left: boolean // 왼쪽 분사기 분사 - 오른쪽으로 밀림
  right: boolean // 오른쪽 분사기 분사 - 왼쪽으로 밀림
  down: boolean // 아래쪽 분사기 분사 - 위로 밀려 브레이크
}

export const LANDING_CANVAS_WIDTH = 400
export const LANDING_CANVAS_HEIGHT = 300
export const LANDING_GROUND_Y = 280
export const LANDING_START_Y = 20
export const LANDING_VERTICAL_THRUST = 150
export const LANDING_LATERAL_THRUST = 80
export const LANDING_TIME_LIMIT_MS = 15000
export const LANDING_BOUNCE_RESTITUTION = 0.4 // 튕길 때마다 속도의 이 비율만 남김
export const LANDING_BOUNCE_FRICTION = 0.6 // 튕길 때 수평 속도도 함께 깎임
export const LANDING_BOUNCE_REST_SPEED = 25 // 이 속도 밑으로 튕기면 더 안 튕기고 멈춘 것으로 침
export const LANDING_SETTLE_DECEL = 300 // 착지 후 바닥 마찰로 수평 속도가 줄어드는 가속도
export const LANDING_SETTLE_MS = 500 // 정지/충돌 연출을 보여주는 시간

export function landingParamsFor(tuning: ApproachTuning): LandingParams {
  const e = clampEasiness(tuning.baseEasiness)
  return {
    canvasWidth: LANDING_CANVAS_WIDTH,
    canvasHeight: LANDING_CANVAS_HEIGHT,
    groundY: LANDING_GROUND_Y,
    gravity: 90 - e * 42,
    verticalThrust: LANDING_VERTICAL_THRUST,
    lateralThrust: LANDING_LATERAL_THRUST,
    safeLandingSpeed: 40 + e * 40,
    targetHalfWidth: 25 + e * 20 + tuning.toleranceBonus,
    maxFuel: 7 + e * 5 + tuning.fuelBonus,
    timeLimitMs: LANDING_TIME_LIMIT_MS,
  }
}

export function initialLandingState(params: LandingParams, startX: number): LandingState {
  return { x: startX, y: LANDING_START_Y, vx: 0, vy: 0, fuel: params.maxFuel, elapsedMs: 0, phase: 'falling', verdict: null, settleMs: 0 }
}

// 바닥에 닿는 그 순간의 속도/위치만으로 성공/실패를 한 번 확정한다 - 이후
// 튕기거나 멈추는 연출은 이 verdict를 바꾸지 않는다.
function contactVerdict(x: number, vx: number, vy: number, params: LandingParams): ApproachResult {
  const speed = Math.sqrt(vx * vx + vy * vy)
  if (speed > params.safeLandingSpeed) return { success: false, reason: 'overspeed' }
  const targetCenter = params.canvasWidth / 2
  if (Math.abs(x - targetCenter) > params.targetHalfWidth) return { success: false, reason: 'off-target' }
  return { success: true }
}

function stepLandingFalling(state: LandingState, dtMs: number, keys: LandingKeys, params: LandingParams): LandingState {
  const dtSec = dtMs / 1000
  const thrusting = (keys.left || keys.right || keys.down) && state.fuel > 0

  let vy = state.vy + params.gravity * dtSec
  if (thrusting && keys.down) vy -= params.verticalThrust * dtSec

  let vx = state.vx
  if (thrusting && keys.left) vx += params.lateralThrust * dtSec
  if (thrusting && keys.right) vx -= params.lateralThrust * dtSec

  let x = state.x + vx * dtSec
  if (x < 0) {
    x = 0
    vx = 0
  }
  if (x > params.canvasWidth) {
    x = params.canvasWidth
    vx = 0
  }

  let y = state.y + vy * dtSec
  if (y < 0) {
    y = 0
    vy = 0
  }

  const fuel = thrusting ? Math.max(0, state.fuel - dtSec) : state.fuel
  const elapsedMs = state.elapsedMs + dtMs

  if (y < params.groundY) {
    return { x, y, vx, vy, fuel, elapsedMs, phase: 'falling', verdict: null, settleMs: 0 }
  }

  // 바닥 접촉: 그 순간의 속도/위치로 결과를 확정한다. 안전 속도였다면 그
  // 자리에 그대로 멈춰 서는 연출(settling)로, 너무 빨랐다면 튕겨 나가는
  // 연출(bouncing)로 들어간다.
  const verdict = contactVerdict(x, vx, vy, params)
  if (!verdict.success && verdict.reason === 'overspeed') {
    return { x, y: params.groundY, vx, vy, fuel, elapsedMs, phase: 'bouncing', verdict, settleMs: 0 }
  }
  return { x, y: params.groundY, vx, vy: 0, fuel, elapsedMs, phase: 'settling', verdict, settleMs: 0 }
}

function stepLandingBouncing(state: LandingState, dtMs: number, params: LandingParams): LandingState {
  const dtSec = dtMs / 1000
  const elapsedMs = state.elapsedMs + dtMs

  let vy = state.vy + params.gravity * dtSec
  let vx = state.vx

  let x = state.x + vx * dtSec
  if (x < 0) {
    x = 0
    vx = 0
  }
  if (x > params.canvasWidth) {
    x = params.canvasWidth
    vx = 0
  }

  let y = state.y + vy * dtSec
  if (y < 0) {
    y = 0
    vy = 0
  }

  if (y >= params.groundY) {
    y = params.groundY
    vy = -vy * LANDING_BOUNCE_RESTITUTION
    vx = vx * LANDING_BOUNCE_FRICTION
    const speed = Math.sqrt(vx * vx + vy * vy)
    if (speed < LANDING_BOUNCE_REST_SPEED) {
      return { x, y, vx: 0, vy: 0, fuel: state.fuel, elapsedMs, phase: 'settling', verdict: state.verdict, settleMs: 0 }
    }
  }

  return { x, y, vx, vy, fuel: state.fuel, elapsedMs, phase: 'bouncing', verdict: state.verdict, settleMs: 0 }
}

function stepLandingSettling(state: LandingState, dtMs: number): LandingState {
  const dtSec = dtMs / 1000
  let vx = state.vx
  if (vx > 0) vx = Math.max(0, vx - LANDING_SETTLE_DECEL * dtSec)
  else if (vx < 0) vx = Math.min(0, vx + LANDING_SETTLE_DECEL * dtSec)
  const x = state.x + vx * dtSec

  return { ...state, x, vx, vy: 0, elapsedMs: state.elapsedMs + dtMs, settleMs: state.settleMs + dtMs }
}

export function stepLanding(state: LandingState, dtMs: number, keys: LandingKeys, params: LandingParams): LandingState {
  if (state.phase === 'falling') return stepLandingFalling(state, dtMs, keys, params)
  if (state.phase === 'bouncing') return stepLandingBouncing(state, dtMs, params)
  return stepLandingSettling(state, dtMs)
}

export function landingOutcome(state: LandingState, params: LandingParams): ApproachResult | null {
  if (state.phase === 'settling') return state.settleMs >= LANDING_SETTLE_MS ? state.verdict : null
  if (state.phase === 'falling' && state.elapsedMs >= params.timeLimitMs) return { success: false, reason: 'out-of-fuel' }
  return null
}

// --- 궤도 진입 (가스/얼음 거대행성) ---
//
// 반경을 직접 조작하는 추상화 대신, 탐사선의 위치/속도와 행성 중력(역제곱
// 법칙)을 그대로 적분하는 2체 문제로 시뮬레이션한다. ↑(프로그레이드)는 속도
// 벡터 방향으로, ↓(레트로그레이드)는 그 반대 방향으로 가속해 속도를 늘리거나
// 줄인다 - 분사 직후 한 프레임만 보면 물리적으로 정확한 타원 궤도 운동 그
// 자체지만(중력만 받는 진짜 2체 적분), 매 프레임 속도의 반경 방향 성분만
// 지수적으로(radialDamping의 속도로, 순간이동이 아니라 몇 초에 걸쳐 "자연
// 스럽게") 접선 방향(원운동) 성분 쪽으로 줄인다. 같은 위치를 기준으로 접선
// 성분은 그대로 두고 반경 성분만 깎으므로 각운동량(L = x*vy - y*vx)은 정확히
// 보존되고, 그래서 이 보정이 자리 잡는 원 궤도의 반경은 항상 분사로 만든
// 각운동량(= 그 속도)에 정확히 대응하는 값이 된다. 연료도 시간 제한도 없다 -
// 마음껏 분사해 가며 천천히 궤도를 맞추면 된다. 실패는 둘 중 하나뿐이다:
// 속도를 너무 많이 올려 반경이 maxRadius를 넘어 화면 밖으로 날아가거나
// (escaped), 속도를 너무 줄여 반경이 crashRadius 밑으로 떨어져 행성과
// 충돌하거나(crashed). 그 사이에서는 몇 번을 더 시도하든 계속 떠 있을 수
// 있다. 목표 범위는 좁게 잡았고, 그 안에서 반경이 안정된(radial speed가
// 낮은) 상태를 holdDurationMs(대략 목표 궤도 한 바퀴 분량) 동안 *연속으로*
// 유지해야 성공한다.

export interface OrbitParams {
  gm: number // 중력 매개변수(GM) - 목표 반경에서의 원운동 속도를 기준으로 고정된 상수
  targetRadius: number
  targetHalfWidth: number
  startRadiusGap: number
  crashRadius: number
  maxRadius: number // 캔버스 밖으로 나가지 않도록 반경 상한을 둠 - DOM 쪽 ORBIT_CANVAS_SIZE/2보다 여유 있게 작아야 함
  thrustAccel: number
  radialDamping: number // 속도의 반경 방향 성분을 접선 방향으로 줄여나가는 속도(1/s) - 클수록 더 빨리 원 궤도로 둥글어짐
  stableRadialSpeedThreshold: number
  holdDurationMs: number // 목표 범위 안에서 안정된 상태를 이만큼 연속으로 유지해야 성공
}

export interface OrbitState {
  x: number
  y: number
  vx: number
  vy: number
  holdMs: number // 목표 범위 안에서 반경이 안정된 채로 연속으로 유지된 시간 - 조건이 깨지면 0으로 리셋
}

export interface OrbitKeys {
  up: boolean // 프로그레이드 분사 - 속도 증가
  down: boolean // 레트로그레이드 분사 - 속도 감소
}

export const ORBIT_TARGET_RADIUS = 90
export const ORBIT_CRASH_RADIUS = 40
export const ORBIT_MAX_RADIUS = 140
export const ORBIT_CIRCULAR_SPEED_AT_TARGET = 120 // px/s - 목표 반경에서 원운동하는 데 필요한 속도
export const ORBIT_GM = ORBIT_CIRCULAR_SPEED_AT_TARGET * ORBIT_CIRCULAR_SPEED_AT_TARGET * ORBIT_TARGET_RADIUS
export const ORBIT_THRUST_ACCEL = 18
export const ORBIT_RADIAL_DAMPING = 1.5
export const ORBIT_STABLE_RADIAL_SPEED_THRESHOLD = 6
// 목표 반경에서 원 궤도를 한 바퀴 도는 데 걸리는 시간 - "궤도를 한 바퀴 돌
// 때까지 유지"를 물리적으로 근거 있는 값으로 삼는다.
export const ORBIT_HOLD_MS = Math.round(((2 * Math.PI * ORBIT_TARGET_RADIUS) / ORBIT_CIRCULAR_SPEED_AT_TARGET) * 1000)

export function orbitParamsFor(tuning: ApproachTuning): OrbitParams {
  const e = clampEasiness(tuning.baseEasiness)
  return {
    gm: ORBIT_GM,
    targetRadius: ORBIT_TARGET_RADIUS,
    targetHalfWidth: 5 + e * 7.5 + tuning.toleranceBonus,
    startRadiusGap: 50 - e * 20,
    crashRadius: ORBIT_CRASH_RADIUS,
    maxRadius: ORBIT_MAX_RADIUS,
    thrustAccel: ORBIT_THRUST_ACCEL,
    radialDamping: ORBIT_RADIAL_DAMPING,
    stableRadialSpeedThreshold: ORBIT_STABLE_RADIAL_SPEED_THRESHOLD,
    holdDurationMs: ORBIT_HOLD_MS,
  }
}

// 시작 지점에 행성 중력과 정확히 균형을 이루는 원운동 속도를 실어, 플레이어가
// 손을 대지 않으면 (목표 반경이 아닌) 안정된 원 궤도를 그대로 유지하게 한다.
export function initialOrbitState(params: OrbitParams): OrbitState {
  const r0 = params.targetRadius + params.startRadiusGap
  const v0 = Math.sqrt(params.gm / r0)
  return { x: r0, y: 0, vx: 0, vy: v0, holdMs: 0 }
}

export function stepOrbit(state: OrbitState, dtMs: number, keys: OrbitKeys, params: OrbitParams): OrbitState {
  const dtSec = dtMs / 1000

  const r = Math.sqrt(state.x * state.x + state.y * state.y)
  const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy)

  const ax = r > 0 ? (-params.gm * state.x) / (r * r * r) : 0
  const ay = r > 0 ? (-params.gm * state.y) / (r * r * r) : 0

  let thrustSign = 0
  if (keys.up && !keys.down) thrustSign = 1
  else if (keys.down && !keys.up) thrustSign = -1
  let thrustAx = 0
  let thrustAy = 0
  if (thrustSign !== 0 && speed > 0) {
    thrustAx = (thrustSign * params.thrustAccel * state.vx) / speed
    thrustAy = (thrustSign * params.thrustAccel * state.vy) / speed
  }

  // 심플렉틱(세미-암시적) 오일러: 가속도로 속도를 먼저 갱신하고, 그 새
  // 속도로 위치를 갱신해야 궤도 에너지가 발산하지 않고 안정적으로 돈다. 이
  // 시점의 (x,y,vx,vy)는 물리적으로 정확한 타원 궤도 운동 그 자체다.
  let vx = state.vx + (ax + thrustAx) * dtSec
  let vy = state.vy + (ay + thrustAy) * dtSec
  const x = state.x + vx * dtSec
  const y = state.y + vy * dtSec

  // 반경 방향 속도 성분만 지수적으로 줄인다(접선 방향 성분은 그대로 둔다) -
  // 같은 위치(x,y)를 기준으로 접선 성분만 남기고 반경 성분만 깎으므로 각
  // 운동량(L = x*vy - y*vx)은 수학적으로 정확히 보존된다. 따라서 이 감쇠가
  // 자리 잡는 원 궤도의 반경은 항상 "그 속도(각운동량)에 해당하는" 값이다.
  const newR = Math.sqrt(x * x + y * y)
  if (newR > 0) {
    const L = x * vy - y * vx
    // (x,y) 위치에서 각운동량 L을 내는 순수 접선(원운동) 속도 - 반경 방향
    // 성분은 0이다.
    const tangentialVx = (-L * y) / (newR * newR)
    const tangentialVy = (L * x) / (newR * newR)
    const pull = 1 - Math.exp(-params.radialDamping * dtSec)
    vx += (tangentialVx - vx) * pull
    vy += (tangentialVy - vy) * pull
  }

  const radialSpeed = newR > 0 ? (x * vx + y * vy) / newR : 0
  const withinBand = Math.abs(newR - params.targetRadius) <= params.targetHalfWidth
  const stabilized = Math.abs(radialSpeed) <= params.stableRadialSpeedThreshold
  const holdMs = withinBand && stabilized ? state.holdMs + dtMs : 0

  return { x, y, vx, vy, holdMs }
}

export function orbitOutcome(state: OrbitState, params: OrbitParams): ApproachResult | null {
  const r = Math.sqrt(state.x * state.x + state.y * state.y)
  if (r <= params.crashRadius) return { success: false, reason: 'crashed' }
  if (r >= params.maxRadius) return { success: false, reason: 'escaped' }
  if (state.holdMs >= params.holdDurationMs) return { success: true }
  return null
}
