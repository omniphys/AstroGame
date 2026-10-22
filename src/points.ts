const POINTS_KEY = 'astrogame.points'
const COMPLETED_KEY = 'astrogame.completedPhotos'
const POINTS_PER_CORRECT_ANSWER = 10

function readCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function writeCompleted(set: Set<string>) {
  try {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify([...set]))
  } catch {
    // localStorage unavailable (private browsing, quota, etc) - points just
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
  return readCompleted().has(designation)
}

// Returns the number of points actually awarded (0 if already completed,
// so the popup can tell the player whether this answer counted).
export function markCompleted(designation: string): number {
  const completed = readCompleted()
  if (completed.has(designation)) return 0

  completed.add(designation)
  writeCompleted(completed)

  const points = getPoints() + POINTS_PER_CORRECT_ANSWER
  try {
    localStorage.setItem(POINTS_KEY, String(points))
  } catch {
    // see writeCompleted
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
