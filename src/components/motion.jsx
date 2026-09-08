/* Shared motion primitives: page fades, scroll reveals, count-ups. */
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

/** Fade/slide wrapper for route views (remount per key). */
export function PageFade({ k, children }) {
  return (
    <motion.div
      key={k}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

/** Reveal once when scrolled into view. */
export function Reveal({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

export const staggerKid = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

/** Animated number (balances, stats). Respects reduced-motion. */
export function CountUp({ value, format, className = '' }) {
  const reduce = useReducedMotion()
  const [disp, setDisp] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const from = Number(prev.current) || 0
    const to = Number(value) || 0
    prev.current = value
    if (reduce || from === to || !isFinite(from) || !isFinite(to)) {
      setDisp(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const dur = 600
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setDisp(from + (to - from) * e)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, reduce])
  return <span className={className}>{format ? format(disp) : disp}</span>
}

/** Chat typing indicator (three bouncing dots, pure CSS). */
export function TypingDots({ className = '' }) {
  return (
    <span className={`typing-dots ${className}`} aria-label="typing">
      <span />
      <span />
      <span />
    </span>
  )
}
