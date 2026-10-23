import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  landingParamsForEasiness,
  initialLandingState,
  stepLanding,
  landingOutcome,
  orbitParamsForEasiness,
  needlePosition,
  orbitPressOutcome,
  orbitTimeoutResult,
} from './approach-minigame-sim.ts'

test('initialLandingState starts at the params startAltitude with zero speed and elapsed time', () => {
  const params = landingParamsForEasiness(0)
  const state = initialLandingState(params)
  assert.deepEqual(state, { altitude: params.startAltitude, speed: 0, elapsedMs: 0 })
})

test('stepLanding applies gravity when thrust is not held', () => {
  const params = landingParamsForEasiness(0) // gravity 40, safeSpeed 10
  const state = { altitude: 100, speed: 0, elapsedMs: 0 }
  const next = stepLanding(state, 1000, false, { ...params, gravity: 20 })
  assert.equal(next.speed, 20)
  assert.equal(next.altitude, 80)
  assert.equal(next.elapsedMs, 1000)
})

test('stepLanding decelerates net when thrust is held and thrust > gravity', () => {
  const params = { gravity: 20, thrust: 32, safeSpeed: 10, startAltitude: 100, timeLimitMs: 8000 }
  const state = { altitude: 80, speed: 20, elapsedMs: 1000 }
  const next = stepLanding(state, 500, true, params)
  assert.equal(next.speed, 14)
  assert.equal(next.altitude, 73)
  assert.equal(next.elapsedMs, 1500)
})

test('landingOutcome succeeds when touchdown speed is within safeSpeed', () => {
  const params = { gravity: 20, thrust: 32, safeSpeed: 10, startAltitude: 100, timeLimitMs: 8000 }
  const result = landingOutcome({ altitude: 0, speed: 8, elapsedMs: 3000 }, params)
  assert.deepEqual(result, { success: true })
})

test('landingOutcome fails with overspeed when touchdown speed exceeds safeSpeed', () => {
  const params = { gravity: 20, thrust: 32, safeSpeed: 10, startAltitude: 100, timeLimitMs: 8000 }
  const result = landingOutcome({ altitude: 0, speed: 15, elapsedMs: 3000 }, params)
  assert.deepEqual(result, { success: false, reason: 'overspeed' })
})

test('landingOutcome fails with out-of-fuel when the time limit is reached before touchdown', () => {
  const params = { gravity: 20, thrust: 32, safeSpeed: 10, startAltitude: 100, timeLimitMs: 8000 }
  const result = landingOutcome({ altitude: 5, speed: 3, elapsedMs: 8000 }, params)
  assert.deepEqual(result, { success: false, reason: 'out-of-fuel' })
})

test('landingOutcome returns null while still in progress', () => {
  const params = { gravity: 20, thrust: 32, safeSpeed: 10, startAltitude: 100, timeLimitMs: 8000 }
  const result = landingOutcome({ altitude: 50, speed: 5, elapsedMs: 2000 }, params)
  assert.equal(result, null)
})

test('landingParamsForEasiness pins the hardest and easiest values', () => {
  const hardest = landingParamsForEasiness(0)
  assert.equal(hardest.gravity, 40)
  assert.equal(hardest.safeSpeed, 10)
  const easiest = landingParamsForEasiness(0.95)
  assert.ok(Math.abs(easiest.gravity - 19.1) < 1e-9)
  assert.ok(Math.abs(easiest.safeSpeed - 24.25) < 1e-9)
})

test('needlePosition sweeps 0 to 100 and back', () => {
  const params = { zoneWidth: 20, needleSpeed: 50, timeLimitMs: 8000 }
  assert.equal(needlePosition(0, params), 0)
  assert.equal(needlePosition(1000, params), 50)
  assert.equal(needlePosition(2500, params), 75)
})

test('orbitPressOutcome succeeds inside the safe zone', () => {
  const params = { zoneWidth: 20, needleSpeed: 50, timeLimitMs: 8000 } // zone 40-60
  assert.deepEqual(orbitPressOutcome(1000, params), { success: true })
})

test('orbitPressOutcome fails too-early before the safe zone', () => {
  const params = { zoneWidth: 20, needleSpeed: 50, timeLimitMs: 8000 }
  assert.deepEqual(orbitPressOutcome(200, params), { success: false, reason: 'too-early' })
})

test('orbitPressOutcome fails too-late after the safe zone', () => {
  const params = { zoneWidth: 20, needleSpeed: 50, timeLimitMs: 8000 }
  assert.deepEqual(orbitPressOutcome(1500, params), { success: false, reason: 'too-late' })
})

test('orbitPressOutcome fails too-early on the return sweep when the needle has not reached the zone yet', () => {
  const params = { zoneWidth: 20, needleSpeed: 50, timeLimitMs: 8000 } // zone 40-60
  // distance 120 -> cycle 120 -> position 80 (needle descending from 100, hasn't reached the zone)
  assert.deepEqual(orbitPressOutcome(2400, params), { success: false, reason: 'too-early' })
})

test('orbitPressOutcome fails too-late on the return sweep after the needle has already passed the zone', () => {
  const params = { zoneWidth: 20, needleSpeed: 50, timeLimitMs: 8000 } // zone 40-60
  // distance 170 -> cycle 170 -> position 30 (needle already descended past the zone)
  assert.deepEqual(orbitPressOutcome(3400, params), { success: false, reason: 'too-late' })
})

test('orbitParamsForEasiness pins the hardest and easiest values', () => {
  const hardest = orbitParamsForEasiness(0)
  assert.equal(hardest.zoneWidth, 14)
  assert.equal(hardest.needleSpeed, 70)
  const easiest = orbitParamsForEasiness(0.95)
  assert.ok(Math.abs(easiest.zoneWidth - 38.7) < 1e-9)
  assert.ok(Math.abs(easiest.needleSpeed - 51) < 1e-9)
})

test('orbitTimeoutResult reports a timeout failure', () => {
  assert.deepEqual(orbitTimeoutResult(), { success: false, reason: 'timeout' })
})
