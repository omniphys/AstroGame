import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHIP_TIERS, PARTS, APPROACH_FAILURE_REASONS } from './exploration-data.ts'
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

test('part blurbs do not claim a success/failure probability effect', () => {
  // 최종 성공/실패는 더 이상 확률을 굴려서 정하지 않으므로, 상점 문구가
  // "성공률"/"실패 확률"을 올리고 내린다고 말하면 학생에게 틀린 정보를 줌.
  for (const part of PARTS) {
    assert.ok(!part.blurb.includes('확률'), `${part.id}: ${part.blurb}`)
  }
})

test('every approach failure reason has non-empty copy', () => {
  const reasons: ApproachFailureReason[] = ['overspeed', 'out-of-fuel', 'too-early', 'too-late', 'timeout']
  for (const reason of reasons) {
    assert.ok((APPROACH_FAILURE_REASONS[reason]?.length ?? 0) > 0, reason)
  }
})
