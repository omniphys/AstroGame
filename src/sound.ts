// 게임의 모든 효과음과 음악. 음원 파일 없이 Web Audio로 직접 합성함 - 출처/
// 라이선스를 관리할 파일이 없고, 애니메이션 타이밍에 소리를 정확히 맞출 수 있음.
// 모든 소리가 하나의 master 볼륨을 거치므로 소리 끄기가 한 번에 적용됨.

const MUTED_KEY = 'astrogame.soundMuted'
const MASTER_VOLUME = 0.6

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = readMuted()
const toggleButtons: HTMLButtonElement[] = []

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

function renderToggle(button: HTMLButtonElement) {
  button.textContent = muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'
  button.classList.toggle('sound-toggle-muted', muted)
}

// 주 메뉴와 탐사 비행 화면에 각각 버튼이 있으므로, 어느 쪽을 눌러도 모든
// 버튼의 표시가 함께 바뀌도록 생성된 버튼을 모두 기억해 둠.
export function createSoundToggle(className: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = className
  renderToggle(button)
  button.addEventListener('click', () => setMuted(!muted))
  toggleButtons.push(button)
  return button
}

function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(MUTED_KEY, value ? '1' : '0')
  } catch {
    // 저장이 안 되면 새로고침 후 기본값(소리 켬)으로 돌아갈 뿐 - 굳이 알릴 필요 없음.
  }
  if (ctx && master) master.gain.setTargetAtTime(value ? 0 : MASTER_VOLUME, ctx.currentTime, 0.05)
  toggleButtons.forEach(renderToggle)
}

// 브라우저는 사용자 클릭 이전에 만든 AudioContext를 정지 상태로 두므로, 첫
// 버튼 클릭에서 처음 불릴 때 만들고 이후에는 재사용함.
function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  if (!ctx) {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) return null
    ctx = new AudioContextCtor() as AudioContext
    master = ctx.createGain()
    master.gain.value = muted ? 0 : MASTER_VOLUME
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return { ctx, master: master! }
}

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    if (brown) {
      // 백색 잡음을 누적(적분)하면 저음이 강한 갈색 잡음 - 로켓의 낮은 굉음에 가까움.
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      data[i] = white
    }
  }
  return buffer
}

function thump(ctx: AudioContext, out: AudioNode, at: number, level: number) {
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(70, at)
  osc.frequency.exponentialRampToValueAtTime(28, at + 0.6)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(level, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.8)
  osc.connect(gain).connect(out)
  osc.start(at)
  osc.stop(at + 0.8)
}

// 점화(굉음+분사음이 차오름) → liftoffMs에 이륙 충격음 → 우주선이 멀어지며
// 분사음이 낮아지고 잦아듦.
export function playLaunchSound(liftoffMs: number) {
  const audio = getAudio()
  if (!audio) return
  const { ctx, master } = audio
  const t0 = ctx.currentTime
  const liftoff = t0 + liftoffMs / 1000
  const end = liftoff + 3.5

  const rumble = ctx.createBufferSource()
  rumble.buffer = noiseBuffer(ctx, end - t0, true)
  const rumbleFilter = ctx.createBiquadFilter()
  rumbleFilter.type = 'lowpass'
  rumbleFilter.frequency.value = 180
  const rumbleGain = ctx.createGain()
  rumbleGain.gain.setValueAtTime(0.001, t0)
  rumbleGain.gain.exponentialRampToValueAtTime(1, liftoff)
  rumbleGain.gain.setValueAtTime(1, liftoff + 0.3)
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, end)
  rumble.connect(rumbleFilter).connect(rumbleGain).connect(master)

  const hiss = ctx.createBufferSource()
  hiss.buffer = noiseBuffer(ctx, end - t0, false)
  const hissFilter = ctx.createBiquadFilter()
  hissFilter.type = 'bandpass'
  hissFilter.Q.value = 0.8
  hissFilter.frequency.setValueAtTime(600, t0)
  hissFilter.frequency.linearRampToValueAtTime(1400, liftoff)
  hissFilter.frequency.exponentialRampToValueAtTime(300, end)
  const hissGain = ctx.createGain()
  hissGain.gain.setValueAtTime(0.001, t0)
  hissGain.gain.exponentialRampToValueAtTime(0.25, liftoff)
  hissGain.gain.exponentialRampToValueAtTime(0.001, end)
  hiss.connect(hissFilter).connect(hissGain).connect(master)

  thump(ctx, master, t0, 0.5)
  thump(ctx, master, liftoff, 0.9)

  rumble.start(t0)
  hiss.start(t0)
  rumble.stop(end)
  hiss.stop(end)
}

