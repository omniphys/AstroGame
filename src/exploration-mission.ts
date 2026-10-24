import type { StelInstance } from './engine'
import { MISSION_PHASES, APPROACH_FAILURE_REASONS, PROBE_TIERS, SHIP_TIERS, EARTH_GLOBE_TEXTURE_FILE, type ShipTier } from './exploration-data'
import { PHOTO_SUBJECTS } from './photo-subjects'
import { getBaseEasiness, getFuelBonus, getToleranceBonus, exploreTarget, getProbeTier } from './exploration-state'
import { createSoundToggle, playLaunchSound, playMissionMusic, playMissionSuccess, playMissionFailure } from './sound'
import { runApproachMinigame } from './approach-minigame'
import type { ApproachResult, ApproachTuning } from './approach-minigame-sim'

const LAUNCH_DURATION_MS = 1_200 // 지구 옆에서 분사하며 이륙 준비하는 시간
// 우주선이 목표까지 거리의 90%에 도달할 때까지 걸리는 시간, 그리고 탐사선이
// 분리되어 남은 10%를 혼자 날아가는(살짝 더 느긋하게, "최종 접근" 느낌으로) 시간.
// 전체 애니메이션이 정확히 10초일 필요는 없음 - 분리 시점을 거리 기준으로 맞추는
// 게 우선이라 다 합쳐 10초보다 길어짐.
const SHIP_TRAVEL_MS = 9_000
const PROBE_FINAL_MS = 3_000
const FLIGHT_DURATION_MS = SHIP_TRAVEL_MS + PROBE_FINAL_MS

// MISSION_PHASES의 각 문구를 "실제로 그 일이 일어나는 순간"에 직접 고정시키기
// 위한 타이밍(launch 종료 시점부터의 경과 ms). 일정 간격으로 흘러가는 타이머가
// 아니라, 발사/분리처럼 눈에 보이는 사건과 문구가 항상 같은 타이밍에 맞도록 함.
const PHASE_SCHEDULE_MS = [
  0, // '발사! 지구 중력권 이탈 중' - 발사 연출이 끝나고 우주선이 막 움직이기 시작하는 순간
  SHIP_TRAVEL_MS / 3, // '항행 중 - 궤도 보정 수행'
  (SHIP_TRAVEL_MS / 3) * 2, // '목표 항성계 접근 중'
  SHIP_TRAVEL_MS, // '탐사선 분리 - 최종 접근 시작' - 실제 분리 순간과 정확히 일치
  SHIP_TRAVEL_MS + PROBE_FINAL_MS / 2, // '관측/착륙 시퀀스 진입'
]

const START_LEFT = 6 // %
const SEPARATION_LEFT = 90 // % - 목표까지 거리의 90% 지점, 우주선이 멈추고 탐사선이 분리됨
const ARRIVAL_LEFT = 96 // % - 탐사선이 행성 마커에 도달하는 지점

