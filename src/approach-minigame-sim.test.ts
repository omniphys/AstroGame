import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  landingParamsFor,
  initialLandingState,
  stepLanding,
  landingOutcome,
  LANDING_BOUNCE_REST_SPEED,
  LANDING_SETTLE_MS,
  orbitParamsFor,
  initialOrbitState,
  stepOrbit,
  orbitOutcome,
  ORBIT_GM,
  ORBIT_THRUST_ACCEL,
  ORBIT_RADIAL_DAMPING,
  ORBIT_STABLE_RADIAL_SPEED_THRESHOLD,
  ORBIT_HOLD_MS,
} from './approach-minigame-sim.ts'

const ORBIT_TEST_PARAMS = { gm: 1_000_000, targetRadius: 90, targetHalfWidth: 15, startRadiusGap: 40, crashRadius: 40, maxRadius: 200, thrustAccel: 20, radialDamping: 1.5, stableRadialSpeedThreshold: 6, holdDurationMs: 2000, timeLimitMs: 15000 }
// 감쇠(radialDamping)는 위치에 따라 달라지는 비선형 보정이라 아래 "분사가
// 그대로 속도를 바꾼다"류 테스트에서는 꺼 둔다(0) - 그 테스트들의 목적은
// 중력+분사 운동학이지 감쇠가 아니다. 감쇠 자체는 별도 테스트에서 다룬다.
const ORBIT_TEST_PARAMS_NO_DAMPING = { ...ORBIT_TEST_PARAMS, radialDamping: 0 }

// --- 착륙 ---
// 분사기는 측면/아래에 달려 있으므로 분사 방향과 힘의 방향은 반대:
// 왼쪽 분사기(←)는 배를 오른쪽으로, 오른쪽 분사기(→)는 왼쪽으로,
// 아래쪽 분사기(↓)는 위로(브레이크) 밀어낸다.
//
// 바닥에 닿아도 바로 끝나지 않고 phase가 'falling' → ('bouncing' |
// 'settling')으로 바뀌며 결과를 보여주는 연출이 이어진다 - 각 단계는
// stepLanding이 state.phase를 보고 알아서 분기한다.

const FALLING_EXTRA = { phase: 'falling' as const, verdict: null, settleMs: 0 }

test('stepLanding applies gravity with no keys held, x unchanged, fuel unchanged', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 20, vx: 0, vy: 0, fuel: 50, elapsedMs: 0, ...FALLING_EXTRA }
  const next = stepLanding(state, 1000, { left: false, right: false, down: false }, params)
  assert.equal(next.vy, 60)
  assert.equal(next.y, 80)
  assert.equal(next.x, 200)
  assert.equal(next.fuel, 50)
  assert.equal(next.elapsedMs, 1000)
  assert.equal(next.phase, 'falling')
})

test('stepLanding brakes (pushes up) when down is held', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 80, vx: 0, vy: 60, fuel: 50, elapsedMs: 1000, ...FALLING_EXTRA }
  const next = stepLanding(state, 500, { left: false, right: false, down: true }, params)
  assert.equal(next.vy, 15)
  assert.equal(next.y, 87.5)
  assert.equal(next.fuel, 49.5)
  assert.equal(next.elapsedMs, 1500)
})

test('stepLanding pushes right and drains fuel when left (left thruster) is held', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 50, vx: 0, vy: 20, fuel: 50, elapsedMs: 0, ...FALLING_EXTRA }
  const next = stepLanding(state, 1000, { left: true, right: false, down: false }, params)
  assert.equal(next.vy, 80)
  assert.equal(next.vx, 80)
  assert.equal(next.x, 280)
  assert.equal(next.fuel, 49)
})

test('stepLanding pushes left and drains fuel when right (right thruster) is held', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 50, vx: 0, vy: 20, fuel: 50, elapsedMs: 0, ...FALLING_EXTRA }
  const next = stepLanding(state, 1000, { left: false, right: true, down: false }, params)
  assert.equal(next.vx, -80)
  assert.equal(next.x, 120)
  assert.equal(next.fuel, 49)
})

test('stepLanding holding multiple keys at once drains fuel the same as holding one', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 50, vx: 0, vy: 20, fuel: 50, elapsedMs: 0, ...FALLING_EXTRA }
  const next = stepLanding(state, 1000, { left: true, right: false, down: true }, params)
  assert.equal(next.fuel, 49)
})