// D 리디안 계열의 열린 화음 - 해결되지 않고 떠 있는 느낌이라 우주 항행에 어울림.
const CHORDS = [
  [146.83, 220.0, 329.63, 440.0], // Dsus2 (D A E A)
  [123.47, 185.0, 293.66, 440.0], // Bm7 (B F# D A)
  [98.0, 196.0, 246.94, 369.99], // Gmaj7 (G G B F#)
  [110.0, 220.0, 329.63, 415.3], // A + G# (리디안 색채)
]
const SPARKLE_NOTES = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66] // D 펜타토닉+리디안 4도

function padChord(ctx: AudioContext, out: AudioNode, freqs: number[], start: number, length: number) {
  for (const freq of freqs) {
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 900
      const gain = ctx.createGain()
      // 앞뒤 화음이 겹치며 이어지도록 공격/감쇠를 길게.
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.04, start + 1.2)
      gain.gain.setValueAtTime(0.04, start + length - 0.2)
      gain.gain.linearRampToValueAtTime(0, start + length + 1.2)
      osc.connect(filter).connect(gain).connect(out)
      osc.start(start)
      osc.stop(start + length + 1.3)
    }
  }
}

function bell(ctx: AudioContext, out: AudioNode, freq: number, at: number, level: number, decay: number) {
  for (const [ratio, amp] of [[1, 1], [2.76, 0.3]]) {
    const osc = ctx.createOscillator()
    osc.frequency.value = freq * ratio
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(level * amp, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay)
    osc.connect(gain).connect(out)
    osc.start(at)
    osc.stop(at + decay)
  }
}

// 이륙 시점부터 durationMs 동안 흐르는 배경음악. 화음은 항행 구간을 고르게
// 나누고, separationMs(탐사선 분리)에 종소리 하나를 얹어 그 순간을 강조함.
export function playMissionMusic(durationMs: number, separationMs: number) {
  const audio = getAudio()
  if (!audio) return
  const { ctx, master } = audio
  const t0 = ctx.currentTime
  const duration = durationMs / 1000
  const end = t0 + duration

  const bus = ctx.createGain()
  bus.gain.setValueAtTime(0, t0)
  bus.gain.linearRampToValueAtTime(1, t0 + 1.5)
  bus.gain.setValueAtTime(1, end - 1.5)
  bus.gain.linearRampToValueAtTime(0, end)
  bus.connect(master)

  // 반짝이는 고음에 메아리를 줘서 공간감을 냄.
  const echo = ctx.createDelay()
  echo.delayTime.value = 0.375
  const feedback = ctx.createGain()
  feedback.gain.value = 0.4
  const echoOut = ctx.createGain()
  echoOut.gain.value = 0.5
  echo.connect(feedback).connect(echo)
  echo.connect(echoOut).connect(bus)

  const chordLength = duration / CHORDS.length
  CHORDS.forEach((chord, i) => padChord(ctx, bus, chord, t0 + i * chordLength, chordLength))

  for (let t = 1; t < duration - 2; t += 0.75) {
    const note = SPARKLE_NOTES[Math.floor(Math.random() * SPARKLE_NOTES.length)]
    const at = t0 + t
    bell(ctx, bus, note, at, 0.08, 1.2)
    bell(ctx, echo, note, at, 0.08, 1.2)
  }

  const separation = t0 + separationMs / 1000
  bell(ctx, bus, 1174.66, separation, 0.14, 3)
  bell(ctx, echo, 1174.66, separation, 0.14, 3)

  // 메아리 피드백 루프는 스스로 끝나지 않으므로 음악이 끝나면 끊어줌.
  setTimeout(() => {
    bus.disconnect()
    echo.disconnect()
  }, durationMs + 3000)
}

