import type { StelInstance } from './engine'
import { MISSION_PHASES, MISSION_FAILURE_REASONS, PROBE_TIERS } from './exploration-data'
import { PHOTO_SUBJECTS } from './photo-subjects'
import { getMissionSuccessChance, exploreTarget, getProbeTier } from './exploration-state'

const FLIGHT_DURATION_MS = 10_000
const PHASE_INTERVAL_MS = FLIGHT_DURATION_MS / MISSION_PHASES.length

// 네 번째 문구("탐사선 분리")가 뜨는 시점(= index 4/전체 문구 수)에 맞춰 탐사선이
// 우주선에서 떨어져 나가는 연출이 시작됨.
const SEPARATION_PROGRESS = 4 / MISSION_PHASES.length

const START_LEFT = 6 // %
const SEPARATION_LEFT = 66 // % - 우주선이 멈추고 탐사선이 분리되는 지점
const ARRIVAL_LEFT = 90 // % - 탐사선이 행성에 도달하는 지점

export function createMissionRunner(stel: StelInstance, onResolved: () => void): (designation: string, shipImageFile: string, crewed: boolean) => void {
  const flightOverlay = document.createElement('div')
  flightOverlay.id = 'mission-flight-overlay'
  flightOverlay.innerHTML = `
    <div class="mission-track">
      <div class="mission-earth">🌍</div>
      <img class="mission-ship">
      <img class="mission-probe">
      <img class="mission-planet-marker">
    </div>
    <div class="mission-status"></div>
    <div class="mission-progress"><div class="mission-progress-fill"></div></div>
  `
  document.body.appendChild(flightOverlay)

  const revealOverlay = document.createElement('div')
  revealOverlay.id = 'mission-reveal-overlay'
  document.body.appendChild(revealOverlay)

  const shipImg = flightOverlay.querySelector<HTMLImageElement>('.mission-ship')!
  const probeImg = flightOverlay.querySelector<HTMLImageElement>('.mission-probe')!
  const planetMarker = flightOverlay.querySelector<HTMLImageElement>('.mission-planet-marker')!
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
    const subject = PHOTO_SUBJECTS.find((s) => s.designation === designation)
    const probeTier = PROBE_TIERS[getProbeTier() - 1]

    shipImg.src = `/items/${shipImageFile}`
    probeImg.src = `/items/${(probeTier ?? PROBE_TIERS[0]).imageFile}`
    planetMarker.src = subject ? `/photos/${subject.imageFile}` : ''
    planetMarker.alt = subject?.label ?? ''

    statusEl.textContent = MISSION_PHASES[0]
    progressFill.style.transition = 'none'
    progressFill.style.width = '0%'
    shipImg.style.transition = 'none'
    shipImg.style.left = `${START_LEFT}%`
    probeImg.style.transition = 'none'
    probeImg.style.left = `${START_LEFT}%`
    probeImg.classList.remove('visible')

    flightOverlay.classList.add('visible')

    // Force layout so the transitions below actually animate from the reset
    // values above, instead of jumping straight to the end state.
    void flightOverlay.offsetWidth

    const separationDelayMs = FLIGHT_DURATION_MS * SEPARATION_PROGRESS
    const probeFlightMs = FLIGHT_DURATION_MS - separationDelayMs

    progressFill.style.transition = `width ${FLIGHT_DURATION_MS}ms linear`
    progressFill.style.width = '100%'
    shipImg.style.transition = `left ${separationDelayMs}ms linear`
    shipImg.style.left = `${SEPARATION_LEFT}%`

    let phaseIndex = 0
    const phaseTimer = setInterval(() => {
      phaseIndex = Math.min(phaseIndex + 1, MISSION_PHASES.length - 1)
      statusEl.textContent = MISSION_PHASES[phaseIndex]
    }, PHASE_INTERVAL_MS)

    // 탐사선 분리: 우주선이 도착한 지점에서 행성까지 남은 거리를 혼자 이동.
    setTimeout(() => {
      probeImg.style.left = `${SEPARATION_LEFT}%`
      probeImg.classList.add('visible')
      void probeImg.offsetWidth
      probeImg.style.transition = `left ${probeFlightMs}ms linear`
      probeImg.style.left = `${ARRIVAL_LEFT}%`
    }, separationDelayMs)

    setTimeout(() => {
      clearInterval(phaseTimer)
      flightOverlay.classList.remove('visible')
      resolveMission(designation, crewed)
    }, FLIGHT_DURATION_MS)
  }
}
