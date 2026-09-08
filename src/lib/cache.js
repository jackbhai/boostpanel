/* ═══════════════════════════════════════════════════════════════
   Speed layer: stale-while-revalidate cache + in-flight dedupe, and a tiny
   live event bus so realtime pushes refresh exactly the pages showing them.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect } from 'react'

const store = new Map()
const inflight = new Map()

/**
 * cached(key, fn, ttl): returns cached value instantly when fresh; serves
 * stale instantly while revalidating in background; dedupes parallel calls.
 */
export async function cached(key, fn, ttlMs = 30000) {
  const hit = store.get(key)
  const now = Date.now()
  if (hit && now - hit.t < ttlMs) return hit.v
  if (inflight.has(key)) return inflight.get(key)
  const p = (async () => {
    try {
      const v = await fn()
      store.set(key, { v, t: Date.now() })
      return v
    } catch (e) {
      if (hit) return hit.v
      throw e
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  if (hit) return hit.v
  return p
}

/** Drop every cached entry whose key starts with `prefix`. */
export function bust(prefix) {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k)
}

/* ------------------------- live event bus ------------------------- */

const subs = new Map()

export const bus = {
  on(name, fn) {
    if (!subs.has(name)) subs.set(name, new Set())
    subs.get(name).add(fn)
    return () => bus.off(name, fn)
  },
  off(name, fn) {
    subs.get(name)?.delete(fn)
  },
  emit(name, payload) {
    subs.get(name)?.forEach((fn) => {
      try {
        fn(payload)
      } catch {
        /* ignore listener errors */
      }
    })
  },
}

/** Re-run `fn` whenever realtime emits `name` (orders/txns/notifs/…). */
export function useLiveEvent(name, fn) {
  const ref = useRefFn(fn)
  useEffect(() => bus.on(name, (...a) => ref.current(...a)), [name])
}

import { useRef } from 'react'
function useRefFn(fn) {
  const ref = useRef(fn)
  ref.current = fn
  return ref
}
