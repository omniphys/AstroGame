# 접근 미니게임 물리 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지금의 1축 게이지/타이밍 미니게임을 2D 운동(착륙)과 1축 반경 운동(궤도 진입) 기반의, 중력·추력·연료를 가진 물리 시뮬레이션으로 교체한다. 방향키로 조작하고, 캔버스로 렌더링한다.

**Architecture:** 이전 기능과 같은 순수/DOM 분리를 유지한다 — `approach-minigame-sim.ts`는 DOM 없는 순수 물리/판정 로직(유닛테스트 가능), `approach-minigame.ts`는 캔버스/키보드/rAF 배선. 상위 통합 계약(`ApproachKind`/`ApproachResult` 판별 유니언, `resolveMission` 연동, 장비 게이트, 비행 연출 타이밍)은 이전 스펙 그대로 유지하고 — 미니게임 **내부**만 전부 새로 짠다.

**Tech Stack:** 바닐라 TypeScript + Canvas 2D API. 새 npm 의존성 없음(물리 엔진 라이브러리 포함). 순수 로직 테스트는 Node 내장 테스트 러너(`npm test` = `node --experimental-strip-types --test`).

**Spec:** `docs/superpowers/specs/2026-10-23-approach-minigame-physics-design.md` (이전 통합 계약은 `docs/superpowers/specs/2026-10-23-approach-minigame-design.md`에 정의되어 있고, 이번 스펙이 유지한다고 명시한 부분)

## Global Constraints

- 새 npm 의존성을 추가하지 않는다(물리 엔진 라이브러리 포함) — 직접 적분한다.
- 세미콜론 없이, 홑따옴표.
- 상위 통합 계약은 바꾸지 않는다: `ApproachKind`, `ApproachResult`(판별 유니언) 모양, `resolveMission` 연동, 우주선 단계 + 가스 행성의 탐사선 2단계 게이트, `exploration-mission.ts`의 발사~도착 타이밍 상수.
- 방향키만 쓴다 — 착륙은 위/왼쪽/오른쪽(최대 3개), 궤도 진입은 위/아래(최대 2개).
- 연료는 방향키를 몇 개 동시에 누르든 소모량이 같다(합산하지 않음).
- 착륙의 캔버스/뷰포트는 고정(카메라가 따라가지 않음) — 좌우 위치는 캔버스 가장자리에서 클램프하고, 가장자리 도달 자체는 실패가 아니다.
- 새 아이템/부품을 추가하지 않는다 — 기존 3종(추진 부스터/생명유지 모듈/정밀 관측 장비)의 효과만 재배정한다.
- 궤도 진입은 원궤도(반경 1축)로만 다룬다 — 타원·각운동량·역제곱 중력 법칙을 시뮬레이션하지 않는다.
- 강체 충돌 엔진 없음 — 점질량 운동방정식(가속도→속도→위치 적분)만 쓴다.

## Review Focus

- 착륙에서 방향키 여러 개를 동시에 누르면(예: 위+왼쪽) 연료가 두 배로 닳으면 안 된다 — 한 번만 닳아야 한다.
- 창(탭)이 포커스를 잃은 채로 방향키를 누르고 있다가 돌아오면(예: Alt-Tab), `keyup`을 못 받아서 추력이 계속 켜진 채로 남아있으면 안 된다.
- 좌우 위치가 캔버스 가장자리에 닿았을 때 값이 발산하거나(NaN) 떨림 없이 매끄럽게 멈춰야 하고, 가장자리 도달 자체가 실패 처리로 이어지면 안 된다.
- 탭을 백그라운드에 뒀다가 돌아왔을 때 한 프레임의 실제 경과 시간이 수 초로 튈 수 있다 — 이걸 그대로 적분하면 착륙선이 땅을 뚫고 지나가거나(터널링) 궤도 반경이 충돌/목표 범위를 한 프레임에 건너뛸 수 있으므로 프레임당 경과 시간에 상한을 둬야 한다.
- 궤도 진입의 "안정화" 판정이 반경 변화 속도가 정확히 0이어야 하는 식으로 너무 엄격하면 안 된다 — 합리적인 허용 오차가 있어야 실제로 깰 수 있다.

---

## File Structure

