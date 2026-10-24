const POINTS_KEY = 'astrogame.points'
const COMPLETED_KEY = 'astrogame.completedPhotos'
const FAILED_KEY = 'astrogame.failedPhotos'
const POINTS_PER_CORRECT_ANSWER = 10

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
    // localStorage unavailable (private browsing, quota, etc) - progress just
    // won't persist across reloads, not worth surfacing to the player.
  }
}

export function getPoints(): number {
  try {
    return Number(localStorage.getItem(POINTS_KEY)) || 0
  } catch {
    return 0
  }
}

export function hasCompleted(designation: string): boolean {
  return readSet(COMPLETED_KEY).has(designation)
}

// 한 번이라도 오답을 제출한 적이 있는지 - 이후 정답을 맞혀도 포인트는 주지
// 않는다(답을 한 번 보여준 뒤라 다시 맞히는 게 실력이 아니라 암기이기 때문).
export function hasFailedOnce(designation: string): boolean {
  return readSet(FAILED_KEY).has(designation)
}

export function markFailed(designation: string) {
  const failed = readSet(FAILED_KEY)
  if (failed.has(designation)) return
  failed.add(designation)
  writeSet(FAILED_KEY, failed)
}

// Returns the number of points actually awarded (0 if already completed or
// previously answered incorrectly, so the popup can tell the player whether
// this answer counted).
export function markCompleted(designation: string): number {
  const completed = readSet(COMPLETED_KEY)
  if (completed.has(designation) || hasFailedOnce(designation)) return 0

  completed.add(designation)
  writeSet(COMPLETED_KEY, completed)

  const points = getPoints() + POINTS_PER_CORRECT_ANSWER
  try {
    localStorage.setItem(POINTS_KEY, String(points))
  } catch {
    // see writeSet
  }
  return POINTS_PER_CORRECT_ANSWER
}

// Deducts points for a purchase if the balance covers it; returns false
// (balance untouched) otherwise.
export function spendPoints(amount: number): boolean {
  const current = getPoints()
  if (current < amount) return false
  try {
    localStorage.setItem(POINTS_KEY, String(current - amount))
  } catch {
    // see writeCompleted
  }
  return true
}
