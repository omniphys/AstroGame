export interface PhotoSubject {
  // Matches a designation in object-search.ts's CURATED_OBJECTS exactly -
  // that's how photo-mode.ts looks up "is the current selection
  // photographable". 은하수(Sgr proxy)와 오리온자리(별자리 전체)는 줌인해서
  // 찍을 단일 피사체가 아니라서 여기엔 없음.
  designation: string
  label: string
  imageFile: string // public/photos/<slug>.jpg
  credit: string
  description: string
  quiz: {
    question: string
    options: string[]
    correctIndex: number
  }
}

// 이미지 출처: NASA(퍼블릭 도메인) / ESA-Hubble(CC BY 4.0) / STScI DSS(퍼블릭 도메인
// 아카이브 관측자료) - 전체 출처는 README.md License 섹션 참고.
export const PHOTO_SUBJECTS: PhotoSubject[] = [
  // --- 태양계 ---
  {
    designation: 'NAME Sun',
    label: '태양',
    imageFile: 'sun.jpg',
    credit: 'NASA/SDO (AIA)',
    description:
      '이 사진은 태양 표면 위로 솟아오른 뜨거운 플라스마(전리된 가스)가 자기장을 따라 고리 모양으로 휘어진 모습을 담고 있어요. 태양은 핵융합으로 스스로 빛을 내는 유일한 항성(별)로, 우리 태양계 질량의 99.8%를 차지합니다.',
    quiz: {
      question: '태양이 빛과 열을 내는 근본적인 에너지원은 무엇일까요?',
      options: ['화학 연소', '중력 수축', '핵융합 반응', '방사성 붕괴'],
      correctIndex: 2,
    },
  },
  {
    designation: 'NAME Moon',
    label: '달',
    imageFile: 'moon.jpg',
    credit: 'NASA/GSFC/Arizona State Univ. (LRO)',
    description:
      '이 모자이크 사진은 달 탐사선 LRO가 2주에 걸쳐 촬영한 1,300여 장의 사진을 이어붙인 것이에요. 달의 밝은 고지대와 어두운 현무암 평원(바다)의 대비가 뚜렷하게 보입니다.',
    quiz: {
      question: '달 표면의 어두운 부분(바다, Mare)은 무엇으로 이루어져 있을까요?',
      options: ['현무암(화산암)', '얼음', '소금 결정', '먼지만 쌓인 곳'],
      correctIndex: 0,
    },
  },
  {
    designation: 'NAME Mercury',
    label: '수성',
    imageFile: 'mercury.jpg',
    credit: 'NASA/Johns Hopkins University APL/Carnegie Institution of Washington',
    description:
      '2008년 메신저(MESSENGER) 탐사선이 수성을 스쳐 지나가며 촬영한 사진으로, 마리너 10호가 보지 못했던 영역을 처음으로 보여줍니다. 수성은 대기가 거의 없어 운석 충돌구가 그대로 남아있어요.',
    quiz: {
      question: '대기가 거의 없는 수성 표면의 낮과 밤 온도차는 어떨까요?',
      options: ['거의 없다', '지구와 비슷하다', '밤이 더 덥다', '태양계에서 가장 크다'],
      correctIndex: 3,
    },
  },
  {
    designation: 'NAME Venus',
    label: '금성',
    imageFile: 'venus.jpg',
    credit: 'NASA/JPL-Caltech (Mariner 10, 재처리: Kevin Gill)',
    description:
      '1974년 마리너 10호가 촬영한 금성 전체 모습으로, 최근 현대 기술로 다시 처리되었습니다. 표면은 안 보이고 황산 구름으로 뒤덮인 두꺼운 대기만 보여요.',
    quiz: {
      question: '금성이 태양계에서 가장 뜨거운 행성인 이유는?',
      options: ['두꺼운 이산화탄소 대기의 온실효과', '태양에서 가장 가깝기 때문', '자전 속도가 빠르기 때문', '화산 활동 때문'],
      correctIndex: 0,
    },
  },
  {
    designation: 'NAME Mars',
    label: '화성',
    imageFile: 'mars.jpg',
    credit: 'NASA/JPL/USGS (Viking)',
    description:
      "바이킹 궤도선이 촬영한 102장의 사진을 이어붙인 이 모자이크는 태양계 최대 협곡인 '매리너 계곡(Valles Marineris)'을 한눈에 보여줍니다. 길이가 약 4,000km로 미국 대륙을 가로지를 정도입니다.",
    quiz: {
      question: '화성 표면이 붉게 보이는 이유는 무엇일까요?',
      options: ['붉은 식물 때문', '표면의 산화철(녹) 때문', '대기 중 붉은 가스 때문', '태양빛 반사 때문'],
      correctIndex: 1,
    },
  },
  {
    designation: 'NAME Jupiter',
    label: '목성',
    imageFile: 'jupiter.jpg',
    credit: 'NASA, ESA, J. Westphal (Caltech)',
    description:
      '허블 우주망원경이 촬영한 목성의 모습으로, 300년 넘게 지속되고 있는 거대한 폭풍인 대적점(Great Red Spot)이 뚜렷하게 보입니다. 목성은 태양계에서 가장 큰 행성으로, 지구가 1,300개 넘게 들어갈 수 있습니다.',
    quiz: {
      question: '목성 표면의 거대한 붉은 반점(대적점)의 정체는 무엇일까요?',
      options: ['화산', '운석 충돌 자국', '얼음 지형', '수백 년째 계속되는 거대한 폭풍'],
      correctIndex: 3,
    },
  },
  {
    designation: 'NAME Saturn',
    label: '토성',
    imageFile: 'saturn.jpg',
    credit: 'NASA/JPL/Space Science Institute (Cassini)',
    description:
      '카시니 탐사선이 2004년 약 2시간에 걸쳐 촬영한 126장의 사진을 이어붙인 모자이크로, 고리 전체와 행성을 함께 담았습니다. 토성의 고리는 대부분 얼음과 암석 조각으로 이루어져 있어요.',
    quiz: {
      question: '토성의 고리는 주로 무엇으로 이루어져 있을까요?',
      options: ['얼음과 암석 조각', '가스', '먼지뿐', '금속'],
      correctIndex: 0,
    },
  },
  {
    designation: 'NAME Uranus',
    label: '천왕성',
    imageFile: 'uranus.jpg',
    credit: 'NASA, ESA, CSA, STScI (JWST)',
    description:
      "2023년 제임스웹 우주망원경이 적외선으로 촬영한 천왕성 사진으로, 13개의 고리 중 11개가 선명하게 보입니다. 천왕성은 자전축이 거의 옆으로 98도 기울어져 있어 '누워서 도는' 행성으로 유명해요.",
    quiz: {
      question: '천왕성의 특이한 점은 무엇일까요?',
      options: ['고리가 없다', '가장 뜨거운 행성이다', '자전축이 거의 옆으로 누워있다', '위성이 없다'],
      correctIndex: 2,
    },
  },
  {
    designation: 'NAME Neptune',
    label: '해왕성',
    imageFile: 'neptune.jpg',
    credit: 'NASA/JPL (Voyager 2)',
    description:
      "1989년 보이저 2호가 근접 통과 직전 촬영한 해왕성 사진으로, 거대한 폭풍인 대암점(Great Dark Spot)과 빠르게 움직이는 흰 구름 '스쿠터(Scooter)'가 보입니다. 해왕성은 태양계에서 바람이 가장 강한 행성입니다.",
    quiz: {
      question: "해왕성 표면에서 볼 수 있는 '대암점'은 무엇일까요?",
      options: ['운석 충돌구', '거대한 소용돌이 폭풍', '어두운 바다', '그림자 지역'],
      correctIndex: 1,
    },
  },

  // --- 별 (질문: 색) ---
  {
    designation: '* alf CMa',
    label: '시리우스',
    imageFile: 'sirius.jpg',
    credit: 'NASA, ESA, H. Bond (STScI), M. Barstow (University of Leicester)',
    description:
      '허블 우주망원경이 촬영한 시리우스 A와 그 짝별 시리우스 B(작은 하얀 점)입니다. 시리우스 A의 빛을 일부러 과다노출시켜 1만 배나 어두운 백색왜성 동반성을 드러냈습니다.',
    quiz: {
      question: '시리우스(큰개자리 알파별)의 실제 색깔은 무엇일까요?',
      options: ['청백색', '붉은색', '노란색', '주황색'],
      correctIndex: 0,
    },
  },
  {
    designation: '* alf UMi',
    label: '북극성',
    imageFile: 'polaris.jpg',
    credit: 'NASA, ESA, N. Evans (Harvard-Smithsonian CfA), H. Bond (STScI)',
    description:
      '북극성은 사실 세 개의 별로 이루어진 삼중성계입니다. 이 허블 사진은 그동안 중력의 흔들림으로만 존재가 추정되던 가까운 짝별을 처음으로 직접 포착했습니다.',
    quiz: {
      question: '북극성의 실제 색깔은?',
      options: ['붉은색', '황백색', '청색', '녹색'],
      correctIndex: 1,
    },
  },
  {
    designation: '* alf Lyr',
    label: '베가',
    imageFile: 'vega.jpg',
    credit: 'NASA, ESA, STScI, S. Wolff (University of Arizona)',
    description:
      '2024년 허블과 제임스웹이 함께 촬영한 베가 주변 먼지원반입니다. 행성이 있다면 생길 틈이 전혀 없을 만큼 매끄러워 과학자들을 놀라게 했습니다.',
    quiz: {
      question: '베가의 실제 색깔은?',
      options: ['주황색', '노란색', '청백색', '적색'],
      correctIndex: 2,
    },
  },
  {
    designation: '* bet Gem',
    label: '폴룩스',
    imageFile: 'pollux.jpg',
    credit: 'STScI Digitized Sky Survey',
    description:
      '폴룩스는 지구에서 너무 가깝고 밝아 허블 같은 정밀 관측 망원경으로는 오히려 세밀하게 찍기 어려워요. 이 사진은 실제 천문대의 하늘 전체 탐사(Digitized Sky Survey) 자료인데, 밝은 별이 사진 위에서 크게 번져 보이는 것도 실제 천체사진의 특징입니다.',
    quiz: {
      question: '폴룩스(쌍둥이자리 베타별)의 실제 색깔은?',
      options: ['청백색', '흰색', '주황색', '적색'],
      correctIndex: 2,
    },
  },
  {
    designation: '* alf Cyg',
    label: '데네브',
    imageFile: 'deneb.jpg',
    credit: 'STScI Digitized Sky Survey',
    description:
      '데네브는 은하수가 가장 짙은 백조자리 방향에 있어, 사진 주변에 자잘한 배경별이 가득합니다. 아주 멀리 있지만(약 2,600광년) 워낙 밝은 초거성이라 맨눈으로도 또렷이 보입니다.',
    quiz: {
      question: '데네브의 실제 색깔은?',
      options: ['적색', '주황색', '노란색', '청백색'],
      correctIndex: 3,
    },
  },
  {
    designation: '* alf Ori',
    label: '베텔게우스',
    imageFile: 'betelgeuse.jpg',
    credit: 'A. Dupree (CfA), R. Gilliland (STScI), NASA, ESA',
    description:
      '1995년 허블이 태양이 아닌 별의 표면을 직접 분해 촬영한 최초의 사진입니다. 표면에 주변보다 2,000K 이상 뜨거운 거대한 열점이 보입니다.',
    quiz: {
      question: '베텔게우스의 실제 색깔은?',
      options: ['청백색', '노란색', '흰색', '적색'],
      correctIndex: 3,
    },
  },
  {
    designation: '* alf Cen',
    label: '알파 센타우리',
    imageFile: 'alpha-centauri.jpg',
    credit: 'ESA/Hubble & NASA',
    description:
      '허블이 촬영한 역대 최고 선명도의 알파 센타우리 A·B 사진입니다. 태양에서 가장 가까운 항성계로, 두 별은 약 80년에 한 번씩 서로를 공전합니다.',
    quiz: {
      question: '알파 센타우리 A(더 밝은 쪽)의 실제 색깔은?',
      options: ['청백색', '노란색', '적색', '주황색'],
      correctIndex: 1,
    },
  },

  // --- 심우주 천체 (질문: 종류) ---
  {
    designation: 'M 31',
    label: '안드로메다은하 (M31)',
    imageFile: 'm31.jpg',
    credit: 'NASA, ESA, J. Dalcanton, B.F. Williams, L.C. Johnson (PHAT team), R. Gendler',
    description:
      '안드로메다은하는 우리은하에서 가장 가까운 대형 나선은하로, 약 250만 광년 떨어져 있습니다. 맨눈으로도 희미하게 보일 만큼 밝고 크며, 두 개의 작은 위성은하(M32, M110)를 거느리고 있습니다.',
    quiz: {
      question: '안드로메다은하(M31)는 어떤 종류의 천체인가요?',
      options: ['나선은하', '구상성단', '발광성운', '행성상성운'],
      correctIndex: 0,
    },
  },
  {
    designation: 'M 42',
    label: '오리온성운 (M42)',
    imageFile: 'm42.jpg',
    credit: 'NASA, ESA, M. Robberto (STScI/ESA) and the HST Orion Treasury Project Team',
    description:
      '오리온성운은 맨눈으로도 희미하게 보이는 거대한 별 탄생 지역으로, 약 1,344광년 떨어져 있습니다. 중심부의 트라페지움 성단에서 나온 강한 자외선이 주변 가스를 이온화시켜 붉고 푸른 빛으로 빛나게 합니다.',
    quiz: {
      question: '오리온성운(M42)은 어떤 종류의 천체인가요?',
      options: ['나선은하', '산개성단', '구상성단', '발광성운'],
      correctIndex: 3,
    },
  },
  {
    designation: 'M 45',
    label: '플레이아데스 (M45)',
    imageFile: 'm45.jpg',
    credit: 'NASA and the Hubble Heritage Team (STScI/AURA)',
    description:
      '사진은 플레이아데스 성단의 밝은 별 메로페 주변을 감싼 푸른 반사성운의 모습입니다. 성단 전체는 맨눈으로도 또렷이 보이는 수백 개의 어린 별들의 무리로, 약 444광년 떨어져 있습니다.',
    quiz: {
      question: '플레이아데스(M45)는 어떤 종류의 천체인가요?',
      options: ['구상성단', '산개성단', '반사성운', '나선은하'],
      correctIndex: 1,
    },
  },
  {
    designation: 'M 22',
    label: '구상성단 (M22)',
    imageFile: 'm22.jpg',
    credit: 'ESA/Hubble & NASA',
    description:
      'M22는 궁수자리 방향에 있는 구상성단으로, 지구에서 볼 수 있는 구상성단 중 가장 밝은 것 중 하나입니다. 수십만 개의 별이 공 모양으로 빽빽하게 모여 있으며 나이가 120억 년이 넘는 매우 오래된 천체입니다.',
    quiz: {
      question: 'M22는 어떤 종류의 천체인가요?',
      options: ['산개성단', '발광성운', '구상성단', '암흑성운'],
      correctIndex: 2,
    },
  },
  {
    designation: 'IC 434',
    label: '말머리 성운 (IC 434)',
    imageFile: 'ic434.jpg',
    credit: 'NASA, NOAO, ESA, Hubble Heritage Team',
    description:
      '말머리 모양으로 유명한 이 영역은 사실 두 부분으로 이루어져 있습니다. 붉게 빛나는 발광성운 IC 434를 배경으로, 그 앞을 가리는 짙은 먼지구름(암흑성운, 바너드 33)이 말머리 모양의 그림자를 만듭니다.',
    quiz: {
      question: '말머리 성운이 보이는 배경의 붉은 가스 영역(IC 434)은 어떤 종류의 천체인가요?',
      options: ['발광성운', '반사성운', '산개성단', '나선은하'],
      correctIndex: 0,
    },
  },
  {
    designation: 'IC 2118',
    label: '마녀머리 성운 (IC 2118)',
    imageFile: 'ic2118.jpg',
    credit: 'NASA/JPL-Caltech (WISE)',
    description:
      '마녀머리 성운은 오리온자리의 밝은 별 리겔에서 나온 빛이 먼지 구름에 반사되어 푸르스름하게 빛나는 반사성운입니다. 구부러진 모양이 마녀의 옆모습을 닮아 이런 이름이 붙었습니다.',
    quiz: {
      question: '마녀머리 성운(IC 2118)은 어떤 종류의 천체인가요?',
      options: ['발광성운', '암흑성운', '구상성단', '반사성운'],
      correctIndex: 3,
    },
  },
]
