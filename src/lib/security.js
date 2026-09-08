/* ═══════════════════════════════════════════════════════════════
   Client security helpers: input hygiene, password strength, device id,
   idle auto-lock. Server mirrors this in the `secure` edge function.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useRef } from 'react'

/** Strip control chars + neutralize script/js: injections, trim, cap length. */
export function clean(v, max = 2000) {
  if (v === null || v === undefined) return v
  let s = String(v)
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  s = s.replace(/<\s*script/gi, '<blocked').replace(/javascript\s*:/gi, 'blocked:')
  s = s.trim().replace(/[ \t]+\n/g, '\n')
  if (s.length > max) s = s.slice(0, max)
  return s
}

export function cleanEmail(v) {
  return String(v || '').trim().toLowerCase().slice(0, 160)
}

/** 0-4 password score + label (no dictionary lib needed). */
export function pwScore(pw) {
  const s = String(pw || '')
  let sc = 0
  if (s.length >= 8) sc++
  if (s.length >= 12) sc++
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) sc++
  if (/\d/.test(s)) sc++
  if (/[^A-Za-z0-9]/.test(s)) sc++
  const level = sc <= 1 ? 0 : sc === 2 ? 1 : sc === 3 ? 2 : sc === 4 ? 3 : 4
  return { level, label: ['Very weak', 'Weak', 'Okay', 'Strong', 'Elite'][level] }
}

/** Short human device tag for sessions + login alerts. */
export function deviceName() {
  try {
    const ua = navigator.userAgent || ''
    const mob = /Mobile|Android|iPhone|iPad/i.test(ua)
    const br = /Edg/i.test(ua)
      ? 'Edge'
      : /Chrome/i.test(ua)
        ? 'Chrome'
        : /Firefox/i.test(ua)
          ? 'Firefox'
          : /Safari/i.test(ua)
            ? 'Safari'
            : 'Browser'
    return `${mob ? 'Mobile' : 'Desktop'} · ${br}`
  } catch {
    return 'Web'
  }
}

/** Fire onIdle after `mins` of zero interaction (when enabled). */
export function useIdleLogout(enabled, mins, onIdle) {
  const ref = useRef(onIdle)
  ref.current = onIdle
  useEffect(() => {
    if (!enabled || !mins) return
    let t = null
    const arm = () => {
      clearTimeout(t)
      t = setTimeout(() => ref.current?.(), mins * 60000)
    }
    const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    evs.forEach((e) => window.addEventListener(e, arm, { passive: true }))
    arm()
    return () => {
      clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, arm))
    }
  }, [enabled, mins])
}

export function lockPrefs() {
  try {
    return {
      on: localStorage.getItem('bp_lock') === '1',
      mins: Number(localStorage.getItem('bp_lock_mins') || 30),
    }
  } catch {
    return { on: false, mins: 30 }
  }
}
