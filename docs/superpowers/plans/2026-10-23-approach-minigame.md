# 최종 접근 미니게임 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 탐사 비행 연출의 "최종 접근" 단계에 학생이 직접 조작하는 미니게임(암석형 천체=착륙, 가스/얼음 거대행성=궤도 진입)을 넣고, 그 결과가 곧 탐사의 최종 성공/실패가 되도록 한다. 장비는 확률을 올리는 대신 "탐사 가능 여부"를 가르는 자격 조건, 그리고 미니게임 자체를 너그럽게 만드는 쪽으로 역할이 바뀐다.

**Architecture:** 순수 물리/판정 로직(`approach-minigame-sim.ts`, DOM 없음, 유닛테스트 가능)과 DOM/키보드/rAF 배선(`approach-minigame.ts`)을 분리한다. 기존 `exploration-mission.ts`의 비행 연출 타이밍은 전혀 건드리지 않고, 그 타임라인이 끝난 직후에 미니게임을 끼워 넣어 결과를 `resolveMission`에 그대로 전달한다. 장비 데이터(`exploration-data.ts`)와 게이트/판정 로직(`exploration-state.ts`)을 확장한다.

**Tech Stack:** 기존 스택 그대로 (바닐라 TypeScript, DOM, CSS transition, `requestAnimationFrame`). 새 npm 의존성 없음. 순수 로직 테스트는 Node 내장 테스트 러너(`node --test`, Node 22.6+ 필요 — 새 의존성 아님)로 돌린다.

**Spec:** `docs/superpowers/specs/2026-10-23-approach-minigame-design.md`

## Global Constraints

- 새 npm 의존성을 추가하지 않는다.
- 세미콜론 없이, 홑따옴표 (`CLAUDE.md`의 기존 코드 스타일).
- `exploration-mission.ts`의 기존 발사~도착 타이밍 상수/로직(`PHASE_SCHEDULE_MS`, `SHIP_TRAVEL_MS`, `LAUNCH_DURATION_MS` 등)은 수정하지 않는다. 미니게임은 그 타임라인 뒤에 이어지는 새 단계로만 추가한다.
- 키보드 단일 키(Space)로 두 미니게임 모두 조작한다.
- 결과는 성공/실패 2단계로만 가른다 — 등급 없음.
- 재도전은 기존처럼 비용 없이 언제나 가능하다.
- 탐사 대상은 정확히 8개이며 종류가 고정되어 있다: 착륙 = 달·수성·금성·화성, 궤도 진입 = 목성·토성·천왕성·해왕성.

## Review Focus

- Space를 누르고 있으면 브라우저가 `keydown`을 반복 발생시킨다(`e.repeat === true`) — 착륙 미니게임에서 이게 추력을 중복 적용하거나 상태를 깨뜨리면 안 된다.
- 탭을 백그라운드로 뒀다가 돌아오면 한 프레임의 실제 경과 시간이 수 초로 튈 수 있다 — 이걸 그대로 물리 계산에 넣으면 착륙선이 안전 구간을 건너뛰고 통과해버리거나 즉시 타임아웃될 수 있으므로, 프레임당 경과 시간에 상한을 둬야 한다.
- 궤도 진입 미니게임에서 Space를 한 번 누른 뒤 라운드가 이미 끝났는데 추가 입력(빠른 연타, 큐에 남은 이벤트)이 들어와도 Promise가 두 번 resolve되거나 예외가 나면 안 된다.
- Space가 아닌 다른 키를 누르면 아무 일도 일어나지 않아야 한다 (충돌/성공 처리되거나 죽으면 안 됨).
- `main.ts`에 이미 있는 전역 Space 리스너("선택된 천체로 카메라 이동")가 미니게임이 떠 있는 동안에도 같이 발동하면 안 된다 — 미니게임 입력 중에 카메라가 갑자기 움직이는 건 체감상 치명적인 버그다.

---

## File Structure

