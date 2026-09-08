import { AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Btn, EmptyState, Field, Input, Modal, PageHead, SearchInput, Select, Skeleton, toast } from '../../components/ui'
import { getAllOrders, listUsers, setOrderStatus, syncAllProviderOrders, syncOrder } from '../../lib/db'
import { serviceById, useStore } from '../../lib/store'
import { money, shortId, timeAgo } from '../../lib/utils'

const STATUSES = ['pending', 'in_progress', 'processing', 'completed', 'partial', 'canceled', 'refunded']
const FILTERS = ['all', ...STATUSES]

export default function AdminOrders() {
  const { services, currency } = useStore()
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncOne, setSyncOne] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([getAllOrders(), listUsers().catch(() => [])])
      .then(([o, u]) => { setOrders(o); setUsers(u) })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const emailOf = (id) => users.find((u) => u.id === id)?.email || String(id).slice(0, 8)

  const list = useMemo(() => orders.filter((o) => {
    if (filter !== 'all' && o.status !== filter) return false
    if (q) {
      const svc = serviceById(services, o.service_id)
      const hay = `${o.id} ${o.link} ${svc?.name || ''} ${emailOf(o.user_id)} ${o.provider_order_id || ''}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  }), [orders, filter, q, services, users])

  const save = async () => {
    setBusy(true)
    try {
      await setOrderStatus(edit._orig, edit.status, edit.remains)
      toast(edit.status === 'canceled' || edit.status === 'partial' || edit.status === 'refunded'
        ? 'Status saved + auto-refund issued 💸'
        : 'Order status updated!')
      setEdit(null)
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const syncSingle = async (o) => {
    setSyncOne(o.id)
    try {
      const res = await syncOrder(o.id)
      const r = res.results?.[0]
      toast(r?.error ? `Sync: ${r.error}` : `Synced → ${r?.status || 'ok'} ✅`)
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSyncOne(null)
    }
  }

  const syncAll = async () => {
    setSyncing(true)
    try {
      const res = await syncAllProviderOrders()
      toast(`Synced ${res.updated ?? 0} provider orders ✅`)
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const providerLive = orders.filter((o) => o.provider_id && ['pending', 'in_progress', 'processing'].includes(o.status)).length

  return (
    <div>
      <PageHead
        title="Orders"
        sub={`${orders.length} total`}
        right={
          <Btn onClick={syncAll} loading={syncing} className="!px-3 !py-2 text-[12px]" disabled={!providerLive}>
            <RefreshCw size={14} /> Sync ({providerLive})
          </Btn>
        }
      />
      <SearchInput value={q} onChange={setQ} placeholder="Search id, user, link, provider id…" />
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize ${
              filter === f ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/55'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2.5">
        {loading && <Skeleton lines={4} />}
        {!loading && list.length === 0 && <EmptyState icon="📦" title="No orders" />}
        {list.map((o) => {
          const svc = serviceById(services, o.service_id)
          return (
            <div key={o.id} className="card p-3.5">
              <button onClick={() => setEdit({ _orig: o, status: o.status, remains: o.remains })} className="block w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-white">{shortId(o.id)}</p>
                  <div className="flex items-center gap-1.5">
                    {o.provider_id ? <Badge status="processing">🔌 auto</Badge> : <Badge status="closed">manual</Badge>}
                    <Badge status={o.status} />
                  </div>
                </div>
                <p className="mt-1 truncate text-[13px] text-white/70">{svc?.name || `#${o.service_id}`}</p>
                <p className="truncate text-[12px] text-sky-300/70">{o.link}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/45">
                  <span>👤 {emailOf(o.user_id)}</span>
                  <span>{Number(o.quantity).toLocaleString()} qty · rem {Number(o.remains ?? 0).toLocaleString()}</span>
                  <span className="font-bold text-white/70">{money(o.charge, currency())}</span>
                </div>
                <p className="mt-1 text-[11px] text-white/30">
                  {o.provider_order_id ? `Provider order ${o.provider_order_id} · ` : ''}{timeAgo(o.created_at)}
                </p>
              </button>
              <div className="mt-2 flex gap-2">
                {o.provider_id && ['pending', 'in_progress', 'processing'].includes(o.status) && (
                  <button
                    onClick={() => syncSingle(o)}
                    disabled={syncOne === o.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 py-2 text-[13px] font-bold text-sky-300 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={syncOne === o.id ? 'animate-spin' : ''} />
                    {syncOne === o.id ? 'Syncing…' : o.provider_order_id ? 'Sync status' : 'Push to provider'}
                  </button>
                )}
                <button
                  onClick={() => setEdit({ _orig: o, status: o.status, remains: o.remains })}
                  className="flex-1 rounded-xl bg-white/5 py-2 text-[13px] font-bold text-white/70"
                >
                  Manage →
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <AnimatePresence>
        {edit && (
          <Modal title={`Manage ${shortId(edit._orig.id)}`} onClose={() => setEdit(null)}>
            <div className="space-y-3.5">
              <div className="rounded-xl bg-white/5 p-3 text-[12px] text-white/60">
                <p className="truncate">👤 {emailOf(edit._orig.user_id)}</p>
                <p className="mt-0.5">💰 {money(edit._orig.charge, currency())} · Qty {Number(edit._orig.quantity).toLocaleString()}</p>
                {edit._orig.provider_order_id && <p className="mt-0.5 font-mono">🔌 Provider: {edit._orig.provider_order_id}</p>}
              </div>
              <Field label="Status">
                <Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </Select>
              </Field>
              <Field label="Remains (undelivered qty)" hint="Refunds are auto-calculated from remains ÷ quantity.">
                <Input type="number" min={0} max={edit._orig.quantity} value={edit.remains} onChange={(e) => setEdit({ ...edit, remains: e.target.value })} />
              </Field>
              <Btn onClick={save} loading={busy} className="w-full">Save Changes</Btn>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
