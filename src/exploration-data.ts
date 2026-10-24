// 이미지는 public/items/*.svg 실제 파일을 참조 - 나중에 다른 그림으로 바꾸고
// 싶으면 같은 경로에 파일만 교체하면 됨(코드 수정 불필요).

import type { ApproachKind, ApproachFailureReason, LandingSurfaceKind } from './approach-minigame-sim'

export interface ShipTier {
  tier: number // 1-8, 누적 소유(8단계를 사면 1-7단계도 전부 보유한 것으로 침)
  label: string
  designation: string // object-search.ts의 CURATED_OBJECTS와 동일 - 도달 가능해지는 대상
  targetLabel: string
  cost: number
  baseScore: number // 그 대상을 처음 탐사할 때 받는 기본 탐사 점수
  baseEasiness: number // 0-1, 그 대상의 기본 난이도(미니게임을 얼마나 너그럽게 만들지의 기준) - 높을수록 쉬움
  approachKind: ApproachKind // 암석형(착륙) vs 가스/얼음 거대행성(궤도 진입) - 최종 접근 미니게임 종류를 결정
  imageFile: string
  // public/textures/planets/*.jpg - solar-system-3d.ts의 3D 뷰에 쓰는 것과 같은
  // 구체 텍스처(천구/3D 뷰에 실제로 쓰이는 이미지). 촬영 모드의 실사진(photo-subjects)과
  // 달리 작은 원형 아이콘으로 쓰기 좋게 구형 맵이라 비행 애니메이션의 출발/도착
  // 마커에는 이쪽을 씀.
  globeTextureFile: string
  // approachKind가 'landing'인 천체에서만 쓰임 - 착륙 미니게임의 지면을 그
  // 천체 표면처럼 보이게 그리는 데 쓰는 질감 종류와 기본 색.
  landingSurfaceKind?: LandingSurfaceKind
  landingSurfaceColor?: string
  blurb: string
}

// 현대 발사체/추진 기술에 느슨하게 기반한 이름 + SF 느낌 가미. 수성이 금성보다
// 기본점수가 높은 건 실제로 수성 도달에 더 많은 델타V가 필요하기 때문.
export const SHIP_TIERS: ShipTier[] = [
  { tier: 1, label: '루나 I호', designation: 'NAME Moon', targetLabel: '달', cost: 15, baseScore: 10, baseEasiness: 0.9, approachKind: 'landing', imageFile: 'ship-1.svg', globeTextureFile: '2k_moon.jpg', landingSurfaceKind: 'cratered', landingSurfaceColor: '#9a9a9a', blurb: '화학 추진 로켓. 지구 저궤도를 넘어 달까지 보낼 수 있는 첫 발사체.' },
  { tier: 2, label: '헬리오스 드라이브', designation: 'NAME Mercury', targetLabel: '수성', cost: 20, baseScore: 25, baseEasiness: 0.65, approachKind: 'landing', imageFile: 'ship-2.svg', globeTextureFile: '2k_mercury.jpg', landingSurfaceKind: 'cratered', landingSurfaceColor: '#8c7a6b', blurb: '태양 근접 궤도에 진입하려면 막대한 감속이 필요해 오히려 화성보다 어려운 목적지.' },
  { tier: 3, label: '금성 내열 글라이더', designation: 'NAME Venus', targetLabel: '금성', cost: 20, baseScore: 20, baseEasiness: 0.75, approachKind: 'landing', imageFile: 'ship-3.svg', globeTextureFile: '2k_venus_surface.jpg', landingSurfaceKind: 'hazy', landingSurfaceColor: '#e3cf7a', blurb: '고온·고압 대기를 견디는 내열 차폐막을 두른 궤도선.' },
  { tier: 4, label: '레드 패스파인더', designation: 'NAME Mars', targetLabel: '화성', cost: 25, baseScore: 20, baseEasiness: 0.75, approachKind: 'landing', imageFile: 'ship-4.svg', globeTextureFile: '2k_mars.jpg', landingSurfaceKind: 'desert', landingSurfaceColor: '#b2502f', blurb: '착륙 보조 추진체가 달린 화성 개척용 발사체.' },
  { tier: 5, label: '갈릴레오 Ⅱ 중추진선', designation: 'NAME Jupiter', targetLabel: '목성', cost: 35, baseScore: 40, baseEasiness: 0.6, approachKind: 'orbit', imageFile: 'ship-5.svg', globeTextureFile: '2k_jupiter.jpg', blurb: '강한 중력권을 돌파할 대형 추진 모듈을 장착.' },
  { tier: 6, label: '크로노스 게이트', designation: 'NAME Saturn', targetLabel: '토성', cost: 40, baseScore: 50, baseEasiness: 0.55, approachKind: 'orbit', imageFile: 'ship-6.svg', globeTextureFile: '2k_saturn.jpg', blurb: '고리 궤도를 안전하게 통과하는 항법 보정 링 탑재.' },
  { tier: 7, label: '아이스 자이언트 익스플로러', designation: 'NAME Uranus', targetLabel: '천왕성', cost: 50, baseScore: 65, baseEasiness: 0.45, approachKind: 'orbit', imageFile: 'ship-7.svg', globeTextureFile: '2k_uranus.jpg', blurb: '장거리 항행을 위한 이온 추진 엔진 실험기.' },
  { tier: 8, label: '트리톤 호라이즌', designation: 'NAME Neptune', targetLabel: '해왕성', cost: 60, baseScore: 80, baseEasiness: 0.4, approachKind: 'orbit', imageFile: 'ship-8.svg', globeTextureFile: '2k_neptune.jpg', blurb: '태양계 최장거리 항행용 차세대 추진 시스템 탑재.' },
]

