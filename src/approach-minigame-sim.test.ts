import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  landingParamsFor,
  initialLandingState,
  stepLanding,
  landingOutcome,
  orbitParamsFor,
  initialOrbitState,
  stepOrbit,
  orbitOutcome,
} from './approach-minigame-sim.ts'

// --- 착륙 ---

test('stepLanding applies gravity with no keys held, x unchanged, fuel unchanged', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 20, vx: 0, vy: 0, fuel: 50, elapsedMs: 0 }
  const next = stepLanding(state, 1000, { up: false, left: false, right: false }, params)
  assert.equal(next.vy, 60)
  assert.equal(next.y, 80)
  assert.equal(next.x, 200)
  assert.equal(next.fuel, 50)
  assert.equal(next.elapsedMs, 1000)
})

test('stepLanding brakes when up is held', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 80, vx: 0, vy: 60, fuel: 50, elapsedMs: 1000 }
  const next = stepLanding(state, 500, { up: true, left: false, right: false }, params)
  assert.equal(next.vy, 15)
  assert.equal(next.y, 87.5)
  assert.equal(next.fuel, 49.5)
  assert.equal(next.elapsedMs, 1500)
})

test('stepLanding pushes left and drains fuel when left is held', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 50, vx: 0, vy: 20, fuel: 50, elapsedMs: 0 }
  const next = stepLanding(state, 1000, { up: false, left: true, right: false }, params)
  assert.equal(next.vy, 80)
  assert.equal(next.vx, -80)
  assert.equal(next.x, 120)
  assert.equal(next.fuel, 49)
})

test('stepLanding holding multiple keys at once drains fuel the same as holding one', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 50, vx: 0, vy: 20, fuel: 50, elapsedMs: 0 }
  const next = stepLanding(state, 1000, { up: true, left: true, right: false }, params)
  assert.equal(next.fuel, 49)
})

test('stepLanding clamps x at the left edge and zeroes vx', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 10, y: 50, vx: -50, vy: 0, fuel: 50, elapsedMs: 0 }
  const next = stepLanding(state, 1000, { up: false, left: false, right: false }, params)
  assert.equal(next.x, 0)
  assert.equal(next.vx, 0)
})

test('stepLanding clamps x at the right edge and zeroes vx', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 390, y: 50, vx: 50, vy: 0, fuel: 50, elapsedMs: 0 }
  const next = stepLanding(state, 1000, { up: false, left: false, right: false }, params)
  assert.equal(next.x, 400)
  assert.equal(next.vx, 0)
})

test('stepLanding never drains fuel below zero', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 50, vx: 0, vy: 0, fuel: 0.3, elapsedMs: 0 }
  const next = stepLanding(state, 1000, { up: true, left: false, right: false }, params)
  assert.equal(next.fuel, 0)
})

test('landingOutcome succeeds within the target band and under the safe speed', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const result = landingOutcome({ x: 210, y: 280, vx: 10, vy: 20, fuel: 10, elapsedMs: 5000 }, params)
  assert.deepEqual(result, { success: true })
})

test('landingOutcome fails off-target when outside the landing pad', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const result = landingOutcome({ x: 260, y: 280, vx: 0, vy: 10, fuel: 10, elapsedMs: 5000 }, params)
  assert.deepEqual(result, { success: false, reason: 'off-target' })
})

test('landingOutcome fails overspeed when touchdown speed exceeds the safe speed', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const result = landingOutcome({ x: 205, y: 280, vx: 0, vy: 80, fuel: 10, elapsedMs: 5000 }, params)
  assert.deepEqual(result, { success: false, reason: 'overspeed' })
})

test('landingOutcome returns null while still airborne and within the time limit', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const result = landingOutcome({ x: 200, y: 150, vx: 0, vy: 30, fuel: 10, elapsedMs: 5000 }, params)
  assert.equal(result, null)
})

test('landingOutcome fails out-of-fuel if still airborne when the time limit is reached', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const result = landingOutcome({ x: 200, y: 150, vx: 0, vy: 30, fuel: 0, elapsedMs: 15000 }, params)
  assert.deepEqual(result, { success: false, reason: 'out-of-fuel' })
})

test('landingParamsFor pins the hardest and easiest values, plus equipment bonuses', () => {
  const hardest = landingParamsFor({ baseEasiness: 0, fuelBonus: 10, toleranceBonus: 5 })
  assert.equal(hardest.gravity, 90)
  assert.equal(hardest.safeLandingSpeed, 40)
  assert.equal(hardest.targetHalfWidth, 30)
  assert.equal(hardest.maxFuel, 70)
  const easiest = landingParamsFor({ baseEasiness: 0.95, fuelBonus: 0, toleranceBonus: 0 })
  assert.ok(Math.abs(easiest.gravity - 50.1) < 1e-9)
  assert.ok(Math.abs(easiest.safeLandingSpeed - 78) < 1e-9)
  assert.ok(Math.abs(easiest.targetHalfWidth - 44) < 1e-9)
  assert.ok(Math.abs(easiest.maxFuel - 98) < 1e-9)
})

test('initialLandingState starts at the given x and the params startY/maxFuel', () => {
  const params = landingParamsFor({ baseEasiness: 0.5, fuelBonus: 0, toleranceBonus: 0 })
  const state = initialLandingState(params, 260)
  assert.deepEqual(state, { x: 260, y: 20, vx: 0, vy: 0, fuel: params.maxFuel, elapsedMs: 0 })
})

