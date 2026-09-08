/** Format money: 1250.5 + "₹" → "₹1,250.50" */
export function money(n, currency = '₹') {
  const v = Number(n || 0)
  return `${currency}${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Charge = rate per 1000 × qty / 1000 */
export function calcCharge(ratePer1k, qty) {
  return (Number(ratePer1k || 0) * Number(qty || 0)) / 1000
}

/** "2h ago" style timestamps */
export function timeAgo(date) {
  if (!date) return '—'
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fullDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

/** Badge colors per order / ticket / txn status */
export function statusStyle(status) {
  const s = String(status || '').toLowerCase()
  const map = {
    completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    answered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    in_progress: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    processing: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    open: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    partial: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    canceled: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    cancelled: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    failed: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    closed: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    refunded: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    banned: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  }
  return map[s] || 'bg-white/10 text-white/70 border-white/15'
}

export function statusLabel(status) {
  return String(status || '—').replaceAll('_', ' ')
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function apiKey() {
  const chars = 'abcdef0123456789'
  let k = ''
  for (let i = 0; i < 32; i++) k += chars[Math.floor(Math.random() * chars.length)]
  return k
}

/** short id like #4821 from uuid/int */
export function shortId(id) {
  const s = String(id ?? '')
  if (/^\d+$/.test(s)) return `#${s}`
  return '#' + s.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()
}

/** order progress % from remains */
export function progressOf(order) {
  const q = Number(order?.quantity || 0)
  const r = Number(order?.remains ?? q)
  if (!q) return 0
  return Math.min(100, Math.max(0, Math.round(((q - r) / q) * 100)))
}