test('stepLanding clamps x at the left edge and zeroes vx', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 10, y: 50, vx: -50, vy: 0, fuel: 50, elapsedMs: 0, ...FALLING_EXTRA }
  const next = stepLanding(state, 1000, { left: false, right: false, down: false }, params)
  assert.equal(next.x, 0)
  assert.equal(next.vx, 0)
})

test('stepLanding clamps x at the right edge and zeroes vx', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 390, y: 50, vx: 50, vy: 0, fuel: 50, elapsedMs: 0, ...FALLING_EXTRA }
  const next = stepLanding(state, 1000, { left: false, right: false, down: false }, params)
  assert.equal(next.x, 400)
  assert.equal(next.vx, 0)
})

test('stepLanding never drains fuel below zero', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 50, vx: 0, vy: 0, fuel: 0.3, elapsedMs: 0, ...FALLING_EXTRA }
  const next = stepLanding(state, 1000, { left: false, right: false, down: true }, params)
  assert.equal(next.fuel, 0)
})

test('stepLanding settles smoothly in place on a safe, on-target touchdown', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 205, y: 278, vx: 0, vy: 40, fuel: 50, elapsedMs: 5000, ...FALLING_EXTRA }
  const next = stepLanding(state, 100, { left: false, right: false, down: false }, params)
  assert.equal(next.phase, 'settling')
  assert.equal(next.y, 280)
  assert.equal(next.vy, 0)
  assert.deepEqual(next.verdict, { success: true })
  assert.equal(next.settleMs, 0)
})

test('stepLanding settles (does not bounce) on a safe but off-target touchdown', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 260, y: 278, vx: 0, vy: 40, fuel: 50, elapsedMs: 5000, ...FALLING_EXTRA }
  const next = stepLanding(state, 100, { left: false, right: false, down: false }, params)
  assert.equal(next.phase, 'settling')
  assert.deepEqual(next.verdict, { success: false, reason: 'off-target' })
})

test('stepLanding bounces instead of settling on a too-fast touchdown', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 205, y: 270, vx: 0, vy: 60, fuel: 50, elapsedMs: 5000, ...FALLING_EXTRA }
  const next = stepLanding(state, 200, { left: false, right: false, down: false }, params)
  assert.equal(next.phase, 'bouncing')
  assert.equal(next.y, 280)
  assert.deepEqual(next.verdict, { success: false, reason: 'overspeed' })
})

test('stepLanding reports overspeed, not off-target, when touchdown is both off the pad and too fast', () => {
  // A hard crash is the more fundamental failure - the copy must not read as a
  // gentle miss when the ship actually slammed in well over the safe speed.
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 260, y: 270, vx: 0, vy: 60, fuel: 50, elapsedMs: 5000, ...FALLING_EXTRA }
  const next = stepLanding(state, 200, { left: false, right: false, down: false }, params)
  assert.equal(next.phase, 'bouncing')
  assert.deepEqual(next.verdict, { success: false, reason: 'overspeed' })
})

test('stepLanding reflects velocity (loses energy) on each bounce until it settles', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const bouncingState = { x: 200, y: 280, vx: 0, vy: 72, fuel: 10, elapsedMs: 5000, phase: 'bouncing' as const, verdict: { success: false, reason: 'overspeed' as const }, settleMs: 0 }
  const next = stepLanding(bouncingState, 100, { left: false, right: false, down: false }, params)
  // vy = 72 + gravity*dt = 78, overshoots the ground again, so it reflects: -78 * 0.4 restitution.
  assert.ok(Math.abs(next.vy - -31.2) < 1e-9)
  assert.equal(next.y, 280)
  assert.ok(Math.sqrt(next.vx * next.vx + next.vy * next.vy) >= LANDING_BOUNCE_REST_SPEED)
  assert.equal(next.phase, 'bouncing')
  assert.deepEqual(next.verdict, bouncingState.verdict)
})

test('stepLanding transitions a bounce to settling once the rebound speed drops below the rest threshold', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const bouncingState = { x: 200, y: 278, vx: 0, vy: 40, fuel: 10, elapsedMs: 5000, phase: 'bouncing' as const, verdict: { success: false, reason: 'overspeed' as const }, settleMs: 0 }
  const next = stepLanding(bouncingState, 100, { left: false, right: false, down: false }, params)
  assert.equal(next.phase, 'settling')
  assert.equal(next.vx, 0)
  assert.equal(next.vy, 0)
  assert.equal(next.y, 280)
})