// --- 궤도 진입 ---

test('stepOrbit with no keys held keeps radialSpeed and drifts radius by it', () => {
  const params = { targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, radialThrust: 25, stableSpeedThreshold: 6, maxFuel: 20, timeLimitMs: 15000 }
  const state = { radius: 100, radialSpeed: -10, fuel: 20, elapsedMs: 0 }
  const next = stepOrbit(state, 1000, { up: false, down: false }, params)
  assert.equal(next.radialSpeed, -10)
  assert.equal(next.radius, 90)
  assert.equal(next.fuel, 20)
})

test('stepOrbit grows the radius when up (prograde) is held', () => {
  const params = { targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, radialThrust: 25, stableSpeedThreshold: 6, maxFuel: 20, timeLimitMs: 15000 }
  const state = { radius: 100, radialSpeed: 0, fuel: 20, elapsedMs: 0 }
  const next = stepOrbit(state, 1000, { up: true, down: false }, params)
  assert.equal(next.radialSpeed, 25)
  assert.equal(next.radius, 125)
  assert.equal(next.fuel, 19)
})

test('stepOrbit shrinks the radius when down (retrograde) is held', () => {
  const params = { targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, radialThrust: 25, stableSpeedThreshold: 6, maxFuel: 20, timeLimitMs: 15000 }
  const state = { radius: 100, radialSpeed: 0, fuel: 20, elapsedMs: 0 }
  const next = stepOrbit(state, 1000, { up: false, down: true }, params)
  assert.equal(next.radialSpeed, -25)
  assert.equal(next.radius, 75)
  assert.equal(next.fuel, 19)
})

test('stepOrbit holding up and down together cancels out but still drains fuel once', () => {
  const params = { targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, radialThrust: 25, stableSpeedThreshold: 6, maxFuel: 20, timeLimitMs: 15000 }
  const state = { radius: 100, radialSpeed: 0, fuel: 20, elapsedMs: 0 }
  const next = stepOrbit(state, 1000, { up: true, down: true }, params)
  assert.equal(next.radialSpeed, 0)
  assert.equal(next.radius, 100)
  assert.equal(next.fuel, 19)
})

test('stepOrbit never lets radius go negative', () => {
  const params = { targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, radialThrust: 25, stableSpeedThreshold: 6, maxFuel: 20, timeLimitMs: 15000 }
  const state = { radius: 5, radialSpeed: -100, fuel: 20, elapsedMs: 0 }
  const next = stepOrbit(state, 1000, { up: false, down: false }, params)
  assert.equal(next.radius, 0)
})

test('orbitOutcome fails crashed when radius reaches the crash threshold', () => {
  const params = { targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, radialThrust: 25, stableSpeedThreshold: 6, maxFuel: 20, timeLimitMs: 15000 }
  const result = orbitOutcome({ radius: 35, radialSpeed: 0, fuel: 10, elapsedMs: 5000 }, params)
  assert.deepEqual(result, { success: false, reason: 'crashed' })
})

test('orbitOutcome succeeds when within the band and the radius has stabilized', () => {
  const params = { targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, radialThrust: 25, stableSpeedThreshold: 6, maxFuel: 20, timeLimitMs: 15000 }
  const result = orbitOutcome({ radius: 95, radialSpeed: 3, fuel: 10, elapsedMs: 5000 }, params)
  assert.deepEqual(result, { success: true })
})

test('orbitOutcome returns null when within the band but still drifting', () => {
  const params = { targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, radialThrust: 25, stableSpeedThreshold: 6, maxFuel: 20, timeLimitMs: 15000 }
  const result = orbitOutcome({ radius: 95, radialSpeed: 20, fuel: 10, elapsedMs: 5000 }, params)
  assert.equal(result, null)
})

test('orbitOutcome fails out-of-fuel when the time limit is reached without stabilizing', () => {
  const params = { targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, radialThrust: 25, stableSpeedThreshold: 6, maxFuel: 20, timeLimitMs: 15000 }
  const result = orbitOutcome({ radius: 120, radialSpeed: 10, fuel: 0, elapsedMs: 15000 }, params)
  assert.deepEqual(result, { success: false, reason: 'out-of-fuel' })
})

test('orbitParamsFor pins the hardest and easiest values, plus equipment bonuses', () => {
  const hardest = orbitParamsFor({ baseEasiness: 0, fuelBonus: 5, toleranceBonus: 3 })
  assert.equal(hardest.targetHalfWidth, 13)
  assert.equal(hardest.startRadiusGap, 80)
  assert.equal(hardest.maxFuel, 55)
  const easiest = orbitParamsFor({ baseEasiness: 0.95, fuelBonus: 0, toleranceBonus: 0 })
  assert.ok(Math.abs(easiest.targetHalfWidth - 24.25) < 1e-9)
  assert.ok(Math.abs(easiest.startRadiusGap - 43.9) < 1e-9)
  assert.ok(Math.abs(easiest.maxFuel - 78.5) < 1e-9)
})

test('initialOrbitState starts beyond the target radius by startRadiusGap, at rest, full fuel', () => {
  const params = { targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, radialThrust: 25, stableSpeedThreshold: 6, maxFuel: 60, timeLimitMs: 15000 }
  const state = initialOrbitState(params)
  assert.deepEqual(state, { radius: 130, radialSpeed: 0, fuel: 60, elapsedMs: 0 })
})
