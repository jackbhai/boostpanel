import { ExternalLink, RefreshCcw, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, EmptyState, PageHead, SearchInput, Skeleton, toast } from '../../components/ui'
import { cancelOrder, getUserOrders, refillOrder } from '../../lib/db'
import { serviceById, useStore } from '../../lib/store'
import { money, progressOf, shortId, timeAgo } from '../../lib/utils'

const FILTERS = ['all', 'pending', 'in_progress', 'completed', 'partial', 'canceled', 'refunded']

export default function Orders() {
  const { user, services, currency, refreshProfile } = useStore()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [acting, setActing] = useState(null)

  const load = () => {
    setLoading(true)
    getUserOrders(user.id)
      .then(setOrders)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const list = useMemo(() => {
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false
      if (q) {
        const svc = serviceById(services, o.service_id)
        const hay = `${o.id} ${o.link} ${svc?.name || ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [orders, filter, q, services])

  const act = async (fn, order, msg) => {
    if (!window.confirm(msg)) return
    setActing(order.id)
    try {
      await fn(order)
      await refreshProfile()
      toast('Done! Balance updated.')
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setActing(null)
    }
  }

  return (
    <div>
      <PageHead title="My Orders" sub={`${orders.length} total`} right={
        <button onClick={load} className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 hover:bg-white/10">
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      } />

      <SearchInput value={q} onChange={setQ} placeholder="Search id, link, service…" />

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => {
          const n = f === 'all' ? orders.length : orders.filter((o) => o.status === f).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize transition ${
                filter === f ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/55'
              }`}
            >
              {f.replace('_', ' ')} · {n}
            </button>
          )
        })}
      </div>

      <div className="mt-4 space-y-2.5">
        {loading && <Skeleton lines={4} />}
        {!loading && list.length === 0 && (
          <EmptyState
            icon="📦"
            title="No orders found"
            hint={filter === 'all' ? 'Your orders will show up here.' : `Nothing with status "${filter}".`}
            action={<Link to="/order" className="grad-btn rounded-xl px-4 py-2 text-sm font-semibold text-white">Place an order</Link>}
          />
        )}
        {list.map((o) => {
          const svc = serviceById(services, o.service_id)
          const canRefill = ['completed', 'partial'].includes(o.status) && (svc?.refill_days || 0) > 0
          const canCancel = ['pending', 'in_progress', 'processing'].includes(o.status)
          const pct = progressOf(o)
          return (
            <div key={o.id} className="card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-white">{shortId(o.id)}</p>
                <Badge status={o.status} />
              </div>
              <p className="mt-1 truncate text-[13px] font-medium text-white/70">{svc?.name || `Service #${o.service_id}`}</p>
              <a href={o.link} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-sky-300/80">
                <ExternalLink size={11} className="shrink-0" />
                <span className="truncate">{o.link}</span>
              </a>

              {/* progress */}
              <div className="mt-2.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${o.status === 'completed' ? 'bg-emerald-400' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'}`}
                    style={{ width: `${o.status === 'completed' ? 100 : pct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/45">
                  <span>Qty {Number(o.quantity).toLocaleString()}</span>
                  <span>Remains {Number(o.remains ?? 0).toLocaleString()}</span>
                  <span className="font-bold text-white/70">{money(o.charge, currency())}</span>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[11px] text-white/35">{timeAgo(o.created_at)}</span>
                <div className="flex gap-2">
                  {canRefill && (
                    <button
                      disabled={acting === o.id}
                      onClick={() => act(refillOrder, o, 'Request a refill for this order?')}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-300 disabled:opacity-50"
                    >
                      <RefreshCcw size={12} /> Refill
                    </button>
                  )}
                  {canCancel && (
                    <button
                      disabled={acting === o.id}
                      onClick={() => act(cancelOrder, o, 'Cancel this order? Undelivered amount will be refunded.')}
                      className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-rose-300 disabled:opacity-50"
                    >
                      <XCircle size={12} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