- Modify (전체 교체): `src/approach-minigame-sim.ts` — 순수 물리/판정 로직.
- Modify (전체 교체): `src/approach-minigame-sim.test.ts` — 위 로직의 유닛 테스트.
- Modify: `src/exploration-data.ts` — `ShipTier.baseSuccessChance` → `baseEasiness`로 이름만 변경, `ProbeTier`/`Part`의 `successChanceBonus` → `fuelBonus`(+`Part`에는 `toleranceBonus` 추가), 부품 3종 수치/문구 재배정, `APPROACH_FAILURE_REASONS`를 새 실패 사유 4종으로 교체.
- Modify: `src/exploration-data.test.ts` — 위 변경에 맞춰 갱신.
- Modify: `src/exploration-state.ts` — `getApproachEasiness` 하나를 `getBaseEasiness`/`getFuelBonus`/`getToleranceBonus` 셋으로 분리.
- Modify (전체 교체): `src/approach-minigame.ts` — 캔버스 렌더링 + 방향키 입력 + rAF 배선.
- Modify: `src/exploration-mission.ts` — 세 함수를 모아 `ApproachTuning` 객체를 만들어 `runApproachMinigame`에 넘기도록 배선 갱신.
- Modify: `src/style.css` — 기존 게이지/바늘 스타일을 캔버스 컨테이너 + 연료 바 스타일로 교체.

---

### Task 1: 순수 물리/판정 로직 전체 교체 (`approach-minigame-sim.ts`)

**Files:**
- Modify (전체 교체): `src/approach-minigame-sim.ts`
- Modify (전체 교체): `src/approach-minigame-sim.test.ts`

**Interfaces:**
- Produces: `ApproachKind`(기존과 동일, 유지), `ApproachFailureReason = 'off-target' | 'overspeed' | 'out-of-fuel' | 'crashed'`(완전히 새로 정의 — 기존 `'too-early'|'too-late'|'timeout'` 등은 전부 삭제), `ApproachResult`(판별 유니언 모양은 기존과 동일하게 유지), `ApproachTuning { baseEasiness: number; fuelBonus: number; toleranceBonus: number }`.
  착륙: `LandingParams`, `LandingState`, `LandingKeys { up: boolean; left: boolean; right: boolean }`, `landingParamsFor(tuning: ApproachTuning): LandingParams`, `initialLandingState(params: LandingParams, startX: number): LandingState`, `stepLanding(state, dtMs, keys, params): LandingState`, `landingOutcome(state, params): ApproachResult | null`.
  궤도: `OrbitParams`, `OrbitState`, `OrbitKeys { up: boolean; down: boolean }`, `orbitParamsFor(tuning: ApproachTuning): OrbitParams`, `initialOrbitState(params: OrbitParams): OrbitState`, `stepOrbit(state, dtMs, keys, params): OrbitState`, `orbitOutcome(state, params): ApproachResult | null`.
  내보내는 상수: `LANDING_CANVAS_WIDTH`(400), `LANDING_CANVAS_HEIGHT`(300), `LANDING_GROUND_Y`(280), `LANDING_START_Y`(20), `ORBIT_TARGET_RADIUS`(90), `ORBIT_CRASH_RADIUS`(40).
  Task 2(exploration-data.ts)는 `ApproachFailureReason`을, Task 3(approach-minigame.ts)은 이 파일의 모든 export를, Task 5(exploration-mission.ts)는 `ApproachTuning`을 가져다 쓴다.

**공식 (이 플랜이 확정 — 디자인 문서가 구현자에게 맡긴 정확한 수치):**

착륙:
- `landingParamsFor(tuning)`: `e = clamp(tuning.baseEasiness, 0, 0.95)`. `gravity = 90 - e * 42`. `verticalThrust = 150`(고정). `lateralThrust = 80`(고정). `safeLandingSpeed = 40 + e * 40`. `targetHalfWidth = 25 + e * 20 + tuning.toleranceBonus`. `maxFuel = 60 + e * 40 + tuning.fuelBonus`. `timeLimitMs = 15000`.
- `initialLandingState(params, startX)`: `{ x: startX, y: LANDING_START_Y, vx: 0, vy: 0, fuel: params.maxFuel, elapsedMs: 0 }`.
- `stepLanding`: `dtSec = dtMs / 1000`. `thrusting = (keys.up || keys.left || keys.right) && state.fuel > 0`. `vy = state.vy + params.gravity * dtSec`; `thrusting && keys.up`이면 `vy -= params.verticalThrust * dtSec`. `vx = state.vx`; `thrusting && keys.left`면 `vx -= params.lateralThrust * dtSec`; `thrusting && keys.right`면 `vx += params.lateralThrust * dtSec`. `x = state.x + vx * dtSec`; `x < 0`이면 `x = 0, vx = 0`; `x > params.canvasWidth`면 `x = params.canvasWidth, vx = 0`. `y = state.y + vy * dtSec`(클램프 없음). `fuel = thrusting ? max(0, state.fuel - dtSec) : state.fuel`. `elapsedMs`는 그대로 더함.
- `landingOutcome`: `state.y >= params.groundY`면 착지 판정 — `targetCenter = params.canvasWidth / 2`; `|state.x - targetCenter| > params.targetHalfWidth`면 `{success:false, reason:'off-target'}`; 아니고 `sqrt(vx² + vy²) > params.safeLandingSpeed`면 `{success:false, reason:'overspeed'}`; 둘 다 아니면 `{success:true}`. 아직 `y < groundY`인데 `elapsedMs >= params.timeLimitMs`면 `{success:false, reason:'out-of-fuel'}`. 그 외엔 `null`.

