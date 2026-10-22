import type { StelInstance } from './engine'
import { PHOTO_SUBJECTS } from './photo-subjects'
import { createPhotoPopup } from './photo-popup'
import { getPoints } from './points'

// How close the player needs to be zoomed in (field of view, radians)
// before the capture button appears. Tuned by feel, not a physical constant.
const CAPTURE_FOV_THRESHOLD_DEG = 5

// A synthesized camera-shutter "click" (filtered noise burst) instead of a
// bundled audio file - no asset to source/license, and it's tiny.
function playShutterSound() {
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextCtor) return
  const ctx = new AudioContextCtor()

  const duration = 0.08
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    // Sharp decay envelope over white noise = a dry "click" rather than a hiss.
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) ** 2
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 2000

  const gain = ctx.createGain()
  gain.gain.value = 0.5

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  noise.start()
  noise.stop(ctx.currentTime + duration)
  noise.onended = () => ctx.close()
}

export function createPhotoMode(stel: StelInstance): void {
  const pointsBadge = document.createElement('div')
  pointsBadge.id = 'points-badge'
  document.body.appendChild(pointsBadge)
  function renderPoints(points: number) {
    pointsBadge.textContent = `📷 ${points} 포인트`
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

    playShutterSound()
    canvas.classList.add('capturing')
    flash.classList.add('flashing')
    setTimeout(() => {
      canvas.classList.remove('capturing')
      flash.classList.remove('flashing')
      openPopup(subject)
    }, 300)
  })
}