- Create: `src/approach-minigame-sim.ts` — 순수 물리/판정 로직, DOM 의존 없음.
- Create: `src/approach-minigame-sim.test.ts` — 위 로직의 유닛 테스트.
- Create: `src/approach-minigame.ts` — DOM 오버레이, 키보드 입력, `requestAnimationFrame` 루프.
- Modify: `src/exploration-data.ts` — `ShipTier`에 `approachKind` 필드 추가, 실패 문구를 미니게임별로 분리.
- Create: `src/exploration-data.test.ts` — 위 데이터의 유닛 테스트.
- Modify: `src/exploration-state.ts` — `getMissionSuccessChance` → `getApproachEasiness`로 역할 변경.
- Modify: `src/exploration-mission.ts` — 미니게임을 비행 연출 뒤에 끼워 넣고, `resolveMission`이 확률을 굴리는 대신 미니게임 결과를 그대로 쓰게 함.
- Modify: `src/exploration-mode.ts` — 탐사 버튼 활성화 조건(게이트)과 안내 문구를 갱신.
- Modify: `src/main.ts` — 미니게임 진행 중에는 전역 Space 리스너가 발동하지 않게 가드 추가.
- Modify: `src/style.css` — 두 미니게임의 오버레이/게이지 스타일.
- Modify: `package.json` — `"test"` 스크립트 추가 (새 의존성 아님, 기존 devDependency인 Node 내장 기능만 사용).

---

### Task 1: 순수 접근 미니게임 로직 (`approach-minigame-sim.ts`)

**Files:**
- Create: `src/approach-minigame-sim.ts`
- Test: `src/approach-minigame-sim.test.ts`
- Modify: `package.json` (scripts에 `"test"` 추가)

**Interfaces:**
- Produces: `ApproachKind = 'landing' | 'orbit'`, `ApproachFailureReason = 'overspeed' | 'too-early' | 'too-late' | 'timeout'`, `ApproachResult = { success: true } | { success: false; reason: ApproachFailureReason }`, `LandingParams`, `LandingState`, `landingParamsForEasiness(easiness: number): LandingParams`, `initialLandingState(params: LandingParams): LandingState`, `stepLanding(state: LandingState, dtMs: number, thrustHeld: boolean, params: LandingParams): LandingState`, `landingOutcome(state: LandingState, params: LandingParams): ApproachResult | null`, `OrbitParams`, `orbitParamsForEasiness(easiness: number): OrbitParams`, `needlePosition(elapsedMs: number, params: OrbitParams): number`, `orbitPressOutcome(elapsedMs: number, params: OrbitParams): ApproachResult`, `orbitTimeoutResult(): ApproachResult`. Later tasks (2, 3, 6) import these.

- [ ] **Step 1: `package.json`에 테스트 스크립트 추가**

`"scripts"`에 다음을 추가 (새 의존성 없음, Node 22.6+의 실험적 TS strip 기능만 사용):

```json
"test": "node --experimental-strip-types --test"
```

- [ ] **Step 2: 실패하는 테스트 작성 — `src/approach-minigame-sim.test.ts`**

상대 경로 import에는 `.ts` 확장자를 명시해야 한다 (Vite가 아니라 Node의 네이티브 ESM 로더가 직접 실행하기 때문 — 이 파일에서만 해당, 나머지 `src/*.ts`는 기존처럼 확장자 없이 import).