궤도:
- `orbitParamsFor(tuning)`: `e = clamp(tuning.baseEasiness, 0, 0.95)`. `targetRadius = ORBIT_TARGET_RADIUS`(90). `targetHalfWidth = 10 + e * 15 + tuning.toleranceBonus`. `startRadiusGap = 80 - e * 38`. `crashRadius = ORBIT_CRASH_RADIUS`(40). `radialThrust = 25`(고정). `stableSpeedThreshold = 6`(고정). `maxFuel = 50 + e * 30 + tuning.fuelBonus`. `timeLimitMs = 15000`.
- `initialOrbitState(params)`: `{ radius: params.targetRadius + params.startRadiusGap, radialSpeed: 0, fuel: params.maxFuel, elapsedMs: 0 }`.
- `stepOrbit`: `dtSec = dtMs / 1000`. `thrusting = (keys.up || keys.down) && state.fuel > 0`. `radialSpeed = state.radialSpeed`; `thrusting && keys.up`면 `radialSpeed += params.radialThrust * dtSec`; `thrusting && keys.down`면 `radialSpeed -= params.radialThrust * dtSec`. `radius = max(0, state.radius + radialSpeed * dtSec)`. `fuel = thrusting ? max(0, state.fuel - dtSec) : state.fuel`. `elapsedMs` 누적.
- `orbitOutcome`: `state.radius <= params.crashRadius`면 `{success:false, reason:'crashed'}`(최우선 체크). `withinBand = |state.radius - params.targetRadius| <= params.targetHalfWidth`. `stabilized = |state.radialSpeed| <= params.stableSpeedThreshold`. 둘 다 참이면 `{success:true}`. `elapsedMs >= params.timeLimitMs`면 `{success:false, reason:'out-of-fuel'}`. 그 외 `null`.

- [ ] **Step 1: 실패하는 테스트 작성 — `src/approach-minigame-sim.test.ts`**

파일 전체를 아래 내용으로 교체한다 (기존 테스트는 전부 지금의 sim.ts와 함께 사라지는 메커니즘을 테스트하던 것이므로 전체 교체).