test('stepLanding decays horizontal speed to a stop while settling, carrying the ship a little further', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const settlingState = { x: 200, y: 280, vx: 50, vy: 0, fuel: 10, elapsedMs: 1000, phase: 'settling' as const, verdict: { success: false, reason: 'off-target' as const }, settleMs: 0 }
  const next = stepLanding(settlingState, 100, { left: false, right: false, down: false }, params)
  assert.equal(next.vx, 20)
  assert.equal(next.x, 202)
  assert.equal(next.settleMs, 100)
  assert.equal(next.phase, 'settling')
})

test('stepLanding settling never decays horizontal speed past zero', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const settlingState = { x: 200, y: 280, vx: 10, vy: 0, fuel: 10, elapsedMs: 1000, phase: 'settling' as const, verdict: { success: true as const }, settleMs: 0 }
  const next = stepLanding(settlingState, 100, { left: false, right: false, down: false }, params)
  assert.equal(next.vx, 0)
  assert.equal(next.x, 200)
})

test('landingOutcome returns null while still falling and within the time limit', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const result = landingOutcome({ x: 200, y: 150, vx: 0, vy: 30, fuel: 10, elapsedMs: 5000, ...FALLING_EXTRA }, params)
  assert.equal(result, null)
})

test('landingOutcome fails out-of-fuel if still falling (never reached the ground) when the time limit is reached', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const result = landingOutcome({ x: 200, y: 150, vx: 0, vy: 30, fuel: 0, elapsedMs: 15000, ...FALLING_EXTRA }, params)
  assert.deepEqual(result, { success: false, reason: 'out-of-fuel' })
})

test('landingOutcome returns null while still bouncing, no matter how much time has passed', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const result = landingOutcome({ x: 200, y: 280, vx: 0, vy: -30, fuel: 0, elapsedMs: 20000, phase: 'bouncing', verdict: { success: false, reason: 'overspeed' }, settleMs: 0 }, params)
  assert.equal(result, null)
})

test('landingOutcome holds the settling verdict back until the settle animation has played out', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const stillSettling = landingOutcome({ x: 200, y: 280, vx: 0, vy: 0, fuel: 10, elapsedMs: 5000, phase: 'settling', verdict: { success: true }, settleMs: LANDING_SETTLE_MS - 1 }, params)
  assert.equal(stillSettling, null)
  const doneSettling = landingOutcome({ x: 200, y: 280, vx: 0, vy: 0, fuel: 10, elapsedMs: 5000, phase: 'settling', verdict: { success: true }, settleMs: LANDING_SETTLE_MS }, params)
  assert.deepEqual(doneSettling, { success: true })
  const doneAfterACrash = landingOutcome({ x: 260, y: 280, vx: 0, vy: 0, fuel: 10, elapsedMs: 5000, phase: 'settling', verdict: { success: false, reason: 'overspeed' }, settleMs: LANDING_SETTLE_MS }, params)
  assert.deepEqual(doneAfterACrash, { success: false, reason: 'overspeed' })
})

test('landingParamsFor pins the hardest and easiest values, plus equipment bonuses', () => {
  const hardest = landingParamsFor({ baseEasiness: 0, fuelBonus: 10, toleranceBonus: 5 })
  assert.equal(hardest.gravity, 90)
  assert.equal(hardest.safeLandingSpeed, 40)
  assert.equal(hardest.targetHalfWidth, 30)
  assert.equal(hardest.maxFuel, 17)
  const easiest = landingParamsFor({ baseEasiness: 0.95, fuelBonus: 0, toleranceBonus: 0 })
  assert.ok(Math.abs(easiest.gravity - 50.1) < 1e-9)
  assert.ok(Math.abs(easiest.safeLandingSpeed - 78) < 1e-9)
  assert.ok(Math.abs(easiest.targetHalfWidth - 44) < 1e-9)
  assert.ok(Math.abs(easiest.maxFuel - 11.75) < 1e-9)
})

test('a player holding all thrust keys the whole time runs out of fuel before the time limit, for the hardest landing body with no equipment', () => {
  // Mercury: baseEasiness 0.65, no parts/probe bonus. Regression test for the
  // tuning bug where maxFuel (60-98s) vastly exceeded the 15s time limit, so
  // fuel could never actually reach zero and every 'out-of-fuel' result lied.
  const params = landingParamsFor({ baseEasiness: 0.65, fuelBonus: 0, toleranceBonus: 0 })
  let state = initialLandingState(params, params.canvasWidth / 2)
  let ranOutAt: number | null = null
  for (let t = 0; t < params.timeLimitMs && ranOutAt === null; t += 16) {
    state = stepLanding(state, 16, { left: true, right: false, down: true }, params)
    if (state.fuel === 0) ranOutAt = state.elapsedMs
  }
  assert.ok(ranOutAt !== null, 'fuel never reached zero within the time limit')
  assert.ok(ranOutAt! < params.timeLimitMs)
})

