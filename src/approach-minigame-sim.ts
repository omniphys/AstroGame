export type ApproachKind = 'landing' | 'orbit'

export type ApproachFailureReason = 'overspeed' | 'out-of-fuel' | 'too-early' | 'too-late' | 'timeout'

export type ApproachResult = { success: true } | { success: false; reason: ApproachFailureReason }

function clampEasiness(easiness: number): number {
  return Math.min(0.95, Math.max(0, easiness))
}

// --- 착륙 (암석형 천체) ---

export interface LandingParams {
  gravity: number
  thrust: number
  safeSpeed: number
  startAltitude: number
  timeLimitMs: number
}

export interface LandingState {
  altitude: number
  speed: number
  elapsedMs: number
}

export const LANDING_THRUST = 32
export const LANDING_START_ALTITUDE = 100
export const LANDING_TIME_LIMIT_MS = 8000

export function landingParamsForEasiness(easiness: number): LandingParams {
  const e = clampEasiness(easiness)
  return {
    gravity: 18 + (1 - e) * 22,
    thrust: LANDING_THRUST,
    safeSpeed: 10 + e * 15,
    startAltitude: LANDING_START_ALTITUDE,
    timeLimitMs: LANDING_TIME_LIMIT_MS,
  }
}

export function initialLandingState(params: LandingParams): LandingState {
  return { altitude: params.startAltitude, speed: 0, elapsedMs: 0 }
}

export function stepLanding(state: LandingState, dtMs: number, thrustHeld: boolean, params: LandingParams): LandingState {
  const dtSec = dtMs / 1000
  const accel = thrustHeld ? params.gravity - params.thrust : params.gravity
  const speed = Math.max(0, state.speed + accel * dtSec)
  const altitude = Math.max(0, state.altitude - speed * dtSec)
  return { altitude, speed, elapsedMs: state.elapsedMs + dtMs }
}

export function landingOutcome(state: LandingState, params: LandingParams): ApproachResult | null {
  if (state.altitude <= 0) {
    return state.speed <= params.safeSpeed ? { success: true } : { success: false, reason: 'overspeed' }
  }
  if (state.elapsedMs >= params.timeLimitMs) return { success: false, reason: 'out-of-fuel' }
  return null
}

// --- 궤도 진입 (가스/얼음 거대행성) ---

export interface OrbitParams {
  zoneWidth: number
  needleSpeed: number
  timeLimitMs: number
}

export const ORBIT_ZONE_CENTER = 50
export const ORBIT_TIME_LIMIT_MS = 8000

export function orbitParamsForEasiness(easiness: number): OrbitParams {
  const e = clampEasiness(easiness)
  return {
    zoneWidth: 14 + e * 26,
    needleSpeed: 70 - e * 20,
    timeLimitMs: ORBIT_TIME_LIMIT_MS,
  }
}

export function needlePosition(elapsedMs: number, params: OrbitParams): number {
  const distance = (elapsedMs / 1000) * params.needleSpeed
  const cycle = distance % 200
  return cycle <= 100 ? cycle : 200 - cycle
}

export function orbitPressOutcome(elapsedMs: number, params: OrbitParams): ApproachResult {
  const position = needlePosition(elapsedMs, params)
  const zoneStart = ORBIT_ZONE_CENTER - params.zoneWidth / 2
  const zoneEnd = ORBIT_ZONE_CENTER + params.zoneWidth / 2
  if (position >= zoneStart && position <= zoneEnd) return { success: true }

  // 바늘은 0→100→0으로 왕복하므로, 복귀 구간(100→0)에서는 "구간보다 왼쪽"이
  // 곧 "아직 안 옴"이 아니라 "이미 지나감"이 된다 - 위치만으로는 판단할 수
  // 없고 진행 방향이 필요함.
  const distance = (elapsedMs / 1000) * params.needleSpeed
  const movingRight = distance % 200 <= 100
  const beforeZone = movingRight ? position < zoneStart : position > zoneEnd
  return beforeZone ? { success: false, reason: 'too-early' } : { success: false, reason: 'too-late' }
}

export function orbitTimeoutResult(): ApproachResult {
  return { success: false, reason: 'timeout' }
}
