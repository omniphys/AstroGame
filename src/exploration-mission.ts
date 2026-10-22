import type { StelInstance } from './engine'
import { MISSION_PHASES, MISSION_FAILURE_REASONS } from './exploration-data'
import { PHOTO_SUBJECTS } from './photo-subjects'
import { getMissionSuccessChance, exploreTarget } from './exploration-state'

const FLIGHT_DURATION_MS = 10_000
const PHASE_INTERVAL_MS = FLIGHT_DURATION_MS / MISSION_PHASES.length

export function createMissionRunner(stel: StelInstance, onResolved: () => void): (designation: string, shipImageFile: string, crewed: boolean) => void {
  const flightOverlay = document.createElement('div')
  flightOverlay.id = 'mission-flight-overlay'
  flightOverlay.innerHTML = `
    <div class="mission-track">
      <div class="mission-earth">🌍</div>
      <img class="mission-ship">
      <div class="mission-target-marker">🛰️</div>
    </div>
    <div class="mission-status"></div>
    <div class="mission-progress"><div class="mission-progress-fill"></div></div>
  `
  document.body.appendChild(flightOverlay)

  const revealOverlay = document.createElement('div')
  revealOverlay.id = 'mission-reveal-overlay'
  document.body.appendChild(revealOverlay)

  const shipImg = flightOverlay.querySelector<HTMLImageElement>('.mission-ship')!
  const statusEl = flightOverlay.querySelector<HTMLDivElement>('.mission-status')!
  const progressFill = flightOverlay.querySelector<HTMLDivElement>('.mission-progress-fill')!

  function showReveal(html: string) {
    revealOverlay.innerHTML = `<div id="mission-reveal-card">${html}<button id="mission-reveal-close">확인</button></div>`
    revealOverlay.classList.add('visible')
    revealOverlay.querySelector('#mission-reveal-close')!.addEventListener('click', () => {
      revealOverlay.classList.remove('visible')
      onResolved()
    })
  }

  function resolveMission(designation: string, crewed: boolean) {
    const succeeded = Math.random() < getMissionSuccessChance(designation)

    if (!succeeded) {
      const reason = MISSION_FAILURE_REASONS[Math.floor(Math.random() * MISSION_FAILURE_REASONS.length)]
      showReveal(`
        <h2>🚨 탐사 실패</h2>
        <p class="mission-fail-reason">${reason}</p>
        <p class="mission-fail-note">장비를 보강하면 성공 확률이 올라갑니다. 다시 도전해 보세요!</p>
      `)
      return
    }

    const awarded = exploreTarget(designation, crewed)
    const obj = stel.getObj(designation)
    if (obj) {
      stel.core.selection = obj
      stel.pointAndLock(obj, 1.0)
    }

    const subject = PHOTO_SUBJECTS.find((s) => s.designation === designation)
    const discoveryHtml = subject
      ? `
        <img class="mission-discovery-image" src="/photos/${subject.imageFile}" alt="${subject.label}">
        <p class="mission-discovery-credit">사진: ${subject.credit}</p>
        <p class="mission-discovery-text">${subject.description}</p>
      `
      : ''
    showReveal(`
      <h2>🎉 탐사 성공!</h2>
      <p class="mission-success-note">탐사선이 보내온 새로운 관측 데이터입니다${crewed ? ' (유인 탐사 +2배 점수)' : ''}:</p>
      ${discoveryHtml}
      <p class="mission-score-note">+${awarded}점 획득</p>
    `)
  }

  return (designation: string, shipImageFile: string, crewed: boolean) => {
    shipImg.src = `/items/${shipImageFile}`
    statusEl.textContent = MISSION_PHASES[0]
    progressFill.style.transition = 'none'
    progressFill.style.width = '0%'
    shipImg.style.transition = 'none'
    shipImg.style.left = '6%'

    flightOverlay.classList.add('visible')

    // Force layout so the transition below actually animates from the reset
    // values above, instead of jumping straight to the end state.
    void flightOverlay.offsetWidth

    progressFill.style.transition = `width ${FLIGHT_DURATION_MS}ms linear`
    progressFill.style.width = '100%'
    shipImg.style.transition = `left ${FLIGHT_DURATION_MS}ms linear`
    shipImg.style.left = '88%'

    let phaseIndex = 0
    const phaseTimer = setInterval(() => {
      phaseIndex = Math.min(phaseIndex + 1, MISSION_PHASES.length - 1)
      statusEl.textContent = MISSION_PHASES[phaseIndex]
    }, PHASE_INTERVAL_MS)

    setTimeout(() => {
      clearInterval(phaseTimer)
      flightOverlay.classList.remove('visible')
      resolveMission(designation, crewed)
    }, FLIGHT_DURATION_MS)
  }
}
