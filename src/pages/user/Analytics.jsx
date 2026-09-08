import { useEffect, useMemo, useState } from 'react'
import { Btn, EmptyState, PageHead } from '../../components/ui'
import { Download, TrendingUp } from '../../components/icons'
import { getUserOrders } from '../../lib/db'
import { downloadCSV } from '../../lib/csv'
import { money, statusLabel } from '../../lib/utils'
import { useStore } from '../../lib/store'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Analytics() {
  const { user, services, currency } = useStore()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) getUserOrders(user.id).then((o) => { setOrders(o || []); setLoading(false) }).catch(() => setLoading(false))
  }, [user])

  const svcMap = useMemo(() => Object.fromEntries((services || []).map((s) => [s.id, s])), [services])

  const stats = useMemo(() => {
    const spent = orders.filter((o) => !['canceled', 'refunded'].includes(o.status)).reduce((s, o) => s + Number(o.charge || 0), 0)
    const refunded = orders.filter((o) => ['canceled', 'refunded'].includes(o.status)).reduce((s, o) => s + Number(o.charge || 0), 0)
    const byStatus = {}
    for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1
    // last 6 months spend
    const now = new Date()
    const buckets = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const total = orders
        .filter((o) => { const od = new Date(o.created_at); return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth() && !['canceled', 'refunded'].includes(o.status) })
        .reduce((s, o) => s + Number(o.charge || 0), 0)
      buckets.push({ key, label: MONTHS[d.getMonth()], total })
    }
    // top services by spend
    const bySvc = {}
    for (const o of orders) {
      if (['canceled', 'refunded'].includes(o.status)) continue
      bySvc[o.service_id] = (bySvc[o.service_id] || 0) + Number(o.charge || 0)
    }
    const top = Object.entries(bySvc).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const delivered = orders.reduce((s, o) => s + Math.max(0, Number(o.quantity || 0) - Number(o.remains || 0)), 0)
    return { spent, refunded, byStatus, buckets, top, delivered }
  }, [orders])

  const maxMonth = Math.max(1, ...stats.buckets.map((b) => b.total))
  const maxTop = Math.max(1, ...stats.top.map(([, v]) => v))

  return (
    <div>
      <PageHead
        title="Analytics"
        sub="Your real spend + delivery stats."
        right={<Btn variant="ghost" onClick={() => downloadCSV('my-orders.csv', orders)} className="!px-3 !py-1.5 text-[12px]"><Download size={13} />CSV</Btn>}
      />
      {loading ? <p className="py-6 text-center text-[13px] text-white/40">Loading…</p>
        : orders.length === 0 ? <EmptyState icon={<TrendingUp size={36} />} title="No data yet" hint="Place your first order and stats will appear here." />
        : (
          <div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="card p-4"><p className="text-xl font-extrabold text-white">{money(stats.spent, currency())}</p><p className="text-[11.5px] text-white/45">Total spent</p></div>
              <div className="card p-4"><p className="text-xl font-extrabold text-white">{orders.length}</p><p className="text-[11.5px] text-white/45">Orders placed</p></div>
              <div className="card p-4"><p className="text-xl font-extrabold text-emerald-300">{stats.delivered.toLocaleString('en-IN')}</p><p className="text-[11.5px] text-white/45">Units delivered</p></div>
              <div className="card p-4"><p className="text-xl font-extrabold text-amber-300">{money(stats.refunded, currency())}</p><p className="text-[11.5px] text-white/45">Refunded back</p></div>
            </div>

            <div className="card mb-3 p-4">
              <p className="mb-3 text-[13px] font-bold text-white">Spend — last 6 months</p>
              <div className="flex h-32 items-end gap-2">
                {stats.buckets.map((b) => (
                  <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-white/50">{b.total > 0 ? Math.round(b.total) : ''}</span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-violet-600 to-fuchsia-500"
                      style={{ height: `${Math.max(4, (b.total / maxMonth) * 100)}%` }}
                      title={`${b.label}: ${money(b.total, currency())}`}
                    />
                    <span className="text-[10.5px] font-bold text-white/45">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card mb-3 p-4">
              <p className="mb-2 text-[13px] font-bold text-white">Orders by status</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(stats.byStatus).map(([st, n]) => (
                  <span key={st} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-bold text-white/70">
                    {statusLabel(st)} · {n}
                  </span>
                ))}
              </div>
            </div>

            {stats.top.length > 0 && (
              <div className="card p-4">
                <p className="mb-2 text-[13px] font-bold text-white">Top services by spend</p>
                <div className="space-y-2">
                  {stats.top.map(([id, v]) => (
                    <div key={id}>
                      <div className="mb-0.5 flex items-center justify-between text-[12.5px]">
                        <span className="max-w-[70%] truncate font-semibold text-white/75">{svcMap[id]?.name || `Service #${id}`}</span>
                        <span className="font-bold text-white">{money(v, currency())}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.max(3, (v / maxTop) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  )
}
