export type ApproachKind = 'landing' | 'orbit'

export type ApproachFailureReason = 'off-target' | 'overspeed' | 'out-of-fuel' | 'crashed'

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

export interface LandingState {
  x: number
  y: number
  vx: number
  vy: number
  fuel: number
  elapsedMs: number
}

export interface LandingKeys {
  up: boolean
  left: boolean
  right: boolean
}

export const LANDING_CANVAS_WIDTH = 400
export const LANDING_CANVAS_HEIGHT = 300
export const LANDING_GROUND_Y = 280
export const LANDING_START_Y = 20
export const LANDING_VERTICAL_THRUST = 150
export const LANDING_LATERAL_THRUST = 80
export const LANDING_TIME_LIMIT_MS = 15000

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
    maxFuel: 60 + e * 40 + tuning.fuelBonus,
    timeLimitMs: LANDING_TIME_LIMIT_MS,
  }
}

export function initialLandingState(params: LandingParams, startX: number): LandingState {
  return { x: startX, y: LANDING_START_Y, vx: 0, vy: 0, fuel: params.maxFuel, elapsedMs: 0 }
}

export function stepLanding(state: LandingState, dtMs: number, keys: LandingKeys, params: LandingParams): LandingState {
  const dtSec = dtMs / 1000
  const thrusting = (keys.up || keys.left || keys.right) && state.fuel > 0

  let vy = state.vy + params.gravity * dtSec
  if (thrusting && keys.up) vy -= params.verticalThrust * dtSec

  let vx = state.vx
  if (thrusting && keys.left) vx -= params.lateralThrust * dtSec
  if (thrusting && keys.right) vx += params.lateralThrust * dtSec

  let x = state.x + vx * dtSec
  if (x < 0) {
    x = 0
    vx = 0
  }
  if (x > params.canvasWidth) {
    x = params.canvasWidth
    vx = 0
  }

  const y = state.y + vy * dtSec
  const fuel = thrusting ? Math.max(0, state.fuel - dtSec) : state.fuel

  return { x, y, vx, vy, fuel, elapsedMs: state.elapsedMs + dtMs }
}

export function landingOutcome(state: LandingState, params: LandingParams): ApproachResult | null {
  if (state.y >= params.groundY) {
    const targetCenter = params.canvasWidth / 2
    if (Math.abs(state.x - targetCenter) > params.targetHalfWidth) return { success: false, reason: 'off-target' }
    const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy)
    if (speed > params.safeLandingSpeed) return { success: false, reason: 'overspeed' }
    return { success: true }
  }
  if (state.elapsedMs >= params.timeLimitMs) return { success: false, reason: 'out-of-fuel' }
  return null
}

// --- 궤도 진입 (가스/얼음 거대행성) ---

export interface OrbitParams {
  targetRadius: number
  targetHalfWidth: number
  startRadiusGap: number
  crashRadius: number
  radialThrust: number
  stableSpeedThreshold: number
  maxFuel: number
  timeLimitMs: number
}

export interface OrbitState {
  radius: number
  radialSpeed: number
  fuel: number
  elapsedMs: number
}

export interface OrbitKeys {
  up: boolean
  down: boolean
}

export const ORBIT_TARGET_RADIUS = 90
export const ORBIT_CRASH_RADIUS = 40
export const ORBIT_RADIAL_THRUST = 25
export const ORBIT_STABLE_SPEED_THRESHOLD = 6
export const ORBIT_TIME_LIMIT_MS = 15000

export function orbitParamsFor(tuning: ApproachTuning): OrbitParams {
  const e = clampEasiness(tuning.baseEasiness)
  return {
    targetRadius: ORBIT_TARGET_RADIUS,
    targetHalfWidth: 10 + e * 15 + tuning.toleranceBonus,
    startRadiusGap: 80 - e * 38,
    crashRadius: ORBIT_CRASH_RADIUS,
    radialThrust: ORBIT_RADIAL_THRUST,
    stableSpeedThreshold: ORBIT_STABLE_SPEED_THRESHOLD,
    maxFuel: 50 + e * 30 + tuning.fuelBonus,
    timeLimitMs: ORBIT_TIME_LIMIT_MS,
  }
}

export function initialOrbitState(params: OrbitParams): OrbitState {
  return { radius: params.targetRadius + params.startRadiusGap, radialSpeed: 0, fuel: params.maxFuel, elapsedMs: 0 }
}

export function stepOrbit(state: OrbitState, dtMs: number, keys: OrbitKeys, params: OrbitParams): OrbitState {
  const dtSec = dtMs / 1000
  const thrusting = (keys.up || keys.down) && state.fuel > 0

  let radialSpeed = state.radialSpeed
  if (thrusting && keys.up) radialSpeed += params.radialThrust * dtSec
  if (thrusting && keys.down) radialSpeed -= params.radialThrust * dtSec

  const radius = Math.max(0, state.radius + radialSpeed * dtSec)
  const fuel = thrusting ? Math.max(0, state.fuel - dtSec) : state.fuel

  return { radius, radialSpeed, fuel, elapsedMs: state.elapsedMs + dtMs }
}

export function orbitOutcome(state: OrbitState, params: OrbitParams): ApproachResult | null {
  if (state.radius <= params.crashRadius) return { success: false, reason: 'crashed' }

  const withinBand = Math.abs(state.radius - params.targetRadius) <= params.targetHalfWidth
  const stabilized = Math.abs(state.radialSpeed) <= params.stableSpeedThreshold
  if (withinBand && stabilized) return { success: true }

  if (state.elapsedMs >= params.timeLimitMs) return { success: false, reason: 'out-of-fuel' }
  return null
}