```ts
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

test('landingOutcome fails with timeout when the time limit is reached before touchdown', () => {
  const params = { gravity: 20, thrust: 32, safeSpeed: 10, startAltitude: 100, timeLimitMs: 8000 }
  const result = landingOutcome({ altitude: 5, speed: 3, elapsedMs: 8000 }, params)
  assert.deepEqual(result, { success: false, reason: 'timeout' })
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
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `approach-minigame-sim.ts` 모듈이 없어서 import 에러.

- [ ] **Step 4: `src/approach-minigame-sim.ts` 구현**

위 Interfaces에 적힌 정확한 함수들을 구현한다. 공식(디자인 문서가 구현자에게 맡긴 수치를 이 플랜이 확정):

- `landingParamsForEasiness(easiness)`: `e = clamp(easiness, 0, 0.95)` 기준으로 `gravity = 18 + (1 - e) * 22`, `thrust = 32`(고정), `safeSpeed = 10 + e * 15`, `startAltitude = 100`, `timeLimitMs = 8000`.
- `stepLanding`: `dtSec = dtMs / 1000`. `accel = thrustHeld ? gravity - thrust : gravity`. `speed = max(0, speed + accel * dtSec)`. `altitude = max(0, altitude - speed * dtSec)`(새 speed로 계산). `elapsedMs`는 그대로 더함.
- `landingOutcome`: `altitude <= 0`이면 `speed <= safeSpeed`일 때 성공, 아니면 `overspeed` 실패. 아직 `altitude > 0`인데 `elapsedMs >= timeLimitMs`면 `timeout` 실패. 그 외엔 `null`(진행 중).
- `orbitParamsForEasiness(easiness)`: `e = clamp(easiness, 0, 0.95)` 기준 `zoneWidth = 14 + e * 26`, `needleSpeed = 70 - e * 20`, `timeLimitMs = 8000`.
- `needlePosition(elapsedMs, params)`: `distance = (elapsedMs / 1000) * needleSpeed`, `cycle = distance % 200`, `cycle <= 100 ? cycle : 200 - cycle` (0↔100 핑퐁 — 트랙은 0-100 스케일, 가운데 50이 `ORBIT_ZONE_CENTER`).
- `orbitPressOutcome(elapsedMs, params)`: `zoneStart/zoneEnd = ORBIT_ZONE_CENTER ± zoneWidth/2`. 포지션이 zoneStart 미만이면 `too-early`, zoneEnd 초과면 `too-late`, 아니면 성공.
- `orbitTimeoutResult()`: 항상 `{ success: false, reason: 'timeout' }`.

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS (13개 테스트 전부)

- [ ] **Step 6: Commit**

```bash
git add src/approach-minigame-sim.ts src/approach-minigame-sim.test.ts package.json
git commit -m "feat: add pure landing/orbit-insertion minigame logic"
```

---

### Task 2: 천체별 접근 방식 + 실패 문구 (`exploration-data.ts`)

**Files:**
- Modify: `src/exploration-data.ts`
- Test: `src/exploration-data.test.ts`

**Interfaces:**
- Consumes: `ApproachFailureReason` (from Task 1, `./approach-minigame-sim`)
- Produces: `ShipTier.approachKind: ApproachKind` (8개 항목 모두에 값 채움), `APPROACH_FAILURE_REASONS: Record<ApproachFailureReason, string>`. Task 5(exploration-mode.ts)는 `approachKind`를, Task 6(exploration-mission.ts)는 `APPROACH_FAILURE_REASONS`를 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성 — `src/exploration-data.test.ts`**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHIP_TIERS, APPROACH_FAILURE_REASONS } from './exploration-data.ts'
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

test('every approach failure reason has non-empty copy', () => {
  const reasons: ApproachFailureReason[] = ['overspeed', 'too-early', 'too-late', 'timeout']
  for (const reason of reasons) {
    assert.ok((APPROACH_FAILURE_REASONS[reason]?.length ?? 0) > 0, reason)
  }
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `approachKind`/`APPROACH_FAILURE_REASONS`가 아직 없음.

- [ ] **Step 3: `ShipTier`에 `approachKind` 추가하고 8개 항목 채우기**

`ShipTier` 인터페이스에 `approachKind: ApproachKind` 필드를 추가(파일 상단에 `import type { ApproachKind, ApproachFailureReason } from './approach-minigame-sim'` 추가). `SHIP_TIERS` 배열의 각 항목에 값을 채운다: `NAME Moon`/`NAME Mercury`/`NAME Venus`/`NAME Mars` → `'landing'`, `NAME Jupiter`/`NAME Saturn`/`NAME Uranus`/`NAME Neptune` → `'orbit'`.

- [ ] **Step 4: `MISSION_FAILURE_REASONS`를 `APPROACH_FAILURE_REASONS`로 교체**

기존의 완전 무작위 `MISSION_FAILURE_REASONS: string[]`(98-106행)를 지우고, 미니게임에서 실제로 무엇이 잘못됐는지에 맞춘 문구로 교체한다:

```ts
export const APPROACH_FAILURE_REASONS: Record<ApproachFailureReason, string> = {
  overspeed: '하강 속도가 너무 빨라 착륙 중 충돌했습니다.',
  'too-early': '감속을 너무 일찍 시작해 궤도를 벗어나지 못하고 대기권에 끌려 들어갔습니다.',
  'too-late': '감속이 늦어 궤도 진입 창을 놓치고 우주로 날아가 버렸습니다.',
  timeout: '제때 반응하지 못해 접근에 실패했습니다.',
}
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/exploration-data.ts src/exploration-data.test.ts
git commit -m "feat: split exploration targets into landing/orbit approach kinds"
```

---

### Task 3: 미니게임 DOM/입력 배선 (`approach-minigame.ts`)

**Files:**
- Create: `src/approach-minigame.ts`

**Interfaces:**
- Consumes: Task 1의 모든 export (`./approach-minigame-sim`).
- Produces: `isApproachMinigameActive(): boolean`, `runApproachMinigame(kind: ApproachKind, easiness: number): Promise<ApproachResult>`. Task 4(CSS)는 여기서 쓰는 클래스명을, Task 6(main.ts, exploration-mission.ts)은 두 함수를 그대로 가져다 쓴다.

이 태스크는 DOM/타이밍/키보드에 묶여 있어 자동화 테스트가 없다 (프로젝트에 DOM 테스트 도구를 새로 추가하지 않는다는 제약 때문). Step 4의 수동 확인으로 검증한다.

- [ ] **Step 1: 오버레이 DOM 구조 정의**

`runApproachMinigame`가 호출될 때마다 아래 구조를 만들어 `document.body`에 붙이고, 끝나면 완전히 제거한다 (고정 싱글턴이 아니라 매번 새로 생성/제거).

착륙(`kind === 'landing'`):
```html
<div id="approach-minigame-overlay" class="visible approach-minigame-landing">
  <div class="approach-hint">Space를 누르고 있으면 역추진합니다 — 안전한 속도로 착륙하세요.</div>
  <div class="approach-landing-track"><div class="approach-landing-fill"></div></div>
  <div class="approach-speed-readout">하강 속도 <span class="approach-speed-value">0</span></div>