```ts
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
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — 지금의 `approach-minigame-sim.ts`에는 위 함수/타입이 없음(이름이 다르거나 아예 없음).

- [ ] **Step 3: `src/approach-minigame-sim.ts` 전체 교체**

파일 전체를 지우고, 위 "공식" 절에 적힌 정확한 함수들로 다시 쓴다. 타입 정의(`ApproachKind`, `ApproachFailureReason`, `ApproachResult`, `ApproachTuning`, `LandingParams`/`LandingState`/`LandingKeys`, `OrbitParams`/`OrbitState`/`OrbitKeys`)와 상수(`LANDING_CANVAS_WIDTH` 등)도 함께 내보낸다.

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS (이 파일의 테스트 26개 전부 — 다른 파일의 기존 테스트는 Task 2에서 갱신하기 전까지 깨져 있을 수 있음, 무시).

- [ ] **Step 5: Commit**

```bash
git add src/approach-minigame-sim.ts src/approach-minigame-sim.test.ts
git commit -m "feat: rewrite approach minigame physics as 2D landing + 1-axis orbit radius sim"
```

---

### Task 2: 장비 데이터 — 실패 사유/부품 효과 재배정 (`exploration-data.ts`)

**Files:**
- Modify: `src/exploration-data.ts`
- Modify: `src/exploration-data.test.ts`

**Interfaces:**
- Consumes: `ApproachFailureReason` (Task 1, `./approach-minigame-sim`)
- Produces: `ShipTier.baseEasiness: number`(이름만 변경, 값은 그대로 — 8개 항목 모두), `ProbeTier.fuelBonus: number`(이름/값 변경), `Part.fuelBonus: number`/`Part.toleranceBonus: number`(3종 모두), `APPROACH_FAILURE_REASONS: Record<ApproachFailureReason, string>`(4개 새 키). Task 3(exploration-state.ts)은 이 필드들을, Task 4(exploration-mission.ts)는 `APPROACH_FAILURE_REASONS`를 가져다 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성 — `src/exploration-data.test.ts`**

파일 전체를 아래로 교체한다.

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHIP_TIERS, PROBE_TIERS, PARTS, APPROACH_FAILURE_REASONS } from './exploration-data.ts'
import type { ApproachFailureReason } from './approach-minigame-sim.ts'

test('rocky bodies use the landing minigame', () => {
  for (const designation of ['NAME Moon', 'NAME Mercury', 'NAME Venus', 'NAME Mars']) {
    const entry = SHIP_TIERS.find((s) => s.designation === designation)
    assert.equal(entry?.approachKind, 'landing', designation)
  }
})

test('gas and ice giants use the orbit-insertion minigame', () => {
  for (const designation of ['NAME Jupiter', 'NAME Saturn', 'NAME Uranus', 'NAME Neptune']) {
    const entry = SHIP_TIERS.find((s) => s.designation === designation)
    assert.equal(entry?.approachKind, 'orbit', designation)
  }
})

test('every ship tier has a baseEasiness between 0 and 1', () => {
  for (const ship of SHIP_TIERS) {
    assert.ok(ship.baseEasiness >= 0 && ship.baseEasiness <= 1, ship.designation)
  }
})

test('booster and life-support grant fuel, instruments grants tolerance, not the other way around', () => {
  const booster = PARTS.find((p) => p.id === 'booster')!
  const lifeSupport = PARTS.find((p) => p.id === 'life-support')!
  const instruments = PARTS.find((p) => p.id === 'instruments')!
  assert.ok(booster.fuelBonus > 0)
  assert.equal(booster.toleranceBonus, 0)
  assert.ok(lifeSupport.fuelBonus > 0)
  assert.equal(lifeSupport.toleranceBonus, 0)
  assert.equal(instruments.fuelBonus, 0)
  assert.ok(instruments.toleranceBonus > 0)
})

test('probe tiers grant increasing fuel bonuses', () => {
  assert.equal(PROBE_TIERS[0].fuelBonus, 0)
  assert.ok(PROBE_TIERS[1].fuelBonus > PROBE_TIERS[0].fuelBonus)
  assert.ok(PROBE_TIERS[2].fuelBonus > PROBE_TIERS[1].fuelBonus)
})

test('part blurbs do not claim a success/failure probability effect', () => {
  for (const part of PARTS) {
    assert.ok(!part.blurb.includes('확률'), `${part.id}: ${part.blurb}`)
  }
})

test('every approach failure reason has non-empty copy', () => {
  const reasons: ApproachFailureReason[] = ['off-target', 'overspeed', 'out-of-fuel', 'crashed']
  for (const reason of reasons) {
    assert.ok((APPROACH_FAILURE_REASONS[reason]?.length ?? 0) > 0, reason)
  }
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `baseEasiness`/`fuelBonus`/`toleranceBonus`가 아직 없고, `APPROACH_FAILURE_REASONS`에 새 키가 없음.

- [ ] **Step 3: `ShipTier.baseSuccessChance` → `baseEasiness`로 이름 변경**

인터페이스 필드명과 8개 항목의 키 이름을 전부 바꾼다(값은 그대로 — `0.9`, `0.65`, `0.75`, `0.75`, `0.6`, `0.55`, `0.45`, `0.4`). 인터페이스 주석도 "성공 확률"이 아니라 "0-1, 그 대상의 기본 난이도(미니게임을 얼마나 너그럽게 만들지의 기준) - 높을수록 쉬움"으로 바꾼다.

- [ ] **Step 4: `ProbeTier.successChanceBonus` → `fuelBonus`로 교체**

인터페이스 필드명을 바꾸고, 3개 항목 값을 `0`, `10`, `20`으로 바꾼다 (기존 `0`, `0.07`, `0.15`는 확률 단위라 그대로 못 씀). 주석도 "연료 보너스(초 단위)"로 바꾼다.

- [ ] **Step 5: `Part` 인터페이스에 `fuelBonus`/`toleranceBonus` 추가, 부품 3종 값/문구 갱신**

`successChanceBonus: number` 필드를 지우고 `fuelBonus: number`와 `toleranceBonus: number`를 추가한다. 3개 항목을 아래로 바꾼다:

```ts
{ id: 'booster', label: '추진 부스터', cost: 20, scoreBonus: 5, fuelBonus: 15, toleranceBonus: 0, imageFile: 'part-booster.svg', blurb: '추력과 연료 탱크를 늘려 탐사마다 약간의 추가 성과를 얻고, 접근 미니게임에서 쓸 수 있는 연료도 늘어남.' },
{ id: 'life-support', label: '생명유지 모듈', cost: 40, scoreBonus: 0, fuelBonus: 8, toleranceBonus: 0, imageFile: 'part-life-support.svg', blurb: '유인 탐사를 가능하게 함 - 유인으로 탐사하면 점수가 두 배. 이중 안전장치로 예비 연료도 조금 더 실림.' },
{ id: 'instruments', label: '정밀 관측 장비', cost: 30, scoreBonus: 10, fuelBonus: 0, toleranceBonus: 12, imageFile: 'part-instruments.svg', blurb: '더 정확한 데이터를 수집해 탐사마다 추가 점수를 얻고, 정밀 접근으로 착륙/궤도 목표 범위도 넓어짐.' },
```

- [ ] **Step 6: `APPROACH_FAILURE_REASONS`를 새 실패 사유 4종으로 교체**

```ts
export const APPROACH_FAILURE_REASONS: Record<ApproachFailureReason, string> = {
  'off-target': '착륙 지점을 벗어난 채로 내려앉았습니다.',
  overspeed: '착지 속도가 너무 빨라 충돌했습니다.',
  'out-of-fuel': '연료가 바닥나 접근에 실패했습니다.',
  crashed: '궤도 반경이 너무 줄어들어 행성과 충돌했습니다.',
}
```

- [ ] **Step 7: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS (Task 1의 26개 + 이 파일의 7개).

- [ ] **Step 8: Commit**

```bash
git add src/exploration-data.ts src/exploration-data.test.ts
git commit -m "feat: reassign equipment effects to fuel/tolerance, new failure-reason copy"
```

---

### Task 3: 장비 조회 함수 분리 (`exploration-state.ts`)

**Files:**
- Modify: `src/exploration-state.ts`

**Interfaces:**
- Consumes: `ShipTier.baseEasiness`, `ProbeTier.fuelBonus`, `Part.fuelBonus`/`Part.toleranceBonus` (Task 2).
- Produces: `getBaseEasiness(designation: string): number`, `getFuelBonus(): number`, `getToleranceBonus(): number`. Task 5(exploration-mission.ts)가 이 셋을 모아 `ApproachTuning`을 만든다.

이 태스크는 기존 `getApproachEasiness` 하나를 순수 데이터 조회 함수 셋으로 나누는 기계적인 변경이라 별도 테스트 없이 진행한다(로직 자체는 Task 1에서 이미 전부 테스트됨 — 여기서는 어떤 필드를 더하는지만 바뀜). `npx tsc --noEmit`으로 타입만 확인한다.

- [ ] **Step 1: `getApproachEasiness`를 세 함수로 교체**

97-107행의 `getApproachEasiness`를 지우고 아래로 교체한다:

```ts
// 0-1. 그 대상의 기본 난이도(장비 없이)를 그대로 돌려준다.
export function getBaseEasiness(designation: string): number {
  const shipEntry = SHIP_TIERS.find((s) => s.designation === designation)
  return shipEntry?.baseEasiness ?? 0
}

