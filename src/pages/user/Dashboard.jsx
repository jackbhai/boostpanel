import { ArrowRight, Layers, LifeBuoy, Megaphone, Plus, ShoppingCart, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, EmptyState, PageHead, Skeleton } from '../../components/ui'
import { getAnnouncements, getUserOrders, getUserStats } from '../../lib/db'
import { serviceById, useStore } from '../../lib/store'
import { money, shortId, timeAgo } from '../../lib/utils'

const QUICK = [
  { to: '/order', icon: '🛒', label: 'New Order' },
  { to: '/mass-order', icon: '📦', label: 'Mass Order' },
  { to: '/services', icon: '📋', label: 'Services' },
  { to: '/funds', icon: '💰', label: 'Add Funds' },
  { to: '/tickets', icon: '🎫', label: 'Tickets' },
  { to: '/api', icon: '🔌', label: 'API' },
]

export default function Dashboard() {
  const { user, profile, services, currency, refreshProfile } = useStore()
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    refreshProfile()
    Promise.all([getUserStats(user.id), getUserOrders(user.id), getAnnouncements(true)])
      .then(([s, orders, anns]) => {
        setStats(s)
        setRecent(orders.slice(0, 4))
        setNews(anns.slice(0, 3))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHead
        title={`Hello, ${(profile?.email || '').split('@')[0] || 'there'} 👋`}
        sub={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      />

      {/* Balance hero */}
      <div className="grad-btn relative overflow-hidden rounded-2xl p-5 shadow-xl shadow-violet-600/25">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 right-16 h-28 w-28 rounded-full bg-black/10" />
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Account balance</p>
        <p className="mt-1 text-3xl font-extrabold text-white">{money(profile?.balance, currency())}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => navigate('/funds')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-violet-700 active:scale-[0.98]"
          >
            <Plus size={16} /> Add Funds
          </button>
          <button
            onClick={() => navigate('/order')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-black/25 px-3 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
          >
            <ShoppingCart size={16} /> New Order
          </button>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="mt-4"><Skeleton lines={1} /></div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="card p-3 text-center">
            <p className="text-xl font-extrabold text-sky-300">{stats?.activeOrders ?? 0}</p>
            <p className="mt-0.5 text-[11px] text-white/50">Active</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-extrabold text-emerald-300">{stats?.completedOrders ?? 0}</p>
            <p className="mt-0.5 text-[11px] text-white/50">Completed</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-lg font-extrabold text-violet-300">{money(stats?.totalSpent, currency())}</p>
            <p className="mt-0.5 text-[11px] text-white/50">Spent</p>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-white/45">Quick actions</p>
      <div className="grid grid-cols-3 gap-2.5">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to} className="card card-hover flex flex-col items-center gap-1 px-2 py-3.5">
            <span className="text-2xl">{q.icon}</span>
            <span className="text-[12px] font-semibold text-white/80">{q.label}</span>
          </Link>
        ))}
      </div>

      {/* Announcements */}
      <div className="mb-2 mt-5 flex items-center gap-1.5">
        <Megaphone size={14} className="text-amber-300" />
        <p className="text-xs font-bold uppercase tracking-wide text-white/45">Announcements</p>
      </div>
      {news.length === 0 ? (
        <EmptyState icon="📢" title="No announcements" hint="Panel news will appear here." />
      ) : (
        <div className="space-y-2.5">
          {news.map((a) => (
            <div key={a.id} className="card border-l-2 border-l-amber-400/60 p-3.5">
              <p className="text-sm font-semibold text-white">{a.title}</p>
              <p className="mt-0.5 text-[13px] text-white/55">{a.body}</p>
              <p className="mt-1.5 text-[11px] text-white/35">{timeAgo(a.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent orders */}
      <div className="mb-2 mt-5 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-white/45">Recent orders</p>
        <Link to="/orders" className="flex items-center gap-0.5 text-xs font-semibold text-violet-300">
          View all <ArrowRight size={13} />
        </Link>
      </div>
      {loading ? (
        <Skeleton lines={2} />
      ) : recent.length === 0 ? (
        <EmptyState
          icon="🛒"
          title="No orders yet"
          hint="Place your first order in seconds."
          action={<Link to="/order" className="grad-btn rounded-xl px-4 py-2 text-sm font-semibold text-white">New Order</Link>}
        />
      ) : (
        <div className="space-y-2.5">
          {recent.map((o) => {
            const svc = serviceById(services, o.service_id)
            return (
              <Link key={o.id} to="/orders" className="card card-hover block p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">{shortId(o.id)}</p>
                  <Badge status={o.status} />
                </div>
                <p className="mt-1 truncate text-[13px] text-white/60">{svc?.name || `Service #${o.service_id}`}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
                  <span className="flex items-center gap-1"><Layers size={11} /> {Number(o.quantity).toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Wallet size={11} /> {money(o.charge, currency())}</span>
                  <span>{timeAgo(o.created_at)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="mt-5 flex items-center justify-center gap-1.5 pb-2 text-[11px] text-white/30">
        <LifeBuoy size={12} /> Need help? Open a ticket anytime.
      </div>
    </div>
  )
}
