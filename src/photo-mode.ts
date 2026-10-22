import type { StelInstance } from './engine'
import { PHOTO_SUBJECTS } from './photo-subjects'
import { createPhotoPopup } from './photo-popup'
import { getPoints } from './points'
import { playShutter } from './sound'

// How close the player needs to be zoomed in (field of view, radians)
// before the capture button appears. Tuned by feel, not a physical constant.
const CAPTURE_FOV_THRESHOLD_DEG = 5

export function createPhotoMode(stel: StelInstance): void {
  const pointsBadge = document.createElement('div')
  pointsBadge.id = 'points-badge'
  pointsBadge.className = 'stat-chip stat-points'
  document.body.appendChild(pointsBadge)
  function renderPoints(points: number) {
    pointsBadge.innerHTML = `
      <span class="stat-icon">💰</span>
      <div>
        <div class="stat-label">보유 포인트</div>
        <div class="stat-value">${points}<span class="stat-unit">P</span></div>
      </div>
    `
  }
  renderPoints(getPoints())

  const openPopup = createPhotoPopup(renderPoints)

  const canvas = document.querySelector<HTMLCanvasElement>('#stel-canvas')!
  const flash = document.createElement('div')
  flash.id = 'camera-flash'
  document.body.appendChild(flash)

  const captureButton = document.createElement('button')
  captureButton.id = 'capture-button'
  captureButton.textContent = '📷 촬영하기'
  document.body.appendChild(captureButton)

  let currentSubject: (typeof PHOTO_SUBJECTS)[number] | null = null

  function updateCaptureButton() {
    const sel = stel.core.selection
    const fovDeg = stel.core.fov / stel.D2R
    // designations()[0] is whatever the engine considers the "primary" name
    // (e.g. Sirius's is "Sirius", not the "* alf CMa" form getObj()/our
    // registry use) - match against the full list instead of just [0].
    const designations: string[] = sel ? sel.designations?.() ?? [sel.id] : []
    const subject = sel ? PHOTO_SUBJECTS.find((s) => designations.includes(s.designation)) : undefined

    currentSubject = subject ?? null
    captureButton.classList.toggle('visible', !!subject && fovDeg < CAPTURE_FOV_THRESHOLD_DEG)
  }

  stel.change((obj: any, attr: string) => {
    if (obj.path !== 'core' || (attr !== 'selection' && attr !== 'fov')) return
    updateCaptureButton()
  })

  captureButton.addEventListener('click', () => {
    if (!currentSubject) return
    const subject = currentSubject

    playShutter()
    canvas.classList.add('capturing')
    flash.classList.add('flashing')
    setTimeout(() => {
      canvas.classList.remove('capturing')
      flash.classList.remove('flashing')
      openPopup(subject)
    }, 300)
  })
}