// 탐사선 단계 + 소유한 부품(부스터/생명유지 모듈)에서 나오는 연료 보너스 합(초 단위).
export function getFuelBonus(): number {
  const probeBonus = PROBE_TIERS[getProbeTier() - 1]?.fuelBonus ?? 0
  const owned = getOwnedParts()
  const partsBonus = PARTS.filter((p) => owned.has(p.id)).reduce((sum, p) => sum + p.fuelBonus, 0)
  return probeBonus + partsBonus
}

// 소유한 부품(정밀 관측 장비)에서 나오는 목표 범위 보너스 합.
export function getToleranceBonus(): number {
  const owned = getOwnedParts()
  return PARTS.filter((p) => owned.has(p.id)).reduce((sum, p) => sum + p.toleranceBonus, 0)
}
```

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit`
Expected: `exploration-mission.ts`가 아직 옛 이름(`getApproachEasiness`)을 쓰고 있어서 에러가 남 — Task 5에서 고쳐질 예정이므로 지금은 그 에러만 있으면 된다. `exploration-state.ts` 자체에서 새로 생긴 에러는 없어야 한다.

- [ ] **Step 3: 테스트 스위트 확인**

Run: `npm test`
Expected: PASS (이 파일은 테스트가 없으므로 기존 스위트 그대로 통과해야 함).