</div>
```

궤도 진입(`kind === 'orbit'`):
```html
<div id="approach-minigame-overlay" class="visible approach-minigame-orbit">
  <div class="approach-hint">바늘이 안전 구간 안에 있을 때 Space를 누르세요.</div>
  <div class="approach-orbit-track">
    <div class="approach-orbit-zone"></div>
    <div class="approach-orbit-needle"></div>
  </div>
</div>
```

- [ ] **Step 2: 착륙 루프 구현**

`landingParamsForEasiness(easiness)`로 params를, `initialLandingState(params)`로 초기 state를 만든다. `thrustHeld = false`로 시작. `window`에 `keydown`/`keyup` 리스너를 건다: `Space` 키다운이면(`e.repeat` 상관없이) `thrustHeld = true`로 설정하고 `preventDefault()` (Review Focus의 "반복 keydown" 항목 — 토글이라 중복 적용 걱정 없음); `Space` 키업이면 `thrustHeld = false`. 다른 키는 무시.

`requestAnimationFrame` 루프: 이전 타임스탬프와의 차이를 `dtMs`로 쓰되 **`Math.min(dtMs, 100)`으로 상한을 둔다** (Review Focus의 "탭 백그라운드" 항목). `stepLanding`으로 state 갱신 → `.approach-landing-fill`의 `height`를 `state.altitude + '%'`로, `.approach-speed-value`의 텍스트를 `Math.round(state.speed)`로 갱신 → `landingOutcome(state, params)`가 `null`이 아니면 종료 처리, 아니면 다음 프레임 예약.

- [ ] **Step 3: 궤도 진입 루프 구현**

`orbitParamsForEasiness(easiness)`로 params를 만든다. 시작 시각을 기록. `resolved = false` 플래그를 둬서 아래 종료 처리가 두 번 일어나지 않게 한다 (Review Focus의 "중복 입력" 항목). `window`에 `keydown` 리스너: `e.code !== 'Space'`거나 `e.repeat`이거나 이미 `resolved`면 무시; 아니면 `preventDefault()`하고 경과 시간으로 `orbitPressOutcome`을 호출해 종료 처리.

`requestAnimationFrame` 루프: 경과 시간이 `params.timeLimitMs` 이상이면 `orbitTimeoutResult()`로 종료 처리; 아니면 `needlePosition(elapsedMs, params)`로 `.approach-orbit-needle`의 `left`를 갱신하고 다음 프레임 예약. `.approach-orbit-zone`은 루프 시작 전 한 번 `left`/`width`를 `ORBIT_ZONE_CENTER ± zoneWidth/2`로 세팅해 두면 됨(고정이라 매 프레임 갱신 불필요).

- [ ] **Step 4: 공통 종료 처리 + 활성 상태 플래그**

모듈 최상단에 `let active = false`. `runApproachMinigame` 시작 시 `active = true`. 공통 `finish(result)` 함수(두 분기 모두 사용): 이미 끝났으면 무시 → `cancelAnimationFrame` → `keydown`/`keyup` 리스너 제거 → 오버레이를 `document.body`에서 제거 → `active = false` → Promise `resolve(result)`.

`export function isApproachMinigameActive(): boolean { return active }` (main.ts의 Task 6 가드가 사용).

- [ ] **Step 5: 수동 확인**

`npm run dev` 실행 → 탐사 기지에서 달(🌕) 탐사용 우주선·탐사선을 사고 탐사를 보내서 비행 연출이 끝난 뒤 착륙 미니게임이 뜨는지, Space를 누르고 있으면 하강 속도가 줄고 떼면 다시 느는지 확인. 목성 탐사용 장비를 갖춘 뒤 목성을 보내서 궤도 진입 미니게임(바늘+안전 구간)이 뜨고 Space 한 번으로 판정되는지 확인. 둘 다 결과(성공/실패)가 뜬 뒤 오버레이가 깨끗이 사라지는지 확인.

- [ ] **Step 6: Commit**

```bash
git add src/approach-minigame.ts
git commit -m "feat: wire landing and orbit-insertion minigames to DOM/keyboard"
```

---

### Task 4: 미니게임 스타일 (`style.css`)

**Files:**
- Modify: `src/style.css`

**Interfaces:**
- Consumes: Task 3에서 정의한 클래스명 (`#approach-minigame-overlay`, `.approach-minigame-landing`, `.approach-minigame-orbit`, `.approach-hint`, `.approach-landing-track`, `.approach-landing-fill`, `.approach-speed-readout`, `.approach-speed-value`, `.approach-orbit-track`, `.approach-orbit-zone`, `.approach-orbit-needle`).