// 출발 지점(지구) 아이콘에 쓰는 구체 텍스처 - public/textures/planets/*.jpg.
export const EARTH_GLOBE_TEXTURE_FILE = '2k_earth_daymap.jpg'

export interface ProbeTier {
  tier: number // 1-3
  label: string
  cost: number
  scoreBonus: number
  fuelBonus: number // 접근 미니게임에서 쓸 수 있는 연료 보너스(초 단위)
  imageFile: string
  blurb: string
}

export const PROBE_TIERS: ProbeTier[] = [
  { tier: 1, label: '기본 로버', cost: 15, scoreBonus: 0, fuelBonus: 0, imageFile: 'probe-1.svg', blurb: '바퀴로 이동하며 기본적인 표면 조사를 수행.' },
  { tier: 2, label: '궤도 관측선', cost: 35, scoreBonus: 5, fuelBonus: 2, imageFile: 'probe-2.svg', blurb: '궤도를 돌며 넓은 영역을 관측 - 가스 행성에도 투입 가능.' },
  { tier: 3, label: '정밀 다목적 탐사선', cost: 60, scoreBonus: 15, fuelBonus: 5, imageFile: 'probe-3.svg', blurb: '착륙·궤도 관측을 모두 수행하는 고성능 복합 탐사선.' },
]

export type PartId = 'booster' | 'life-support' | 'instruments'

export interface Part {
  id: PartId
  label: string
  cost: number
  scoreBonus: number // instruments/booster: 탐사마다 고정 보너스
  fuelBonus: number // 접근 미니게임에서 쓸 수 있는 연료 보너스(초 단위)
  toleranceBonus: number // 착륙 지점/궤도 허용 범위를 넓혀주는 보너스
  imageFile: string
  blurb: string
}

export const PARTS: Part[] = [
  { id: 'booster', label: '추진 부스터', cost: 20, scoreBonus: 5, fuelBonus: 4, toleranceBonus: 0, imageFile: 'part-booster.svg', blurb: '추력과 연료 탱크를 늘려 탐사마다 약간의 추가 성과를 얻고, 접근 미니게임에서 쓸 수 있는 연료도 늘어남.' },
  { id: 'life-support', label: '생명유지 모듈', cost: 40, scoreBonus: 0, fuelBonus: 2, toleranceBonus: 0, imageFile: 'part-life-support.svg', blurb: '유인 탐사를 가능하게 함 - 유인으로 탐사하면 점수가 두 배. 이중 안전장치로 예비 연료도 조금 더 실림.' },
  { id: 'instruments', label: '정밀 관측 장비', cost: 30, scoreBonus: 10, fuelBonus: 0, toleranceBonus: 12, imageFile: 'part-instruments.svg', blurb: '더 정확한 데이터를 수집해 탐사마다 추가 점수를 얻고, 정밀 접근으로 착륙/궤도 목표 범위도 넓어짐.' },
]

export interface RankTitle {
  minScore: number
  title: string
}

export const RANK_TITLES: RankTitle[] = [
  { minScore: 0, title: '견습 우주 비행사' },
  { minScore: 30, title: '정식 탐사대원' },
  { minScore: 80, title: '베테랑 탐사대장' },
  { minScore: 150, title: '수석 우주 항해사' },
  { minScore: 250, title: '태양계 개척자' },
  { minScore: 400, title: '은하 탐험가' },
]

// 비행 애니메이션 동안 번갈아 보여줄 상태 문구. 탐사선 분리 시점은
// exploration-mission.ts가 목표까지 거리의 90%(SHIP_TRAVEL_MS 경과 시점) 기준으로
// 직접 계산하고, 이 문구 배열과는 느슨하게만 맞춰져 있음(정확히 동기화되지 않아도
// "탐사선 분리" 문구가 뜨는 구간과 실제 분리 시점이 충분히 가까움).
export const MISSION_PHASES: string[] = [
  '발사 준비 완료 - 카운트다운 시작',
  '발사! 지구 중력권 이탈 중',
  '항행 중 - 궤도 보정 수행',
  '목표 항성계 접근 중',
  '탐사선 분리 - 최종 접근 시작',
  '관측/착륙 시퀀스 진입',
]

// 최종 접근 미니게임에서 실제로 무엇이 잘못됐는지에 맞춘 실패 문구.
export const APPROACH_FAILURE_REASONS: Record<ApproachFailureReason, string> = {
  'off-target': '착륙 지점을 벗어난 채로 내려앉았습니다.',
  overspeed: '착지 속도가 너무 빨라 충돌했습니다.',
  'out-of-fuel': '연료가 바닥나 접근에 실패했습니다.',
  crashed: '궤도 반경이 너무 줄어들어 행성과 충돌했습니다.',
  escaped: '속도를 너무 많이 높여 궤도를 벗어나 우주로 날아가 버렸습니다.',
}

export function rankForScore(score: number): string {
  let title = RANK_TITLES[0].title
  for (const rank of RANK_TITLES) {
    if (score >= rank.minScore) title = rank.title
  }
  return title
}
