/* ═══════════════════════════════════════════════════════════════
   Hand-made sound FX — pure WebAudio synth, zero audio files, zero deps.
   Subtle UI blips: clicks, sends, coins, success/error stingers.
   ═══════════════════════════════════════════════════════════════ */

let ctx = null
let master = null

function ensure() {
  if (typeof window === 'undefined') return false
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return false
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.14
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return true
}

/* Browsers need a user gesture before audio — unlock on first touch/key. */
if (typeof window !== 'undefined') {
  const kick = () => {
    ensure()
    window.removeEventListener('pointerdown', kick)
    window.removeEventListener('keydown', kick)
  }
  window.addEventListener('pointerdown', kick)
  window.addEventListener('keydown', kick)
}

export const soundOn = () => {
  try {
    return localStorage.getItem('bp_sound') !== '0'
  } catch {
    return true
  }
}

export const setSoundOn = (on) => {
  try {
    localStorage.setItem('bp_sound', on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function tone({ f = 440, f2 = null, t = 0, d = 0.12, type = 'sine', v = 1 }) {
  if (!ctx || !master) return
  const t0 = ctx.currentTime + t
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t0)
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + d)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d)
  o.connect(g)
  g.connect(master)
  o.start(t0)
  o.stop(t0 + d + 0.05)
}

const PRESETS = {
  click: [{ f: 660, d: 0.05, type: 'triangle', v: 0.4 }],
  toggle: [
    { f: 520, f2: 780, d: 0.07, type: 'triangle', v: 0.5 },
  ],
  send: [{ f: 740, f2: 990, d: 0.09, type: 'sine', v: 0.6 }],
  receive: [
    { f: 880, d: 0.08, type: 'sine', v: 0.55 },
    { f: 1174, t: 0.09, d: 0.1, type: 'sine', v: 0.55 },
  ],
  success: [
    { f: 523, d: 0.1, type: 'triangle', v: 0.6 },
    { f: 784, t: 0.09, d: 0.15, type: 'triangle', v: 0.6 },
  ],
  error: [{ f: 220, f2: 150, d: 0.2, type: 'sawtooth', v: 0.3 }],
  pop: [{ f: 600, f2: 920, d: 0.08, type: 'sine', v: 0.5 }],
  coin: [
    { f: 988, d: 0.08, type: 'square', v: 0.22 },
    { f: 1319, t: 0.08, d: 0.18, type: 'square', v: 0.22 },
  ],
}

/** Play a named effect. Safe to call anywhere — no-ops when muted. */
export function sfx(name) {
  try {
    if (!soundOn() || !ensure()) return
    const seq = PRESETS[name]
    if (seq) seq.forEach(tone)
  } catch {
    /* never break UI for sound */
  }
}
