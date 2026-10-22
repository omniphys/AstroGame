import type { StelInstance } from './engine'
import { SHIP_TIERS, PROBE_TIERS, PARTS, rankForScore, type PartId } from './exploration-data'
import {
  getShipTier,
  getProbeTier,
  hasPart,
  getExplorationScore,
  isExplored,
  buyNextShipTier,
  buyNextProbeTier,
  buyPart,
  getMissionSuccessChance,
} from './exploration-state'
import { createMissionRunner } from './exploration-mission'
import { getPoints } from './points'
import { playPurchase, playDenied } from './sound'

function playPurchaseResult(bought: boolean) {
  if (bought) playPurchase()
  else playDenied()
}

function itemCardHtml(opts: {
  imageFile: string
  title: string
  blurb: string
  status: string
  actionHtml: string
}): string {
  return `
    <div class="item-card">
      <img class="item-icon" src="/items/${opts.imageFile}" alt="${opts.title}">
      <div class="item-info">
        <div class="item-title">${opts.title}</div>
        <div class="item-blurb">${opts.blurb}</div>
        <div class="item-status">${opts.status}</div>
        ${opts.actionHtml}
      </div>
    </div>
  `
}

export function createExplorationMode(stel: StelInstance): void {
  const button = document.createElement('button')
  button.className = 'exploration-button'
  button.textContent = '🚀 탐사 기지'
  document.querySelector('#view-buttons')?.appendChild(button)

  const overlay = document.createElement('div')
  overlay.id = 'exploration-overlay'
  document.body.appendChild(overlay)

  const runMission = createMissionRunner(stel, () => {
    overlay.classList.add('visible')
    render()
  })

  function render() {
    const points = getPoints()
    const shipTier = getShipTier()
    const probeTier = getProbeTier()
    const score = getExplorationScore()
    const rank = rankForScore(score)

    const nextShip = SHIP_TIERS[shipTier]
    const shipStatus = shipTier === 0 ? '미보유' : `${SHIP_TIERS[shipTier - 1].label} (${SHIP_TIERS[shipTier - 1].targetLabel}까지)`
    const shipAction = nextShip
      ? `<button class="item-buy" data-action="buy-ship">${nextShip.label} 구매 (${nextShip.cost}P)</button>`
      : `<div class="item-maxed">최고 단계 보유 중</div>`

    const nextProbe = PROBE_TIERS[probeTier]
    const probeStatus = probeTier === 0 ? '미보유' : PROBE_TIERS[probeTier - 1].label
    const probeAction = nextProbe
      ? `<button class="item-buy" data-action="buy-probe">${nextProbe.label} 구매 (${nextProbe.cost}P)</button>`
      : `<div class="item-maxed">최고 단계 보유 중</div>`

    const partsHtml = PARTS.map((part) => {
      const owned = hasPart(part.id)
      return itemCardHtml({
        imageFile: part.imageFile,
        title: part.label,
        blurb: part.blurb,
        status: owned ? '보유 중' : '미보유',
        actionHtml: owned
          ? ''
          : `<button class="item-buy" data-action="buy-part" data-part="${part.id}">구매 (${part.cost}P)</button>`,
      })
    }).join('')

    const canExplore = probeTier > 0
    const targetsHtml = SHIP_TIERS.map((ship) => {
      const reachable = shipTier >= ship.tier
      const explored = isExplored(ship.designation)
      let status: string
      let action: string
      if (explored) {
        status = '✅ 탐사 완료'
        action = ''
      } else if (!reachable) {
        status = '🔒 우주선 단계 부족'
        action = ''
      } else if (!canExplore) {
        status = '탐사선이 필요합니다'
        action = ''
      } else {
        const chancePercent = Math.round(getMissionSuccessChance(ship.designation) * 100)
        status = `예상 점수 약 ${ship.baseScore}+ · 성공 확률 ${chancePercent}%`
        const crewedOption = hasPart('life-support')
          ? `<label class="crewed-toggle"><input type="checkbox" data-crewed="${ship.designation}"> 유인 탐사(점수 2배)</label>`
          : ''
        action = `${crewedOption}<button class="item-buy" data-action="explore" data-target="${ship.designation}">탐사 시작</button>`
      }
      return itemCardHtml({ imageFile: ship.imageFile, title: ship.targetLabel, blurb: ship.blurb, status, actionHtml: action })
    }).join('')

    overlay.innerHTML = `
      <div id="exploration-panel">
        <button id="exploration-close">✕</button>
        <div class="exploration-header">
          <div class="stat-chip stat-points">
            <span class="stat-icon">💰</span>
            <div>
              <div class="stat-label">보유 포인트</div>
              <div class="stat-value">${points}<span class="stat-unit">P</span></div>
            </div>
          </div>
          <div class="stat-chip stat-rank">
            <span class="stat-icon">🏅</span>
            <div>
              <div class="stat-label">명예 등급</div>
              <div class="stat-value">${rank}</div>
              <div class="stat-sub">탐사 점수 ${score}</div>
            </div>
          </div>
        </div>
        <div class="exploration-body">
          <section>
            <h3>보유 장비</h3>
            <div class="item-grid">
              ${itemCardHtml({ imageFile: shipTier > 0 ? SHIP_TIERS[shipTier - 1].imageFile : 'ship-1.svg', title: '우주선', blurb: nextShip ? `다음: ${nextShip.blurb}` : '모든 단계를 보유하고 있습니다.', status: shipStatus, actionHtml: shipAction })}
              ${itemCardHtml({ imageFile: probeTier > 0 ? PROBE_TIERS[probeTier - 1].imageFile : 'probe-1.svg', title: '탐사선', blurb: nextProbe ? `다음: ${nextProbe.blurb}` : '모든 단계를 보유하고 있습니다.', status: probeStatus, actionHtml: probeAction })}
            </div>
            <h3>부품</h3>
            <div class="item-grid">${partsHtml}</div>
          </section>
          <section>
            <h3>탐사 대상 (달 · 태양계 행성)</h3>
            <div class="item-grid">${targetsHtml}</div>
          </section>
        </div>
      </div>
    `

    overlay.querySelector('#exploration-close')!.addEventListener('click', close)
    overlay.querySelector('[data-action="buy-ship"]')?.addEventListener('click', () => {
      playPurchaseResult(buyNextShipTier())
      render()
    })
    overlay.querySelector('[data-action="buy-probe"]')?.addEventListener('click', () => {
      playPurchaseResult(buyNextProbeTier())
      render()
    })
    overlay.querySelectorAll<HTMLButtonElement>('[data-action="buy-part"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        playPurchaseResult(buyPart(btn.dataset.part as PartId))
        render()
      })
    })
    overlay.querySelectorAll<HTMLButtonElement>('[data-action="explore"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const designation = btn.dataset.target!
        const crewedBox = overlay.querySelector<HTMLInputElement>(`input[data-crewed="${designation}"]`)
        const shipImageFile = SHIP_TIERS[getShipTier() - 1].imageFile
        overlay.classList.remove('visible')
        runMission(designation, shipImageFile, !!crewedBox?.checked)
      })
    })
  }

  function open() {
    render()
    overlay.classList.add('visible')
  }

  function close() {
    overlay.classList.remove('visible')
  }

  button.addEventListener('click', open)
}
