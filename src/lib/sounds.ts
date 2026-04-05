/**
 * Trading sounds using Web Audio API
 * Tapbit-style entry/close notification sounds
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

/** 포지션 진입 사운드 — 상승톤 딩 */
export function entrySound() {
  const ctx = getCtx()
  if (!ctx) return

  const now = ctx.currentTime

  // Main tone
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(880, now)
  osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08)
  gain1.gain.setValueAtTime(0.15, now)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
  osc1.start(now)
  osc1.stop(now + 0.18)

  // Harmonic overtone
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(1760, now + 0.03)
  osc2.frequency.exponentialRampToValueAtTime(2640, now + 0.11)
  gain2.gain.setValueAtTime(0.08, now + 0.03)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
  osc2.start(now + 0.03)
  osc2.stop(now + 0.18)
}

/** 포지션 청산/익절 사운드 — 하강톤 + 캐시레지스터 느낌 */
export function closeSound() {
  const ctx = getCtx()
  if (!ctx) return

  const now = ctx.currentTime

  // Descending tone
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(1320, now)
  osc1.frequency.exponentialRampToValueAtTime(660, now + 0.15)
  gain1.gain.setValueAtTime(0.15, now)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  osc1.start(now)
  osc1.stop(now + 0.25)

  // "Cha-ching" high ping
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(2093, now + 0.08)
  gain2.gain.setValueAtTime(0.1, now + 0.08)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
  osc2.start(now + 0.08)
  osc2.stop(now + 0.3)
}
