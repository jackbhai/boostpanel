import { useEffect, useMemo, useState } from 'react'
import {
  bridge, cancelOrder, getAllOrders, getCatalog, listUsers,
  manualOrder, refillOrder, setOrderStatus,
} from '../../lib/db'
import { useStore } from '../../lib/store'
import { money } from '../../lib/utils'
import { downloadCSV } from '../../lib/csv'
import {
  Badge, Btn, EmptyState, Input, Modal, PageHead,
  SearchInput, Select, Skeleton, toast,
} from '../../components/ui'
import { Check, Download, LinkIcon, Pencil, Plus, RefreshCw, X } from '../../components/icons'

const STATUSES = ['pending', 'in_progress', 'processing', 'completed', 'partial', 'canceled', 'refunded']
const small = '!px-3 !py-1.5 text-[12px]'

export default function AdminOrders() {
  const { currency } = useStore()
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [st, setSt] = useState('all')
  const [sel, setSel] = useState(new Set())
  const [busy, setBusy] = useState('')
  const [edit, setEdit] = useState(null)
  const [editSt, setEditSt] = useState('')
  const [editRem, setEditRem] = useState('')
  const [manual, setManual] = useState(false)
  const [m, setM] = useState({ user_id: '', service_id: '', link: '', quantity: '' })

  const load = async () => {
    try {
      const [o, u, c] = await Promise.all([getAllOrders(), listUsers(), getCatalog()])
      setOrders(o || [])
      setUsers(u || [])
      setServices(c.services || [])
    } catch (e) {
      toast(e.message, 'error')
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const umap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.email])), [users])
  const smap = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s.name])), [services])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return orders.filter((o) => {
      if (st !== 'all' && o.status !== st) return false
      if (!s) return true
      return String(o.id).includes(s) || (umap[o.user_id] || '').toLowerCase().includes(s) ||
        (o.link || '').toLowerCase().includes(s) || (o.provider_order_id || '').toLowerCase().includes(s) ||
        (smap[o.service_id] || '').toLowerCase().includes(s)
    })
  }, [orders, q, st, umap, smap])

  const toggle = (id) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const run = async (key, fn) => {
    setBusy(key)
    try {
      toast(await fn())
    } catch (e) {
      toast(e.message, 'error')
    }
    setBusy('')
    load()
  }

  const doSync = (ids) => run('sync', async () => {
    const r = await bridge({ action: 'sync', order_ids: ids })
    setSel(new Set())
    return `Synced ${r?.synced ?? r?.updated ?? 0} orders with providers.`
  })
  const doBulk = (status) => run('bulk', async () => {
    const ids = [...sel]
    for (const id of ids) await setOrderStatus(id, status)
    setSel(new Set())
    return `${ids.length} orders set to ${status}.`
  })
  const doCancel = (id) => run(`c${id}`, async () => {
    const r = await cancelOrder(id)
    return `Order #${id} cancelled + refunded. ${r?.message || ''}`
  })
  const doRefill = (id) => run(`r${id}`, async () => {
    await refillOrder(id)
    return `Refill sent for order #${id}.`
  })
  const doSaveEdit = () => run('edit', async () => {
    const r = await setOrderStatus(edit.id, editSt, editRem === '' ? null : Number(editRem))
    setEdit(null)
    return `Order #${edit.id} updated${r?.refunded ? ` + refunded ${money(r.refunded, currency())}` : ''}.`
  })
  const doManual = () => run('manual', async () => {
    const r = await manualOrder({ user_id: m.user_id, service_id: Number(m.service_id), link: m.link.trim(), quantity: Number(m.quantity) })
    setManual(false)
    setM({ user_id: '', service_id: '', link: '', quantity: '' })
    return `Order #${r.order.id} created (${money(r.charge, currency())})${r.forwarded ? ' + forwarded' : ''}.`
  })
  const doExport = () => {
    downloadCSV('orders.csv', rows.map((o) => ({
      id: o.id, user: umap[o.user_id] || o.user_id, service: smap[o.service_id] || o.service_id,
      link: o.link, quantity: o.quantity, charge: o.charge, status: o.status,
      provider_order: o.provider_order_id || '', created: o.created_at,
    })))
    toast(`Exported ${rows.length} orders to CSV.`)
  }

  if (loading) return <Skeleton lines={5} />
  return (
    <div>
      <PageHead title="Orders" sub={`${orders.length} total · all status changes + refunds run server-side.`} />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search id, user, service, link, provider id…" /></div>
        <Select value={st} onChange={(e) => setSt(e.target.value)} className="sm:w-44">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
        </Select>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Btn variant="ghost" onClick={() => doSync([...sel])} disabled={!sel.size} loading={busy === 'sync'} className={small}><RefreshCw size={14} />Sync selected ({sel.size})</Btn>
        <Btn variant="ghost" onClick={() => doSync([])} loading={busy === 'sync'} className={small}><RefreshCw size={14} />Sync all live</Btn>
        <Btn variant="ghost" onClick={() => doBulk('completed')} disabled={!sel.size} loading={busy === 'bulk'} className={small}><Check size={14} />Complete</Btn>
        <Btn variant="danger" onClick={() => doBulk('canceled')} disabled={!sel.size} loading={busy === 'bulk'} className={small}><X size={14} />Cancel + refund</Btn>
        <Btn variant="ghost" onClick={doExport} className={small}><Download size={14} />CSV</Btn>
        <Btn onClick={() => setManual(true)} className={small}><Plus size={14} />Manual order</Btn>
      </div>
      {rows.length === 0 ? <EmptyState title="No orders found" hint="Try a different search or status filter." /> : (
        <div className="space-y-2">
          {rows.map((o) => (
            <div key={o.id} className="card p-3.5">
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={sel.has(o.id)} onChange={() => toggle(o.id)} className="mt-1 h-4 w-4 accent-violet-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-white">#{o.id}</span>
                    <Badge status={o.status} />
                    <span className="text-[13px] font-bold text-emerald-300">{money(o.charge, currency())}</span>
                    {o.provider_order_id && <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/40">prov: {o.provider_order_id}</span>}
                  </div>
                  <p className="mt-1 truncate text-[13px] font-semibold text-white/85">{smap[o.service_id] || `Service ${o.service_id}`}</p>
                  <p className="truncate text-xs text-white/45">{umap[o.user_id] || o.user_id} · qty {o.quantity}{o.runs > 0 ? ` · drip ${o.runs}x/${o.interval_mins}m` : ''}</p>
                  <a href={o.link} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200">
                    <LinkIcon size={12} /><span className="truncate">{o.link}</span>
                  </a>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5 pl-7">
                <Btn variant="subtle" onClick={() => { setEdit(o); setEditSt(o.status); setEditRem(o.remains ?? '') }} className={small}><Pencil size={13} />Edit</Btn>
                <Btn variant="subtle" onClick={() => doSync([o.id])} loading={busy === 'sync'} className={small}><RefreshCw size={13} />Sync</Btn>
                {['completed', 'partial'].includes(o.status) && (
                  <Btn variant="subtle" onClick={() => doRefill(o.id)} loading={busy === `r${o.id}`} className={small}><RefreshCw size={13} />Refill</Btn>
                )}
                {['pending', 'in_progress', 'processing', 'partial'].includes(o.status) && (
                  <Btn variant="danger" onClick={() => { if (window.confirm(`Cancel order #${o.id}? User gets a full refund.`)) doCancel(o.id) }} loading={busy === `c${o.id}`} className={small}><X size={13} />Cancel</Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <Modal title={`Edit order #${edit.id}`} onClose={() => setEdit(null)}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-white/60">Status (cancel/refund auto-refunds user)</span>
              <Select value={editSt} onChange={(e) => setEditSt(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-white/60">Remains (0 when completed)</span>
              <Input value={editRem} onChange={(e) => setEditRem(e.target.value)} type="number" min="0" />
            </label>
            <Btn onClick={doSaveEdit} loading={busy === 'edit'} className="w-full">Save (server-side)</Btn>
          </div>
        </Modal>
      )}

      {manual && (
        <Modal title="Manual order (charged to user)" onClose={() => setManual(null) || setManual(false)} wide>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-white/60">User</span>
              <Select value={m.user_id} onChange={(e) => setM({ ...m, user_id: e.target.value })}>
                <option value="">Select user…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.email} ({money(u.balance, currency())})</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-white/60">Service</span>
              <Select value={m.service_id} onChange={(e) => setM({ ...m, service_id: e.target.value })}>
                <option value="">Select service…</option>
                {services.map((s) => <option key={s.id} value={s.id}>#{s.id} {s.name} — {money(s.rate, currency())}/1k</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-white/60">Link</span>
              <Input value={m.link} onChange={(e) => setM({ ...m, link: e.target.value })} placeholder="https://…" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-white/60">Quantity</span>
              <Input value={m.quantity} onChange={(e) => setM({ ...m, quantity: e.target.value })} type="number" min="1" />
            </label>
            <Btn onClick={doManual} loading={busy === 'manual'} disabled={!m.user_id || !m.service_id || !m.link || !m.quantity} className="w-full">Place order</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