- [ ] **Step 1: 오버레이 기본 레이아웃 추가**

`#mission-reveal-overlay`(z-index 85)와 `#mission-flight-overlay`(z-index 80) 사이, `z-index: 82`로 전체화면 오버레이를 추가. `position: fixed; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 16px; background: rgba(0,0,0,0.75);` 기본형, `.visible`이면 `display: flex`.

- [ ] **Step 2: 착륙 변형 스타일**

`.approach-minigame-landing`에 설계 문서가 정한 대로 `exploration-button`/`#exploration-panel`과 같은 철강빛 남색+호박 톤을 입힌다 (세로 트랙 `.approach-landing-track`: 고정 너비/높이(예: 56px × 280px), 테두리, 반투명 배경; `.approach-landing-fill`: 바닥에서부터 차오르는 식으로 `position: absolute; bottom: 0; width: 100%;`에 호박색 그라데이션, `height`는 JS가 갱신; `.approach-speed-readout`은 흰 텍스트).

- [ ] **Step 3: 궤도 진입 변형 스타일**

`.approach-minigame-orbit`에 `.sound-toggle`/`.object-search-select`와 같은 청록 톤을 입힌다 (가로 트랙 `.approach-orbit-track`: 고정 너비(예: min(600px, 80vw)) × 얇은 높이, 테두리, 반투명 배경; `.approach-orbit-zone`: `position: absolute`, 청록 반투명 배경, `left`/`width`는 JS가 세팅; `.approach-orbit-needle`: `position: absolute`, 밝은 세로선, `left`는 JS가 갱신).

- [ ] **Step 4: 수동 확인**