- [ ] **Step 4: Commit**

```bash
git add src/exploration-state.ts
git commit -m "feat: split getApproachEasiness into base/fuel/tolerance lookups"
```

---

### Task 4: 캔버스 렌더링 + 방향키 배선 (`approach-minigame.ts`)

**Files:**
- Modify (전체 교체): `src/approach-minigame.ts`

**Interfaces:**
- Consumes: Task 1의 모든 export.
- Produces: `isApproachMinigameActive(): boolean`(기존과 동일한 이름/시그니처 유지), `runApproachMinigame(kind: ApproachKind, tuning: ApproachTuning): Promise<ApproachResult>`(시그니처가 `easiness: number` 한 개에서 `tuning: ApproachTuning` 객체로 바뀜). Task 5(exploration-mission.ts), Task 6의 `main.ts` 가드가 이 둘을 그대로 가져다 쓴다.

이 태스크는 DOM/캔버스/키보드/rAF에 묶여 있어 자동화 테스트가 없다(이전 미니게임과 같은 이유 — DOM 테스트 도구를 새로 추가하지 않음). Step 6의 수동 확인으로 검증한다.

- [ ] **Step 1: 오버레이/캔버스 DOM 구조**

`runApproachMinigame`가 호출될 때마다 아래 구조를 만들어 `document.body`에 붙이고, 끝나면 완전히 제거한다(이전과 같은 매번 생성/제거 패턴).

```html
<div id="approach-minigame-overlay" class="visible approach-minigame-landing"> <!-- 또는 approach-minigame-orbit -->
  <div class="approach-hint">...(착륙: "방향키로 조작해 중앙 착륙장에 안착하세요." / 궤도: "방향키로 궤도 반경을 목표 범위 안으로 맞추고 안정시키세요.")</div>
  <canvas class="approach-canvas" width="400" height="300"></canvas> <!-- 궤도는 width=300 height=300 -->
  <div class="approach-fuel-bar"><div class="approach-fuel-fill"></div></div>
</div>
```

- [ ] **Step 2: 방향키 입력 — 다중 키 동시 입력 지원**

`Set<string>`(예: `heldKeys`)으로 현재 눌린 방향키들을 추적한다. `window`에 `keydown`: `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`가 아니면 무시; 맞으면 `preventDefault()`하고 `heldKeys.add(e.code)`(Set이라 `e.repeat`이어도 중복 걱정 없음). `keyup`: `heldKeys.delete(e.code)`. 추가로 `window`에 `blur` 리스너를 달아 포커스를 잃으면 `heldKeys.clear()`(Review Focus의 "포커스 잃으면 추력이 안 꺼짐" 항목).

매 프레임, `heldKeys`에서 `LandingKeys`/`OrbitKeys` 객체를 만든다(예: `{ up: heldKeys.has('ArrowUp'), left: heldKeys.has('ArrowLeft'), right: heldKeys.has('ArrowRight') }`).

- [ ] **Step 3: 착륙 루프**

`landingParamsFor(tuning)`으로 params를 만들고, `startX = canvasWidth/2 + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80)`로 시작 x를 정해 `initialLandingState(params, startX)`를 호출한다.

`requestAnimationFrame` 루프: 이전 타임스탬프와의 차이를 `dtMs`로 쓰되 **`Math.min(dtMs, 100)`으로 상한**(Review Focus의 "탭 백그라운드" 항목). `stepLanding`으로 state 갱신 → 캔버스를 지우고 하늘/땅/착륙장 폭/탐사선 위치를 다시 그림 → `.approach-fuel-fill`의 `width`를 `(state.fuel / params.maxFuel * 100) + '%'`로 갱신 → `landingOutcome(state, params)`가 `null`이 아니면 종료 처리, 아니면 다음 프레임 예약.

- [ ] **Step 4: 궤도 진입 루프**

