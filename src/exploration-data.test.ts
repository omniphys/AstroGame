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