test('stepLanding clamps y at the top edge (0) and zeroes vy', () => {
  const params = { canvasWidth: 400, groundY: 280, gravity: 60, verticalThrust: 150, lateralThrust: 80, safeLandingSpeed: 50, targetHalfWidth: 30, maxFuel: 50, timeLimitMs: 15000 }
  const state = { x: 200, y: 5, vx: 0, vy: -100, fuel: 50, elapsedMs: 0, ...FALLING_EXTRA }
  const next = stepLanding(state, 1000, { left: false, right: false, down: false }, params)
  assert.equal(next.y, 0)
  assert.equal(next.vy, 0)
})

test('initialLandingState starts at the given x and the params startY/maxFuel, falling with no verdict yet', () => {
  const params = landingParamsFor({ baseEasiness: 0.5, fuelBonus: 0, toleranceBonus: 0 })
  const state = initialLandingState(params, 260)
  assert.deepEqual(state, { x: 260, y: 20, vx: 0, vy: 0, fuel: params.maxFuel, elapsedMs: 0, phase: 'falling', verdict: null, settleMs: 0 })
})

// --- 궤도 진입 ---
// 반경을 직접 조작하지 않고, 위치/속도와 행성 중력(역제곱 법칙)을 그대로
// 적분한다. 테스트 상태는 y=0 축 위에 두어 손으로 가속도를 검증하기 쉽게 한다.

test('stepOrbit pulls the ship toward the planet by gravity when no thrust is held', () => {
  const state = { x: 100, y: 0, vx: 0, vy: 0, holdMs: 0 }
  const next = stepOrbit(state, 1000, { up: false, down: false }, ORBIT_TEST_PARAMS_NO_DAMPING)
  assert.equal(next.vx, -100)
  assert.equal(next.vy, 0)
  assert.equal(next.x, 0)
  assert.equal(next.y, 0)
})

test('stepOrbit speeds the ship up along its direction of travel when down (prograde) is held', () => {
  const state = { x: 100, y: 0, vx: 0, vy: 100, holdMs: 0 }
  const next = stepOrbit(state, 1000, { up: false, down: true }, ORBIT_TEST_PARAMS_NO_DAMPING)
  assert.equal(next.vx, -100)
  assert.equal(next.vy, 120)
  assert.equal(next.x, 0)
  assert.equal(next.y, 120)
})

test('stepOrbit slows the ship down along its direction of travel when up (retrograde) is held', () => {
  const state = { x: 100, y: 0, vx: 0, vy: 100, holdMs: 0 }
  const next = stepOrbit(state, 1000, { up: true, down: false }, ORBIT_TEST_PARAMS_NO_DAMPING)
  assert.equal(next.vx, -100)
  assert.equal(next.vy, 80)
  assert.equal(next.y, 80)
})

test('stepOrbit holding up and down together cancels thrust', () => {
  const state = { x: 100, y: 0, vx: 0, vy: 100, holdMs: 0 }
  const next = stepOrbit(state, 1000, { up: true, down: true }, ORBIT_TEST_PARAMS_NO_DAMPING)
  assert.equal(next.vx, -100)
  assert.equal(next.vy, 100)
})

test('stepOrbit has no fuel gate at all - thrust still applies after a long time with no equipment', () => {
  // 연료 제한이 없으므로 아무리 오래 분사해도 추력이 그대로 적용돼야 한다.
  // (방향은 궤도가 진행되며 계속 바뀌므로, 줄어들지 않고 계속 늘어나는
  // 전체 속력으로 확인한다.)
  const params = { ...ORBIT_TEST_PARAMS_NO_DAMPING }
  let state = { x: 100, y: 0, vx: 0, vy: 100, holdMs: 0 }
  const initialSpeed = Math.sqrt(state.vx * state.vx + state.vy * state.vy)
  for (let t = 0; t < 5000; t += 16) state = stepOrbit(state, 16, { up: false, down: true }, params)
  const finalSpeed = Math.sqrt(state.vx * state.vx + state.vy * state.vy)
  assert.ok(finalSpeed > initialSpeed + 20, `5s of continuous prograde thrust should have sped the ship up a lot (${initialSpeed} -> ${finalSpeed})`)
})