`orbitParamsFor(tuning)`으로 params를 만들고 `initialOrbitState(params)`를 호출한다. 장식용 회전 각도 `angle`을 0에서 시작해 매 프레임 일정 속도로 증가시킨다(판정에는 안 쓰임, 시각 효과 전용).

`requestAnimationFrame` 루프: 위와 같은 방식으로 `dtMs`를 100ms로 클램프. `stepOrbit`으로 state 갱신 → 캔버스를 지우고 중앙 행성, 목표 반경 고리, 현재 반경에 위치한 탐사선 점(각도는 장식용 `angle` 사용)을 다시 그림 → 연료 바 갱신 → `orbitOutcome(state, params)`가 `null`이 아니면 종료 처리, 아니면 다음 프레임 예약.

- [ ] **Step 5: 공통 종료 처리 + 활성 상태 플래그**

모듈 최상단에 `let active = false`. `runApproachMinigame` 시작 시 `active = true`. 공통 `finish(result)`(두 분기 모두 사용): 이미 끝났으면 무시 → `cancelAnimationFrame` → `keydown`/`keyup`/`blur` 리스너 제거 → 오버레이를 `document.body`에서 제거 → `active = false` → Promise `resolve(result)`.

`export function isApproachMinigameActive(): boolean { return active }`(기존과 동일, `main.ts`의 가드가 그대로 재사용).

- [ ] **Step 6: 수동 확인**

`npm run dev` 실행 → 달 탐사 장비를 갖추고 탐사를 보내 착륙 미니게임을 띄운다. 위/왼쪽/오른쪽 방향키로 탐사선이 캔버스 안에서 실제로 움직이는지, 연료 바가 줄어드는지, 화면 가장자리에서 더 못 나가는지 확인. 목성 탐사용 장비를 갖추고 궤도 진입 미니게임을 띄워, 위/아래 방향키로 반경이 커지고 줄어드는지, 반경이 목표 고리 안에서 멈추면 성공하는지, 너무 줄이면 충돌로 실패하는지 확인.

- [ ] **Step 7: Commit**

```bash
git add src/approach-minigame.ts
git commit -m "feat: render approach minigames on canvas with multi-key arrow controls"
```

---

### Task 5: 스타일 — 게이지/바늘을 캔버스 컨테이너 + 연료 바로 교체 (`style.css`)

**Files:**
- Modify: `src/style.css`

**Interfaces:**
- Consumes: Task 4에서 정의한 클래스명(`.approach-canvas`, `.approach-fuel-bar`, `.approach-fuel-fill`). 기존 `.approach-landing-track`/`.approach-landing-fill`/`.approach-speed-readout`/`.approach-speed-value`/`.approach-orbit-track`/`.approach-orbit-zone`/`.approach-orbit-needle`는 더 이상 쓰이지 않으므로 지운다.

- [ ] **Step 1: 더는 안 쓰는 게이지/바늘 스타일 제거**

`.approach-landing-track`, `.approach-landing-fill`, `.approach-speed-readout`, `.approach-orbit-track`, `.approach-orbit-zone`, `.approach-orbit-needle` 규칙을 지운다. `#approach-minigame-overlay`, `.approach-minigame-landing`, `.approach-minigame-orbit`, `.approach-hint`는 그대로 둔다(레이아웃/팔레트 재사용).

- [ ] **Step 2: 캔버스 스타일 추가**

```css
.approach-canvas {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: #05070c;
}
```

(착륙/궤도 각각의 테두리 색은 기존처럼 `.approach-minigame-landing .approach-canvas`/`.approach-minigame-orbit .approach-canvas`로 철강빛 호박/청록 톤을 입힌다 — 정확한 값은 기존 `.approach-landing-track`/`.approach-orbit-track`에 쓰던 색을 그대로 가져다 쓴다.)

- [ ] **Step 3: 연료 바 스타일 추가**

```css
.approach-fuel-bar {
  width: min(400px, 80vw);
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  overflow: hidden;
}

.approach-fuel-fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, #ffb547, #ffd79a);
  transition: width 0.1s linear;
}
```

- [ ] **Step 4: 수동 확인**

