import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Search, X } from './icons'
import { create } from 'zustand'
import { statusLabel, statusStyle } from '../lib/utils'

/* ------------------------------ Toast ------------------------------ */

export const useToast = create((set) => ({
  items: [],
  push: (text, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ items: [...s.items, { id, text, type }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3200)
  },
}))

export const toast = (text, type) => useToast.getState().push(text, type)

export function Toasts() {
  const items = useToast((s) => s.items)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] mx-auto flex w-full max-w-md flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-xl backdrop-blur ${
              t.type === 'error'
                ? 'border-rose-500/40 bg-rose-950/90 text-rose-100'
                : 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
            }`}
          >
            {t.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span className="flex-1">{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ----------------------------- Buttons ----------------------------- */

export function Btn({ variant = 'primary', className = '', loading, disabled, children, ...props }) {
  const styles = {
    primary: 'grad-btn text-white shadow-lg shadow-violet-600/30 hover:opacity-90',
    ghost: 'bg-white/5 text-white border border-white/10 hover:bg-white/10',
    subtle: 'bg-white/5 text-white/80 hover:bg-white/10',
    danger: 'bg-rose-600/90 text-white hover:bg-rose-600',
    success: 'bg-emerald-600/90 text-white hover:bg-emerald-600',
  }
  return (
    <button
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {children}
    </button>
  )
}

/* ------------------------------ Inputs ----------------------------- */

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-white/40">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition'

export function Input(props) {
  return <input {...props} className={`${inputCls} ${props.className || ''}`} />
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`${inputCls} appearance-none ${props.className || ''}`}>
      {children}
    </select>
  )
}

export function Textarea(props) {
  return <textarea {...props} className={`${inputCls} min-h-[90px] resize-y ${props.className || ''}`} />
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} pl-9`}
      />
    </div>
  )
}

/* ------------------------------- Misc ------------------------------ */

export function Badge({ status, children }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${statusStyle(status)}`}>
      {children || statusLabel(status)}
    </span>
  )
}

export function PageHead({ title, sub, right }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px] text-white/50">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function EmptyState({ icon, title, hint, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-white/20">{icon}</div>}
      <p className="font-semibold text-white">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-white/45">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ lines = 3 }) {
  return (
    <div className="space-y-3">
      {[...Array(lines)].map((_, i) => (
        <div key={i} className="card animate-pulse p-4">
          <div className="h-4 w-2/3 rounded bg-white/10" />
          <div className="mt-2 h-3 w-1/3 rounded bg-white/5" />
        </div>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'} rounded-t-2xl border border-white/10 bg-[#0A0A0A] p-5 sm:rounded-2xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

export function Stat({ label, value, icon, sub, accent }) {
  return (
    <div className="card card-hover p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{label}</p>
        {icon && <span className="text-white/60">{icon}</span>}
      </div>
      <p className={`mt-1 text-lg font-bold ${accent || 'text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/40">{sub}</p>}
    </div>
  )
}