test("stepOrbit's radial damping shrinks the radial velocity component while conserving angular momentum exactly", () => {
  // 중력을 꺼서(gm:0) 감쇠 항만 분리해서 본다. x=100,y=0 위치에서 속도
  // (50,50)은 반경 성분(50, x축과 나란함)과 접선 성분(50)이 섞여 있다.
  const params = { ...ORBIT_TEST_PARAMS, gm: 0 }
  const state = { x: 100, y: 0, vx: 50, vy: 50, holdMs: 0 }
  const Lbefore = state.x * state.vy - state.y * state.vx
  const next = stepOrbit(state, 16, { up: false, down: false }, params)
  const Lafter = next.x * next.vy - next.y * next.vx
  assert.ok(Math.abs(Lafter - Lbefore) < 1e-6, `angular momentum should be exactly conserved (${Lbefore} -> ${Lafter})`)
  const radialSpeedBefore = (state.x * state.vx + state.y * state.vy) / Math.sqrt(state.x * state.x + state.y * state.y)
  const r = Math.sqrt(next.x * next.x + next.y * next.y)
  const radialSpeedAfter = (next.x * next.vx + next.y * next.vy) / r
  assert.ok(Math.abs(radialSpeedAfter) < Math.abs(radialSpeedBefore), 'radial speed should shrink toward zero')
})

test('stepOrbit accumulates holdMs while within the target band and radially stable', () => {
  // gm을 0으로 둬서 중력 가속도를 없애면(순수 운동학) 한 스텝 뒤의 위치/속도를
  // 손으로 바로 검산할 수 있다 - 실제 중력 적분의 안정성은 별도 테스트가 덮는다.
  const params = { ...ORBIT_TEST_PARAMS, gm: 0 }
  const state = { x: 95, y: 0, vx: 0, vy: 0, holdMs: 500 }
  const next = stepOrbit(state, 200, { up: false, down: false }, params)
  assert.equal(next.holdMs, 700)
})

test('stepOrbit resets holdMs to 0 the instant the ship drifts outside the band', () => {
  // x=150은 targetRadius(90) ± targetHalfWidth(15) 범위 밖.
  const state = { x: 150, y: 0, vx: 0, vy: 50, holdMs: 1800 }
  const next = stepOrbit(state, 200, { up: false, down: false }, ORBIT_TEST_PARAMS)
  assert.equal(next.holdMs, 0)
})

test('stepOrbit resets holdMs to 0 the instant the radius starts changing too fast, even inside the band', () => {
  const state = { x: 95, y: 0, vx: 50, vy: 50, holdMs: 1800 }
  const next = stepOrbit(state, 200, { up: false, down: false }, ORBIT_TEST_PARAMS)
  assert.equal(next.holdMs, 0)
})

test('orbitOutcome fails crashed when the radius reaches the crash threshold', () => {
  const result = orbitOutcome({ x: 30, y: 0, vx: 0, vy: 0, holdMs: 0 }, ORBIT_TEST_PARAMS)
  assert.deepEqual(result, { success: false, reason: 'crashed' })
})

test('orbitOutcome fails escaped when the radius reaches the escape threshold', () => {
  const result = orbitOutcome({ x: 150, y: 0, vx: 0, vy: 0, holdMs: 0 }, { ...ORBIT_TEST_PARAMS, maxRadius: 140 })
  assert.deepEqual(result, { success: false, reason: 'escaped' })
})

test('orbitOutcome returns null while still within the band and stable, before the hold duration is reached', () => {
  const result = orbitOutcome({ x: 95, y: 0, vx: 0, vy: 50, holdMs: ORBIT_TEST_PARAMS.holdDurationMs - 1 }, ORBIT_TEST_PARAMS)
  assert.equal(result, null)
})

test('orbitOutcome succeeds once the band+stable condition has held continuously for holdDurationMs', () => {
  // 한 바퀴(또는 그에 준하는 시간) 동안 궤도가 끊기지 않고 유지돼야 성공 -
  // 근점/원점을 스쳐 지나가는 순간의 radialSpeed=0 한 번만으로는 부족하다.
  const result = orbitOutcome({ x: 95, y: 0, vx: 0, vy: 50, holdMs: ORBIT_TEST_PARAMS.holdDurationMs }, ORBIT_TEST_PARAMS)
  assert.deepEqual(result, { success: true })
})

