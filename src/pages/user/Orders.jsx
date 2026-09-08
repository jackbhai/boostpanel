import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, EmptyState, PageHead, SearchInput, Skeleton, toast } from '../../components/ui'
import { Box, ExternalLink, RefreshCcw, XCircle, Clock, Star } from '../../components/icons'
import { cancelOrder, getUserOrders, refillOrder, createReview, orderEvents } from '../../lib/db'
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
  const [expanded, setExpanded] = useState(null)
  const [events, setEvents] = useState([])
  const [reviewFor, setReviewFor] = useState(null)
  const [stars, setStars] = useState(5)
  const [reviewText, setReviewText] = useState('')

  const load = () => {
    setLoading(true)
    getUserOrders(user.id)
      .then(setOrders)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const toggleTimeline = async (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    try { setEvents(await orderEvents(id)) } catch { setEvents([]) }
  }

  const sendReview = async (id) => {
    setActing(`r${id}`)
    try {
      await createReview(id, stars, reviewText.trim())
      toast('Thanks! Review sent for approval.')
      setReviewFor(null)
    } catch (err) { toast(err.message, 'error') }
    setActing(null)
  }

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
            icon={<Box size={40} />}
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

              {o.coupon_code && <p className="mt-1.5 text-[11px] font-bold text-emerald-300">Coupon {o.coupon_code} saved {money(o.discount_amt || 0, currency())}</p>}
              <div className="mt-2 flex gap-3">
                <button onClick={() => toggleTimeline(o.id)} className="flex items-center gap-1 text-[12px] font-bold text-violet-300"><Clock size={12} />{expanded === o.id ? 'Hide history' : 'History'}</button>
                {o.status === 'completed' && <button onClick={() => { setReviewFor(o.id); setStars(5); setReviewText('') }} className="flex items-center gap-1 text-[12px] font-bold text-amber-300"><Star size={12} />Rate service</button>}
              </div>
              {expanded === o.id && (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3">
                  {events.length === 0 ? <p className="text-[12px] text-white/40">No events yet.</p> : events.map((ev) => (
                    <div key={ev.id} className="flex gap-2 border-l-2 border-violet-500/40 py-1 pl-2.5 text-[12px]">
                      <span className="shrink-0 font-bold text-white/75">{ev.event}</span>
                      <span className="flex-1 truncate text-white/45">{ev.detail || ''}</span>
                      <span className="shrink-0 text-white/30">{timeAgo(ev.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
              {reviewFor === o.id && (
                <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button key={i} onClick={() => setStars(i)} aria-label={`${i} stars`}><Star size={24} className={i <= stars ? 'text-amber-300' : 'text-white/20'} fill={i <= stars ? 'currentColor' : 'none'} /></button>
                    ))}
                  </div>
                  <input value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Say something nice (optional)…" maxLength={500} className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30" />
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => sendReview(o.id)} disabled={acting === `r${o.id}`} className="grad-btn rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50">Submit review</button>
                    <button onClick={() => setReviewFor(null)} className="rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-bold text-white/60">Cancel</button>
                  </div>
                </div>
              )}
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
