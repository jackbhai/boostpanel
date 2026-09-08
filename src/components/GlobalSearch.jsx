import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { searchOrdersAdmin, searchUsersAdmin } from '../lib/db'
import { supabase } from '../lib/supabase'
import { Box, ShoppingCart, Users } from './icons'

/** Admin command-palette: jump to any user, order or service. Ctrl+K or "/" to open. */
export default function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState({ users: [], orders: [], services: [] })
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bp_recent_search') || '[]') } catch { return [] }
  })
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { services } = useStore()

  useEffect(() => {
    if (open) {
      setQ('')
      setRes({ users: [], orders: [], services: [] })
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open ])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || q.trim().length < 2) { setRes({ users: [], orders: [], services: [] }); return }
    setBusy(true)
    const t = setTimeout(async () => {
      try {
        const term = q.trim()
        const [users, linkOrders] = await Promise.all([
          searchUsersAdmin(term).catch(() => []),
          searchOrdersAdmin(term).catch(() => []),
        ])
        let idOrders = []
        if (/^\d+$/.test(term)) {
          const { data } = await supabase.from('orders').select('*').eq('id', Number(term))
          if (data) idOrders = data
        }
        const seen = new Set()
        const orders = [...idOrders, ...linkOrders].filter((o) => !seen.has(o.id) && (seen.add(o.id), true)).slice(0, 8)
        const svcs = (services || []).filter((s) =>
          (s.name || '').toLowerCase().includes(term.toLowerCase()) || String(s.id) === term
        ).slice(0, 8)
        setRes({ users: (users || []).slice(0, 8), orders, services: svcs })
      } catch { /* offline */ }
      setBusy(false)
    }, 300)
    return () => clearTimeout(t)
  }, [q, open, services])

  if (!open) return null

  const go = (to, label) => {
    const r = [{ to, label }, ...recent.filter((x) => x.to !== to)].slice(0, 6)
    setRecent(r)
    try { localStorage.setItem('bp_recent_search', JSON.stringify(r)) } catch { /* ignore */ }
    onClose()
    navigate(to)
  }

  const Group = ({ title, icon: Icon, items, render }) => items.length === 0 ? null : (
    <div className="mt-3">
      <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-white/40">
        <Icon size={13} /> {title}
      </p>
      <div className="overflow-hidden rounded-xl border border-white/10">
        {items.map(render)}
      </div>
    </div>
  )
  const Row = ({ onClick, children }) => (
    <button onClick={onClick} className="flex w-full items-center gap-2 border-b border-white/5 bg-white/[0.02] px-3 py-2.5 text-left text-[13px] text-white/100 transition last:border-0 hover:bg-violet-500/10">
      {children}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-[#0a0a10] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-white/10 p-3">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users, order #id, links, services…"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-violet-500/60"
          />
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-3">
          {busy && <p className="px-1 py-2 text-[12px] text-white/40">Searching…</p>}
          {!busy && q.trim().length >= 2 && res.users.length + res.orders.length + res.services.length === 0 && (
            <p className="px-1 py-4 text-center text-[13px] text-white/40">No matches for “{q.trim()}”.</p>
          )}
          <Group title="Users" icon={Users} items={res.users} render={(u) => (
            <Row key={u.id} onClick={() => go(`/admin/users?find=${u.id}`, u.email)}>
              <span className="flex-1 truncate font-semibold text-white">{u.email}</span>
              <span className="text-[12px] text-white/40">{u.status} · {u.balance}</span>
            </Row>
          )} />
          <Group title="Orders" icon={ShoppingCart} items={res.orders} render={(o) => (
            <Row key={o.id} onClick={() => go(`/admin/orders?find=${o.id}`, `Order #${o.id}`)}>
              <span className="font-bold text-violet-300">#{o.id}</span>
              <span className="flex-1 truncate">{o.link}</span>
              <span className="text-[12px] text-white/40">{o.status}</span>
            </Row>
          )} />
          <Group title="Services" icon={Box} items={res.services} render={(s) => (
            <Row key={s.id} onClick={() => go(`/admin/services?find=${s.id}`, s.name)}>
              <span className="flex-1 truncate font-semibold text-white">{s.name}</span>
              <span className="text-[12px] text-white/40">{s.rate}/1k</span>
            </Row>
          )} />
          {q.trim().length < 2 && recent.length > 0 && (
            <div className="mt-1">
              <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-white/40">Recent</p>
              <div className="overflow-hidden rounded-xl border border-white/10">
                {recent.map((r) => (
                  <Row key={r.to} onClick={() => go(r.to, r.label)}>
                    <span className="flex-1 truncate">{r.label}</span>
                    <span className="font-mono text-[11px] text-white/30">{r.to}</span>
                  </Row>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
