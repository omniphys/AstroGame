import { spendPoints } from './points'
import { SHIP_TIERS, PROBE_TIERS, PARTS, type PartId } from './exploration-data'

const SHIP_KEY = 'astrogame.shipTier'
const PROBE_KEY = 'astrogame.probeTier'
const PARTS_KEY = 'astrogame.ownedParts'
const EXPLORED_KEY = 'astrogame.explored'
const SCORE_KEY = 'astrogame.explorationScore'

function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // localStorage unavailable - progress just won't persist across reloads.
  }
}

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    // see writeNumber
  }
}

export function getShipTier(): number {
  return readNumber(SHIP_KEY)
}

export function getProbeTier(): number {
  return readNumber(PROBE_KEY)
}

export function getOwnedParts(): Set<PartId> {
  return readSet(PARTS_KEY) as Set<PartId>
}

export function hasPart(id: PartId): boolean {
  return getOwnedParts().has(id)
}

export function getExplorationScore(): number {
  return readNumber(SCORE_KEY)
}

export function isExplored(designation: string): boolean {
  return readSet(EXPLORED_KEY).has(designation)
}

// Buys the next ship tier (one step up from whatever's currently owned).
// Returns false if already maxed out or points are insufficient.
export function buyNextShipTier(): boolean {
  const next = SHIP_TIERS[getShipTier()] // tiers are 1-indexed, array is 0-indexed
  if (!next) return false
  if (!spendPoints(next.cost)) return false
  writeNumber(SHIP_KEY, next.tier)
  return true
}

export function buyNextProbeTier(): boolean {
  const next = PROBE_TIERS[getProbeTier()]
  if (!next) return false
  if (!spendPoints(next.cost)) return false
  writeNumber(PROBE_KEY, next.tier)
  return true
}

export function buyPart(id: PartId): boolean {
  if (hasPart(id)) return false
  const part = PARTS.find((p) => p.id === id)
  if (!part) return false
  if (!spendPoints(part.cost)) return false
  const owned = getOwnedParts()
  owned.add(id)
  writeSet(PARTS_KEY, owned)
  return true
}

// 0-1 확률. 장비(탐사선 단계 + 부품)가 좋을수록 성공률이 올라감, 95%로 상한.
export function getMissionSuccessChance(designation: string): number {
  const shipEntry = SHIP_TIERS.find((s) => s.designation === designation)
  if (!shipEntry) return 0

  const probeBonus = PROBE_TIERS[getProbeTier() - 1]?.successChanceBonus ?? 0
  const owned = getOwnedParts()
  const partsBonus = PARTS.filter((p) => owned.has(p.id)).reduce((sum, p) => sum + p.successChanceBonus, 0)

  return Math.min(0.95, shipEntry.baseSuccessChance + probeBonus + partsBonus)
}

// Runs a mission to `designation` (must already be reachable/equipped - the
// UI only shows the button when that's true). Returns the score awarded (0
// if this target was already explored before - replay is allowed but only
// pays out once, same dedup pattern as photo-mode's quiz completion).
export function exploreTarget(designation: string, crewed: boolean): number {
  const explored = readSet(EXPLORED_KEY)
  if (explored.has(designation)) return 0

  const shipEntry = SHIP_TIERS.find((s) => s.designation === designation)
  if (!shipEntry) return 0

  const probeBonus = PROBE_TIERS[getProbeTier() - 1]?.scoreBonus ?? 0
  const owned = getOwnedParts()
  const partsBonus = PARTS.filter((p) => owned.has(p.id) && p.id !== 'life-support').reduce((sum, p) => sum + p.scoreBonus, 0)

  let score = shipEntry.baseScore + probeBonus + partsBonus
  if (crewed && owned.has('life-support')) score *= 2

  explored.add(designation)
  writeSet(EXPLORED_KEY, explored)
  writeNumber(SCORE_KEY, getExplorationScore() + score)
  return score
}
