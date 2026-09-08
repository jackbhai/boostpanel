import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, EmptyState, PageHead, Skeleton, Stat, toast } from '../../components/ui'
import { Box, ClipboardList, Clock, Plug, Settings, ShoppingCart, Ticket, Users, Wallet } from '../../components/icons'
import { getAdminStats, getAllOrders } from '../../lib/db'
import { useStore } from '../../lib/store'
import { money, shortId, timeAgo } from '../../lib/utils'

const MANAGE = [
  { to: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/services', icon: ClipboardList, label: 'Services' },
  { to: '/admin/providers', icon: Plug, label: 'API' },
  { to: '/admin/funds', icon: Wallet, label: 'Funds' },
  { to: '/admin/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
]

const TOOLTIP_STYLE = { background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }

export default function AdminDashboard() {
  const { currency } = useStore()
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAdminStats(), getAllOrders()])
      .then(([s, orders]) => {
        setStats(s)
        setRecent(orders.slice(0, 5))
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHead title="Admin Dashboard" sub="Full control of your panel" />

      {loading || !stats ? (
        <Skeleton lines={3} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Revenue" value={money(stats.revenue, currency())} icon={<Wallet size={20} />} accent="text-emerald-300" sub={`${stats.orders} orders`} />
            <Stat label="Users" value={stats.users} icon={<Users size={20} />} accent="text-sky-300" sub="registered" />
            <Link to="/admin/funds" className="block">
              <Stat label="Pending funds" value={stats.pendingFunds} icon={<Clock size={20} />} accent={stats.pendingFunds ? 'text-amber-300' : 'text-white'} sub="need approval" />
            </Link>
            <Link to="/admin/tickets" className="block">
              <Stat label="Open tickets" value={stats.openTickets} icon={<Ticket size={20} />} accent={stats.openTickets ? 'text-rose-300' : 'text-white'} sub="need reply" />
            </Link>
          </div>

          <div className="card mt-3 p-4">
            <p className="mb-2 text-sm font-bold text-white">Revenue — last 7 days</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.series}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => [money(v, currency()), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#a78bfa" strokeWidth={2.5} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card mt-3 p-4">
            <p className="mb-2 text-sm font-bold text-white">Orders — last 7 days</p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.series}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="orders" fill="#22d3ee" radius={[6, 6, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-white/45">Manage</p>
      <div className="grid grid-cols-3 gap-2.5">
        {MANAGE.map((m) => (
          <Link key={m.to} to={m.to} className="card card-hover relative flex flex-col items-center gap-1.5 px-2 py-4">
            <m.icon size={26} className="text-violet-300" />
            <span className="text-[12px] font-semibold text-white/80">{m.label}</span>
            {m.to === '/admin/funds' && stats?.pendingFunds > 0 && (
              <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
                {stats.pendingFunds}
              </span>
            )}
            {m.to === '/admin/tickets' && stats?.openTickets > 0 && (
              <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {stats.openTickets}
              </span>
            )}
          </Link>
        ))}
      </div>

      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-white/45">Latest orders</p>
      {recent.length === 0 && !loading && <EmptyState icon={<Box size={40} />} title="No orders yet" />}
      <div className="space-y-2">
        {recent.map((o) => (
          <Link key={o.id} to="/admin/orders" className="card card-hover flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-white">{shortId(o.id)} <span className="font-normal text-white/40">· {Number(o.quantity).toLocaleString()} qty</span></p>
              <p className="truncate text-[11px] text-white/40">{o.link}</p>
            </div>
            <div className="text-right">
              <Badge status={o.status} />
              <p className="mt-1 text-[11px] text-white/40">{timeAgo(o.created_at)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