test('orbitOutcome returns null forever (no time limit) when drifting but never crashing, escaping, or holding', () => {
  const result = orbitOutcome({ x: 120, y: 0, vx: 10, vy: 10, holdMs: 0 }, ORBIT_TEST_PARAMS)
  assert.equal(result, null)
})

test('orbitParamsFor pins the hardest and easiest values, plus equipment bonuses', () => {
  const hardest = orbitParamsFor({ baseEasiness: 0, fuelBonus: 5, toleranceBonus: 3 })
  assert.equal(hardest.targetHalfWidth, 8)
  assert.equal(hardest.startRadiusGap, 50)
  assert.equal(hardest.maxRadius, 140)
  assert.equal(hardest.gm, ORBIT_GM)
  assert.equal(hardest.thrustAccel, ORBIT_THRUST_ACCEL)
  assert.equal(hardest.radialDamping, ORBIT_RADIAL_DAMPING)
  assert.equal(hardest.stableRadialSpeedThreshold, ORBIT_STABLE_RADIAL_SPEED_THRESHOLD)
  assert.equal(hardest.holdDurationMs, ORBIT_HOLD_MS)
  const easiest = orbitParamsFor({ baseEasiness: 0.95, fuelBonus: 0, toleranceBonus: 0 })
  assert.ok(Math.abs(easiest.targetHalfWidth - 12.125) < 1e-9)
  assert.ok(Math.abs(easiest.startRadiusGap - 31) < 1e-9)
  assert.equal(easiest.maxRadius, 140)
})

test('initialOrbitState starts beyond the target radius by startRadiusGap, on a circular orbit, no hold yet', () => {
  const state = initialOrbitState(ORBIT_TEST_PARAMS)
  const expectedV0 = Math.sqrt(ORBIT_TEST_PARAMS.gm / 130)
  assert.equal(state.x, 130)
  assert.equal(state.y, 0)
  assert.equal(state.vx, 0)
  assert.ok(Math.abs(state.vy - expectedV0) < 1e-9)
  assert.equal(state.holdMs, 0)
})

test('a single well-aimed burn followed by coasting reaches and holds the target orbit, with no time limit, for the hardest body with no equipment', () => {
  // Jupiter: baseEasiness 0 (가장 어려운 궤도 진입 대상). 플레이어가 "지금
  // 속도대로면 안착할 반경"이 목표 반경을 지날 때까지 레트로그레이드를
  // 누르고 있다가 놓는 식의, 실제로 가능한 단일 분사 시나리오를 흉내낸다.
  // 시간 제한이 없으므로 테스트 자체의 안전장치로만 스텝 수를 제한한다.
  const params = orbitParamsFor({ baseEasiness: 0, fuelBonus: 0, toleranceBonus: 0 })
  let state = initialOrbitState(params)
  let burnMs = 0
  while (burnMs < 5000) {
    const next = stepOrbit(state, 16, { up: true, down: false }, params)
    const circularRadiusForNext = (next.x * next.vy - next.y * next.vx) ** 2 / params.gm
    state = next
    burnMs += 16
    if (circularRadiusForNext <= params.targetRadius) break
  }

  let outcome = null
  for (let i = 0; i < 2000 && outcome === null; i++) {
    state = stepOrbit(state, 16, { up: false, down: false }, params)
    outcome = orbitOutcome(state, params)
  }
  assert.deepEqual(outcome, { success: true })
})

test('a circular orbit with no thrust stays within its starting radius band over a full revolution', () => {
  // 손을 대지 않으면 안정된 원 궤도를 그대로 유지해야 한다 - 궤도가 저절로
  // 무너지거나(추락) 발산(이탈)하면 심플렉틱 적분이 깨진 것.
  const params = orbitParamsFor({ baseEasiness: 0.5, fuelBonus: 0, toleranceBonus: 0 })
  let state = initialOrbitState(params)
  const r0 = Math.sqrt(state.x * state.x + state.y * state.y)
  let maxDrift = 0
  for (let t = 0; t < 10_000; t += 16) {
    state = stepOrbit(state, 16, { up: false, down: false }, params)
    const r = Math.sqrt(state.x * state.x + state.y * state.y)
    maxDrift = Math.max(maxDrift, Math.abs(r - r0))
  }
  assert.ok(maxDrift < 2, `orbit radius drifted by ${maxDrift}px with no thrust applied`)
})