function tone(freq: number, at: number, length: number, opts: { type?: OscillatorType; level?: number; out?: AudioNode } = {}) {
  const audio = getAudio()
  if (!audio) return
  const { ctx, master } = audio
  const start = ctx.currentTime + at
  const osc = ctx.createOscillator()
  osc.type = opts.type ?? 'triangle'
  osc.frequency.value = freq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(opts.level ?? 0.3, start + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(gain).connect(opts.out ?? master)
  osc.start(start)
  osc.stop(start + length)
}

export function playClick() {
  tone(1320, 0, 0.06, { type: 'sine', level: 0.2 })
}

// 동전 소리처럼 짧게 위로 올라가는 두 음.
export function playPurchase() {
  tone(987.77, 0, 0.12, { type: 'square', level: 0.3 })
  tone(1318.51, 0.08, 0.35, { type: 'square', level: 0.3 })
}

// 낮고 탁한 음 두 번 - "안 돼요" 느낌의 버저.
export function playDenied() {
  const audio = getAudio()
  if (!audio) return
  const { ctx, master } = audio
  // 사각파의 날카로운 배음을 깎아서 귀에 거슬리지 않는 둔한 버저 소리로.
  const muffle = ctx.createBiquadFilter()
  muffle.type = 'lowpass'
  muffle.frequency.value = 900
  muffle.connect(master)
  tone(155.56, 0, 0.13, { type: 'square', level: 0.3, out: muffle })
  tone(155.56, 0.16, 0.22, { type: 'square', level: 0.3, out: muffle })
}

// 배경음악과 같은 D장조로 빠르게 올라가는 팡파르 + 마지막 화음.
export function playMissionSuccess() {
  const arpeggio = [587.33, 739.99, 880.0]
  arpeggio.forEach((freq, i) => tone(freq, i * 0.1, 0.25, { type: 'square', level: 0.08 }))
  for (const freq of [587.33, 739.99, 880.0, 1174.66]) {
    tone(freq, 0.3, 1.2, { type: 'triangle', level: 0.16 })
  }
  tone(1174.66, 0.3, 1.2, { type: 'square', level: 0.05 })
}

// 반음씩 내려가는 "빠밤…" - 마지막 음은 길게 끌어 아쉬움을 표현.
export function playMissionFailure() {
  const notes = [392.0, 369.99, 349.23, 329.63]
  notes.forEach((freq, i) => {
    const last = i === notes.length - 1
    tone(freq, i * 0.28, last ? 1.0 : 0.3, { type: 'sawtooth', level: 0.1 })
    tone(freq / 2, i * 0.28, last ? 1.0 : 0.3, { type: 'triangle', level: 0.2 })
  })
}

// 카메라 셔터 "찰칵" (짧게 감쇠하는 고음 잡음).
export function playShutter() {
  const audio = getAudio()
  if (!audio) return
  const { ctx, master } = audio

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
  gain.gain.value = 0.8

  noise.connect(filter).connect(gain).connect(master)
  noise.start()
}

// 모든 버튼에 하나하나 리스너를 달지 않고 문서 전체에서 클릭을 받아 처리함 -
// 탐사 기지처럼 innerHTML로 다시 그려지는 버튼에도 자동으로 적용됨. 구매/탐사
// 버튼과 사진 촬영 버튼은 각자 더 구체적인 효과음을 내므로 제외.
export function installButtonClickSound() {
  document.addEventListener('click', (e) => {
    const button = (e.target as Element | null)?.closest('button')
    if (!button || button.matches('.item-buy, #capture-button')) return
    playClick()
  }, true)
}