Task 3의 Step 5에서 이미 띄워본 두 미니게임 화면이 각각 설계 문서가 말한 색 톤(착륙=철강+호박, 궤도 진입=청록)으로 보이는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/style.css
git commit -m "style: add landing/orbit-insertion minigame visuals"
```

---

### Task 5: 탐사 기지 게이트/안내 문구 갱신 (`exploration-mode.ts`)

**Files:**
- Modify: `src/exploration-mode.ts`

**Interfaces:**
- Consumes: `ShipTier.approachKind` (Task 2).

- [ ] **Step 1: 가스/얼음 거대행성에 탐사선 2단계 게이트 추가**

현재 `canExplore = probeTier > 0`(90행)를 지우고, 대상별로 필요한 최소 탐사선 단계를 계산한다: `const minProbeTier = ship.approachKind === 'orbit' ? 2 : 1`(`targetsHtml`을 만드는 `SHIP_TIERS.map((ship) => ...)` 콜백 안, 91행 부근). 탐사선 2단계("궤도 관측선")의 설명에 이미 "가스 행성에도 투입 가능"이라고 되어 있고 1단계("기본 로버")는 바퀴로 움직이는 로버라 가스 행성에 맞지 않는다는 설정을 그대로 게이트로 승격한 것.

- [ ] **Step 2: 상태 문구 분기 갱신**

`targetsHtml`의 상태 분기(94-112행)를 아래 순서로 바꾼다:
- `explored` → 그대로 `✅ 탐사 완료`.
- `!reachable`(`shipTier < ship.tier`) → 그대로 `🔒 우주선 단계 부족`.
- `probeTier === 0` → 그대로 `탐사선이 필요합니다`.
- `probeTier < minProbeTier`(0은 아니지만 2단계 미만인 가스 행성) → 새 분기: `🔒 탐사선 2단계 이상 필요`.
- 그 외 → `getMissionSuccessChance`로 "성공 확률 N%"를 보여주던 것을 지우고, `예상 점수 약 ${ship.baseScore}+ · ${ship.approachKind === 'landing' ? '착륙' : '궤도 진입'} 미니게임`으로 교체.

- [ ] **Step 3: 이제 안 쓰는 import 제거**

`exploration-state`에서 가져오던 `getMissionSuccessChance` import를 지운다 (더는 이 파일에서 쓰지 않음 — Task 6에서 `exploration-mission.ts`가 이름이 바뀐 `getApproachEasiness`를 대신 가져다 쓴다).

- [ ] **Step 4: 수동 확인**

`npm run dev` → 탐사 기지를 열어 우주선 단계만 있고 탐사선이 없는 상태에서 "탐사선이 필요합니다"가, 탐사선 1단계만 있고 목성을 볼 때 "🔒 탐사선 2단계 이상 필요"가 뜨는지 확인. 조건을 다 갖춘 대상 카드에 "성공 확률" 대신 "착륙 미니게임"/"궤도 진입 미니게임" 문구가 뜨는지 확인. `npx tsc --noEmit`으로 타입 에러 없는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/exploration-mode.ts
git commit -m "feat: gate gas/ice giant missions on probe tier, drop probability copy"
```

---

### Task 6: 최종 배선 — 미니게임을 비행 연출에 연결 (`exploration-mission.ts`, `exploration-state.ts`, `main.ts`)

