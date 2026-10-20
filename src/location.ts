import type { StelInstance } from './engine'

// Points the observer at the browser's geolocation, if granted. Falls back to
// whatever default location the engine ships with (resolves either way, so
// callers don't need to branch on success/failure).
export function initObserverLocation(stel: StelInstance): Promise<void> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve()
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const observer = stel.core.observer
        observer.latitude = pos.coords.latitude * stel.D2R
        observer.longitude = pos.coords.longitude * stel.D2R
        if (typeof pos.coords.altitude === 'number' && pos.coords.altitude > 0) {
          observer.elevation = pos.coords.altitude
        }
        resolve()
      },
      () => resolve(),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    )
  })
}
