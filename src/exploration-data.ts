// 이미지는 public/items/*.svg 실제 파일을 참조 - 나중에 다른 그림으로 바꾸고
// 싶으면 같은 경로에 파일만 교체하면 됨(코드 수정 불필요).

export interface ShipTier {
  tier: number // 1-8, 누적 소유(8단계를 사면 1-7단계도 전부 보유한 것으로 침)
  label: string
  designation: string // object-search.ts의 CURATED_OBJECTS와 동일 - 도달 가능해지는 대상
  targetLabel: string
  cost: number
  baseScore: number // 그 대상을 처음 탐사할 때 받는 기본 탐사 점수
  baseSuccessChance: number // 0-1, 장비 없이 그 대상을 탐사할 때 기본 성공 확률 - 멀고 어려운 대상일수록 낮음
  imageFile: string
  // public/textures/planets/*.jpg - solar-system-3d.ts의 3D 뷰에 쓰는 것과 같은
  // 구체 텍스처(천구/3D 뷰에 실제로 쓰이는 이미지). 촬영 모드의 실사진(photo-subjects)과
  // 달리 작은 원형 아이콘으로 쓰기 좋게 구형 맵이라 비행 애니메이션의 출발/도착
  // 마커에는 이쪽을 씀.
  globeTextureFile: string
  blurb: string
}

// 현대 발사체/추진 기술에 느슨하게 기반한 이름 + SF 느낌 가미. 수성이 금성보다
// 기본점수가 높은 건 실제로 수성 도달에 더 많은 델타V가 필요하기 때문.
export const SHIP_TIERS: ShipTier[] = [
  { tier: 1, label: '루나 I호', designation: 'NAME Moon', targetLabel: '달', cost: 15, baseScore: 10, baseSuccessChance: 0.9, imageFile: 'ship-1.svg', globeTextureFile: '2k_moon.jpg', blurb: '화학 추진 로켓. 지구 저궤도를 넘어 달까지 보낼 수 있는 첫 발사체.' },
  { tier: 2, label: '헬리오스 드라이브', designation: 'NAME Mercury', targetLabel: '수성', cost: 20, baseScore: 25, baseSuccessChance: 0.65, imageFile: 'ship-2.svg', globeTextureFile: '2k_mercury.jpg', blurb: '태양 근접 궤도에 진입하려면 막대한 감속이 필요해 오히려 화성보다 어려운 목적지.' },
  { tier: 3, label: '금성 내열 글라이더', designation: 'NAME Venus', targetLabel: '금성', cost: 20, baseScore: 20, baseSuccessChance: 0.75, imageFile: 'ship-3.svg', globeTextureFile: '2k_venus_surface.jpg', blurb: '고온·고압 대기를 견디는 내열 차폐막을 두른 궤도선.' },
  { tier: 4, label: '레드 패스파인더', designation: 'NAME Mars', targetLabel: '화성', cost: 25, baseScore: 20, baseSuccessChance: 0.75, imageFile: 'ship-4.svg', globeTextureFile: '2k_mars.jpg', blurb: '착륙 보조 추진체가 달린 화성 개척용 발사체.' },
  { tier: 5, label: '갈릴레오 Ⅱ 중추진선', designation: 'NAME Jupiter', targetLabel: '목성', cost: 35, baseScore: 40, baseSuccessChance: 0.6, imageFile: 'ship-5.svg', globeTextureFile: '2k_jupiter.jpg', blurb: '강한 중력권을 돌파할 대형 추진 모듈을 장착.' },
  { tier: 6, label: '크로노스 게이트', designation: 'NAME Saturn', targetLabel: '토성', cost: 40, baseScore: 50, baseSuccessChance: 0.55, imageFile: 'ship-6.svg', globeTextureFile: '2k_saturn.jpg', blurb: '고리 궤도를 안전하게 통과하는 항법 보정 링 탑재.' },
  { tier: 7, label: '아이스 자이언트 익스플로러', designation: 'NAME Uranus', targetLabel: '천왕성', cost: 50, baseScore: 65, baseSuccessChance: 0.45, imageFile: 'ship-7.svg', globeTextureFile: '2k_uranus.jpg', blurb: '장거리 항행을 위한 이온 추진 엔진 실험기.' },
  { tier: 8, label: '트리톤 호라이즌', designation: 'NAME Neptune', targetLabel: '해왕성', cost: 60, baseScore: 80, baseSuccessChance: 0.4, imageFile: 'ship-8.svg', globeTextureFile: '2k_neptune.jpg', blurb: '태양계 최장거리 항행용 차세대 추진 시스템 탑재.' },
]