Task 4의 Step 6에서 띄운 두 미니게임 화면에서 캔버스 테두리가 기존 팔레트(착륙=철강+호박, 궤도=청록)로 보이는지, 연료 바가 깎이는 게 눈에 보이는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/style.css
git commit -m "style: replace minigame gauge CSS with canvas container and fuel bar"
```

---

### Task 6: 최종 배선 (`exploration-mission.ts`)

**Files:**
- Modify: `src/exploration-mission.ts`

**Interfaces:**
- Consumes: `getBaseEasiness`/`getFuelBonus`/`getToleranceBonus`(Task 3), `runApproachMinigame`(Task 4, 새 시그니처), `APPROACH_FAILURE_REASONS`(Task 2, 새 키).

- [ ] **Step 1: import 갱신**

`./exploration-state`에서 가져오던 `getApproachEasiness`를 `getBaseEasiness, getFuelBonus, getToleranceBonus`로 교체한다. `./exploration-data`의 `MISSION_FAILURE_REASONS` import는 이미 `APPROACH_FAILURE_REASONS`로 되어 있을 것(이전 기능에서 바뀜) — 그대로 둔다.

- [ ] **Step 2: 미니게임 호출부를 `ApproachTuning` 객체로 교체**

`runApproachMinigame(ship!.approachKind, getApproachEasiness(designation))` 호출을 아래로 바꾼다:

```ts
const tuning = {
  baseEasiness: getBaseEasiness(designation),
  fuelBonus: getFuelBonus(),
  toleranceBonus: getToleranceBonus(),
}
runApproachMinigame(ship!.approachKind, tuning).then((approach) => {
  resolveMission(designation, crewed, approach)
})
```

`resolveMission`의 나머지 내용(성공/실패 분기, `APPROACH_FAILURE_REASONS[approach.reason]` 조회)은 이미 판별 유니언 기반이라 **바뀌지 않는다** — `ApproachFailureReason`의 구체적인 값만 Task 1/2에서 바뀌었을 뿐, 조회 코드 자체는 그대로 둔다.

- [ ] **Step 3: 빌드 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 전체 테스트 스위트 확인**

Run: `npm test`
Expected: PASS (전부).

- [ ] **Step 5: 수동 확인 — 전체 플로우**

`npm run dev` → 달 탐사 장비를 갖추고 탐사를 보내 비행 연출 → 착륙 미니게임(방향키로 조작) → 결과 화면까지 끊김 없이 이어지는지 확인. 일부러 착륙 지점에서 멀리 떨어뜨려 착지시켜 "착륙 지점을 벗어난" 실패 문구가 뜨는지, 너무 빠르게 떨어뜨려 "충돌했습니다" 문구가 뜨는지, 성공적으로 착지시키면 기존처럼 점수/사진이 뜨는지 확인. 목성 탐사도 마찬가지로 궤도 진입 미니게임을 플레이해 성공/충돌 경로를 모두 확인.

- [ ] **Step 6: Commit**

```bash
git add src/exploration-mission.ts
git commit -m "feat: wire the physics-based approach minigames into the mission flow"
```

---

## Self-Review

**Spec coverage:** 착륙 2D 운동 + 좌우 랜덤 시작(Task 1/4) · 궤도 1축 반경 운동 + 안정화 판정(Task 1/4) · 공용 연료(동시 입력 시 합산 안 함, Task 1에서 테스트로 고정) · 캔버스 렌더링(Task 4/5) · 기존 부품 3종 재배정(Task 2) · 방향키만 사용(Task 4) · 좌우 캔버스 경계 클램프(Task 1/4) · 상위 통합 계약 불변(Task 6에서 `resolveMission` 내부 로직을 건드리지 않음) · 새 의존성 없음(Task 1~6 전부 기존 스택만 사용) — 모두 커버됨.

**Review Focus 반영:** 다중 키 동시 입력 시 연료 미합산(Task 1 테스트로 고정 + Task 4 Set 기반 구현) · 포커스 잃었을 때 추력 고착 방지(Task 4 Step 2의 `blur` 리스너) · 좌우 경계 클램프(Task 1 테스트 + Task 4) · 프레임 시간 상한(Task 4 Step 3/4) · 궤도 안정화 허용 오차(Task 1의 `stableSpeedThreshold=6`, 0이 아닌 여유를 둠) — 모두 반영됨.

**비고:** Task 4·5의 검증은 자동화 테스트가 아니라 수동 확인이다 — 캔버스/키보드/rAF는 DOM 테스트 도구 없이는 자동화할 수 없고(새 의존성 금지), 이 기능 자체가 "조작감"이 핵심이라 사람이 직접 해보는 게 더 의미 있는 검증이기 때문. 순수 물리/판정 로직(Task 1)과 장비 데이터(Task 2)는 자동화 테스트로 전부 덮었다.