**Files:**
- Modify: `src/exploration-state.ts`
- Modify: `src/exploration-mission.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `runApproachMinigame`, `isApproachMinigameActive` (Task 3), `APPROACH_FAILURE_REASONS` (Task 2).

- [ ] **Step 1: `exploration-state.ts` — `getMissionSuccessChance`를 `getApproachEasiness`로 이름 바꾸기**

함수 본문(97-106행)은 그대로 두고 이름과 주석만 바꾼다: 더는 "성공 확률"이 아니라 "미니게임을 얼마나 너그럽게 만들지 결정하는 값(0~0.95, 장비가 좋을수록 높음)"이라는 뜻으로 바뀌었다는 걸 주석에 반영.

- [ ] **Step 2: `main.ts` — 미니게임 중엔 전역 Space 리스너 끄기**

`./approach-minigame`에서 `isApproachMinigameActive`를 import하고, 기존 `keydown` 리스너(105행 부근) 조건에 추가:

```ts
if (e.code !== 'Space' || !core.selection || isApproachMinigameActive()) return
```

- [ ] **Step 3: `exploration-mission.ts` — `resolveMission` 시그니처 변경**

`resolveMission(designation: string, crewed: boolean)` → `resolveMission(designation: string, crewed: boolean, approach: ApproachResult)`로 바꾸고, 맨 앞의 `const succeeded = Math.random() < getMissionSuccessChance(designation)` 줄(69행)을 지운다. 이후 분기는 `succeeded` 대신 `approach.success`를 쓴다. 실패 분기의 `MISSION_FAILURE_REASONS[Math.floor(...)]`(72-73행)를 `APPROACH_FAILURE_REASONS[approach.reason]`으로 교체 (`approach.success === false`일 때만 `reason`이 존재 — 판별 유니언이라 타입스크립트가 좁혀줌).

- [ ] **Step 4: `exploration-mission.ts` — 미니게임을 비행 연출 뒤에 끼워 넣기**

파일 상단 import에 `runApproachMinigame`(from `./approach-minigame`)과 `getApproachEasiness`(from `./exploration-state`, 기존 `getMissionSuccessChance` import를 대체)를 추가.

마지막 `setTimeout(() => { phaseTimers.forEach(clearTimeout); flightOverlay.classList.remove('visible'); resolveMission(designation, crewed) }, FLIGHT_DURATION_MS)` 블록(167-171행)을 아래처럼 바꾼다:

```ts
setTimeout(() => {
  phaseTimers.forEach(clearTimeout)
  flightOverlay.classList.remove('visible')
  runApproachMinigame(ship!.approachKind, getApproachEasiness(designation)).then((approach) => {
    resolveMission(designation, crewed, approach)
  })
}, FLIGHT_DURATION_MS)
```

(`ship`은 이 함수 상단에서 이미 `SHIP_TIERS.find(...)`로 구해둔 변수 — 버튼이 보일 때만 호출되므로 항상 존재한다.)

- [ ] **Step 5: 빌드 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 수동 확인 — 전체 플로우 + Review Focus의 카메라 버그**

`npm run dev` → 달 탐사 장비를 갖추고 탐사를 보내 비행 연출 → 착륙 미니게임 → 결과 화면까지 끊김 없이 이어지는지 확인. 미니게임이 떠 있는 동안 아무 천체나 선택해둔 상태에서 Space를 눌러도 배경의 카메라가 움직이지 않는지(= `main.ts`의 가드가 실제로 동작하는지) 확인. 일부러 착륙에 실패해서(계속 Space를 떼고 있기) 실패 문구가 "충돌했습니다" 계열로 뜨는지, 성공하면 기존처럼 점수/사진이 뜨는지 확인.

- [ ] **Step 7: Commit**

```bash
git add src/exploration-state.ts src/exploration-mission.ts src/main.ts
git commit -m "feat: let the approach minigame decide mission success instead of a dice roll"
```

---

## Self-Review

**Spec coverage:** 자격 게이트(Task 5) · 두 미니게임(Task 1/3) · 미니게임이 최종 판정을 대신함(Task 6) · 실패 문구가 미니게임 내용과 맞음(Task 2/6) · 재도전 무비용(기존 `exploreTarget`/UI 동작을 건드리지 않았으므로 그대로 유지) · 키보드 단일 키(Task 3) · 비행 연출 타이밍 불변(Task 6에서 `FLIGHT_DURATION_MS` 이후에만 삽입) · 새 의존성 없음(Task 1에서 Node 내장 테스트 러너만 사용) — 모두 커버됨.

**Review Focus 반영:** 반복 keydown(Task 3 Step 2) · 프레임 시간 상한(Task 3 Step 2) · 중복 입력 가드(Task 3 Step 3·4) · 다른 키 무시(Task 3 Step 2·3) · 전역 Space 리스너 충돌(Task 6 Step 2·6) — 모두 해당 태스크의 구현 스텝 또는 수동 확인에 반영됨.

**비고:** Task 3·4·6의 검증은 자동화 테스트가 아니라 수동 확인이다 — 프로젝트에 DOM 테스트 도구가 없고(`jsdom` 등은 새 의존성이라 제약 위반) 이 기능 자체가 "느낌"이 중요한 타이밍 게임이라 사람이 직접 해보는 게 더 의미 있는 검증이기 때문. 순수 로직(물리/판정 공식, 게이트 데이터)은 Task 1·2에서 전부 자동화 테스트로 덮었다.