// 출발 지점(지구) 아이콘에 쓰는 구체 텍스처 - public/textures/planets/*.jpg.
export const EARTH_GLOBE_TEXTURE_FILE = '2k_earth_daymap.jpg'

export interface ProbeTier {
  tier: number // 1-3
  label: string
  cost: number
  scoreBonus: number
  successChanceBonus: number // 0-1, 탐사 성공 확률에 더해짐
  imageFile: string
  blurb: string
}

export const PROBE_TIERS: ProbeTier[] = [
  { tier: 1, label: '기본 로버', cost: 15, scoreBonus: 0, successChanceBonus: 0, imageFile: 'probe-1.svg', blurb: '바퀴로 이동하며 기본적인 표면 조사를 수행.' },
  { tier: 2, label: '궤도 관측선', cost: 35, scoreBonus: 5, successChanceBonus: 0.07, imageFile: 'probe-2.svg', blurb: '궤도를 돌며 넓은 영역을 관측 - 가스 행성에도 투입 가능.' },
  { tier: 3, label: '정밀 다목적 탐사선', cost: 60, scoreBonus: 15, successChanceBonus: 0.15, imageFile: 'probe-3.svg', blurb: '착륙·궤도 관측을 모두 수행하는 고성능 복합 탐사선.' },
]

export type PartId = 'booster' | 'life-support' | 'instruments'

export interface Part {
  id: PartId
  label: string
  cost: number
  scoreBonus: number // instruments/booster: 탐사마다 고정 보너스
  successChanceBonus: number // 0-1, 탐사 성공 확률에 더해짐
  imageFile: string
  blurb: string
}

export const PARTS: Part[] = [
  { id: 'booster', label: '추진 부스터', cost: 20, scoreBonus: 5, successChanceBonus: 0.07, imageFile: 'part-booster.svg', blurb: '추력과 적재량을 높여 탐사마다 약간의 추가 성과를 얻고, 항행 안정성도 높임.' },
  { id: 'life-support', label: '생명유지 모듈', cost: 40, scoreBonus: 0, successChanceBonus: 0.05, imageFile: 'part-life-support.svg', blurb: '유인 탐사를 가능하게 함 - 유인으로 탐사하면 점수가 두 배. 이중 안전장치로 성공률도 소폭 상승.' },
  { id: 'instruments', label: '정밀 관측 장비', cost: 30, scoreBonus: 10, successChanceBonus: 0.08, imageFile: 'part-instruments.svg', blurb: '더 정확한 데이터를 수집해 탐사마다 추가 점수를 얻고, 정밀 접근으로 실패 확률도 줄임.' },
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

// 10초 비행 애니메이션 동안 번갈아 보여줄 상태 문구. 네 번째 문구가 시작되는
// 시점에 맞춰 탐사선이 우주선에서 분리되는 연출이 일어남(exploration-mission.ts
// 의 SEPARATION_PROGRESS가 이 배열 길이에서 index 4/6 지점을 가리킴).
export const MISSION_PHASES: string[] = [
  '발사 준비 완료 - 카운트다운 시작',
  '발사! 지구 중력권 이탈 중',
  '항행 중 - 궤도 보정 수행',
  '목표 항성계 접근 중',
  '탐사선 분리 - 최종 접근 시작',
  '관측/착륙 시퀀스 진입',
]

// 탐사 실패 시 무작위로 보여줄 돌발 상황.
export const MISSION_FAILURE_REASONS: string[] = [
  '통신이 갑자기 두절되었습니다.',
  '예상치 못한 소행성체와 충돌할 뻔해 궤도를 긴급 이탈했습니다.',
  '주 엔진에 이상이 감지되어 임무를 중단했습니다.',
  '강한 우주 방사선으로 전자장비가 먹통이 되었습니다.',
  '착륙 지점의 지형이 예상보다 험해 접근을 포기했습니다.',
  '연료 소모가 계산보다 빨라 궤도 진입에 실패했습니다.',
]

export function rankForScore(score: number): string {
  let title = RANK_TITLES[0].title
  for (const rank of RANK_TITLES) {
    if (score >= rank.minScore) title = rank.title
  }
  return title
}