export function createMissionRunner(stel: StelInstance, onResolved: () => void): (designation: string, shipImageFile: string, crewed: boolean) => void {
  const flightOverlay = document.createElement('div')
  flightOverlay.id = 'mission-flight-overlay'
  flightOverlay.innerHTML = `
    <div class="mission-track">
      <img class="mission-earth" src="/textures/planets/${EARTH_GLOBE_TEXTURE_FILE}" alt="지구">
      <div class="mission-exhaust"></div>
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

  const exhaustEl = flightOverlay.querySelector<HTMLDivElement>('.mission-exhaust')!
  const shipImg = flightOverlay.querySelector<HTMLImageElement>('.mission-ship')!
  const probeImg = flightOverlay.querySelector<HTMLImageElement>('.mission-probe')!
  const planetMarker = flightOverlay.querySelector<HTMLImageElement>('.mission-planet-marker')!
  const statusEl = flightOverlay.querySelector<HTMLDivElement>('.mission-status')!
  const progressFill = flightOverlay.querySelector<HTMLDivElement>('.mission-progress-fill')!
  flightOverlay.appendChild(createSoundToggle('sound-toggle'))

  function showReveal(html: string, onRetry?: () => void) {
    revealOverlay.innerHTML = `<div id="mission-reveal-card">${html}</div>`
    revealOverlay.classList.add('visible')
    revealOverlay.querySelector('#mission-reveal-close')!.addEventListener('click', () => {
      revealOverlay.classList.remove('visible')
      onResolved()
    })
    if (onRetry) {
      revealOverlay.querySelector('#mission-reveal-retry')!.addEventListener('click', () => {
        revealOverlay.classList.remove('visible')
        onRetry()
      })
    }
  }

  // 실패했을 때는 발사부터 다시 보여주는 게 아니라, 미니게임 자체를 처음부터
  // 다시 시작한다 - 탐사과정 애니메이션(발사-항행-분리)을 또 거치게 하면
  // 재도전할 때마다 10초 넘게 기다려야 해서 체감 난이도만 올라갈 뿐이다.
  function attempt(designation: string, crewed: boolean, ship: ShipTier, tuning: ApproachTuning) {
    runApproachMinigame(ship.approachKind, tuning, {
      planetTextureFile: ship.globeTextureFile,
      landingSurfaceKind: ship.landingSurfaceKind,
      landingSurfaceColor: ship.landingSurfaceColor,
    }).then((approach) => {
      resolveMission(designation, crewed, ship, tuning, approach)
    })
  }

  function resolveMission(designation: string, crewed: boolean, ship: ShipTier, tuning: ApproachTuning, approach: ApproachResult) {
    if (!approach.success) {
      playMissionFailure()
      const reason = APPROACH_FAILURE_REASONS[approach.reason]
      showReveal(
        `
        <h2>🚨 탐사 실패</h2>
        <p class="mission-fail-reason">${reason}</p>
        <p class="mission-fail-note">장비를 보강하면 접근 미니게임이 더 쉬워집니다.</p>
        <div class="mission-reveal-actions">
          <button id="mission-reveal-retry">다시 도전</button>
          <button id="mission-reveal-close">탐사 목록으로</button>
        </div>
      `,
        () => attempt(designation, crewed, ship, tuning),
      )
      return
    }

    playMissionSuccess()
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
      <button id="mission-reveal-close">확인</button>
    `)
  }

  return (designation: string, shipImageFile: string, crewed: boolean) => {
    const ship = SHIP_TIERS.find((s) => s.designation === designation)
    const probeTier = PROBE_TIERS[getProbeTier() - 1]

    shipImg.src = `/items/${shipImageFile}`
    probeImg.src = `/items/${(probeTier ?? PROBE_TIERS[0]).imageFile}`
    planetMarker.src = ship ? `/textures/planets/${ship.globeTextureFile}` : ''
    planetMarker.alt = ship?.targetLabel ?? ''

    // 초기 상태로 리셋 (발사 전: 우주선은 출발 지점에, 탐사선은 숨김, 분사 효과는
    // 아직 점화 전).
    statusEl.textContent = MISSION_PHASES[0]
    progressFill.style.transition = 'none'
    progressFill.style.width = '0%'
    shipImg.style.transition = 'none'
    shipImg.style.left = `${START_LEFT}%`
    probeImg.style.transition = 'none'
    probeImg.style.left = `${START_LEFT}%`
    probeImg.classList.remove('visible')
    exhaustEl.style.left = `${START_LEFT}%`
    exhaustEl.classList.remove('igniting')

    flightOverlay.classList.add('visible')

    // Force layout so the transitions below actually animate from the reset
    // values above, instead of jumping straight to the end state.
    void flightOverlay.offsetWidth

    // 진행률 바는 발사 준비부터 도착까지 전체 과정을 하나로 이어서 보여줌.
    progressFill.style.transition = `width ${LAUNCH_DURATION_MS + FLIGHT_DURATION_MS}ms linear`
    progressFill.style.width = '100%'

    // 1단계: 발사 - 우주선은 그 자리에, 바닥에서 가스를 분사하며 이륙을 준비.
    exhaustEl.classList.add('igniting')
    playLaunchSound(LAUNCH_DURATION_MS)

    setTimeout(() => {
      // 2단계: 이륙 - 분사 이펙트가 꺼지고 본격적인 항행이 시작됨. 문구도 바로
      // "발사!"로 바뀜 - 우주선이 이미 움직이기 시작했는데 "카운트다운" 문구가
      // 남아있는 일이 없도록.
      exhaustEl.classList.remove('igniting')
      statusEl.textContent = MISSION_PHASES[1]
      playMissionMusic(FLIGHT_DURATION_MS, SHIP_TRAVEL_MS)

      shipImg.style.transition = `left ${SHIP_TRAVEL_MS}ms linear`
      shipImg.style.left = `${SEPARATION_LEFT}%`

      // 나머지 문구들은 실제 사건(분리 등)과 같은 시각에 뜨도록 각각 고정 타이밍에 예약.
      const phaseTimers = PHASE_SCHEDULE_MS.slice(1).map((delay, i) =>
        setTimeout(() => (statusEl.textContent = MISSION_PHASES[i + 2]), delay),
      )

      // 탐사선 분리: 우주선이 거리의 90%에 도달한 지점에서 남은 10%를 혼자 이동.
      setTimeout(() => {
        probeImg.style.left = `${SEPARATION_LEFT}%`
        probeImg.classList.add('visible')
        void probeImg.offsetWidth
        probeImg.style.transition = `left ${PROBE_FINAL_MS}ms linear`
        probeImg.style.left = `${ARRIVAL_LEFT}%`
      }, SHIP_TRAVEL_MS)

      setTimeout(() => {
        phaseTimers.forEach(clearTimeout)
        flightOverlay.classList.remove('visible')
        const tuning = {
          baseEasiness: getBaseEasiness(designation),
          fuelBonus: getFuelBonus(),
          toleranceBonus: getToleranceBonus(),
        }
        attempt(designation, crewed, ship!, tuning)
      }, FLIGHT_DURATION_MS)
    }, LAUNCH_DURATION_MS)
  }
}
