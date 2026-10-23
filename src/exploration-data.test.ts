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
