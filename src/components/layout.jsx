import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import AdminSidebar from './AdminSidebar'
import { useStore } from '../lib/store'
import { money } from '../lib/utils'
import { bust, bus } from '../lib/cache'
import { useAdminLive, useLiveBadge, useUserLive } from '../lib/live'
import { sfx } from '../lib/sound'
import { toast } from './ui'
import { PageFade } from './motion'
import { Bell, ClipboardList, Home, LayoutGrid, Menu, Plus, Rocket, Settings, ShoppingCart, Users, Wallet } from './icons'

/* ------------------------------ Guards ------------------------------ */

export function RequireAuth() {
  const { user, booted } = useStore()
  if (!booted) return <BootSplash />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { user, profile, booted } = useStore()
  if (!booted) return <BootSplash />
  if (!user) return <Navigate to="/login" replace />
  if (profile?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

export function BootSplash() {
  return (
    <div className="auth-stage flex min-h-screen items-center justify-center">
      <div className="auth-orb a" />
      <div className="auth-orb b" />
      <div className="relative text-center">
        <span className="halo grad-btn mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-violet-600/30">
          <Rocket size={30} className="text-white" />
        </span>
        <p className="grad-text mt-3 text-xl font-extrabold">BoostPanel</p>
        <div className="mx-auto mt-3 h-1 w-36 overflow-hidden rounded-full bg-white/10">
          <div className="boot-bar h-full w-1/3 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Shared ------------------------------ */

export function Logo({ admin }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grad-btn flex h-9 w-9 items-center justify-center rounded-xl shadow-lg shadow-violet-600/30">
        <Rocket size={19} className="text-white" />
      </span>
      <span className="text-[17px] font-extrabold tracking-tight text-white">
        Boost<span className="grad-text">Panel</span>
        {admin && (
          <span className="ml-1.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-amber-300">
            Admin
          </span>
        )}
      </span>
    </div>
  )
}

function LiveBar() {
  return (
    <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-center text-[11px] text-emerald-200">
      <span className="live-dot mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Live — connected to secure cloud database
    </div>
  )
}

function Tab({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-semibold transition ${
          isActive ? 'text-violet-300' : 'text-white/35 hover:text-white/60'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`rounded-xl p-1.5 transition ${isActive ? 'bg-violet-500/20' : ''}`}>
            <Icon size={20} />
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}

function OrderFab() {
  const loc = useLocation()
  const active = loc.pathname === '/order'
  return (
    <NavLink to="/order" className="relative flex flex-1 flex-col items-center">
      <span
        className={`grad-btn -mt-7 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl shadow-violet-600/40 transition active:scale-95 ${
          active ? 'ring-2 ring-fuchsia-300/60' : ''
        }`}
      >
        <Plus size={26} strokeWidth={2.5} />
      </span>
      <span className={`mt-0.5 text-[10px] font-semibold ${active ? 'text-violet-300' : 'text-white/35'}`}>Order</span>
    </NavLink>
  )
}

/* ---------------------------- User layout ---------------------------- */

const USER_TABS_LEFT = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/services', icon: LayoutGrid, label: 'Services' },
]
const USER_TABS_RIGHT = [
  { to: '/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/more', icon: ClipboardList, label: 'More' },
]

export function UserLayout() {
  const { user, profile, currency, refreshProfile, refreshCatalog } = useStore()
  const navigate = useNavigate()
  const loc = useLocation()
  const unread = useLiveBadge(user?.id)

  /* Global instant feed: notifs pop, orders/funds refresh live. No polling. */
  useUserLive(user?.id, {
    onNotif: (n) => {
      bus.emit('notifs', n)
      toast(n.title, 'info')
    },
    onOrder: (p) => {
      bus.emit('orders', p)
      refreshProfile()
      if (p.eventType === 'UPDATE' && p.new?.status === 'completed') {
        toast(`Order #${p.new.id} completed`, 'success')
        sfx('coin')
      } else if (p.eventType === 'UPDATE' && ['canceled', 'refunded'].includes(p.new?.status)) {
        toast(`Order #${p.new.id} ${p.new.status} — refunded`, 'info')
      }
    },
    onTxn: (p) => {
      bus.emit('txns', p)
      refreshProfile()
      if (p.eventType === 'UPDATE' && p.new?.status === 'approved' && p.new?.type === 'credit') {
        toast(`+${money(p.new.amount, currency())} added to balance`, 'success')
        sfx('coin')
      } else if (p.eventType === 'UPDATE' && p.new?.status === 'rejected') {
        toast('A deposit was rejected — see Transactions', 'error')
      }
    },
    onTicket: (p) => {
      bus.emit('tickets', p)
      if (p.eventType === 'UPDATE' && p.new?.status === 'answered') toast('Support replied to your ticket', 'info')
    },
    onCatalog: () => {
      bust('catalog')
      refreshCatalog()
      bus.emit('catalog')
    },
    onAnnounce: (a) => {
      bus.emit('announce', a)
      if (a?.active !== false) toast(a.title, 'info')
    },
  })

  return (
    <div className="min-h-screen">
      <LiveBar />
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/')}><Logo /></button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/funds')}
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[13px] font-bold text-emerald-300"
            >
              <Wallet size={14} />
              {money(profile?.balance, currency())}
              <Plus size={13} className="opacity-70" />
            </button>
            <button
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
              className="tab-pop relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white"
            >
              <Bell size={17} />
              {unread > 0 && (
                <span className="animate-pop absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white"
            >
              {(profile?.email || 'U')[0].toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-32 pt-4">
        <PageFade k={loc.pathname}>
          <Outlet />
        </PageFade>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-stretch px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1">
          {USER_TABS_LEFT.map((t) => <Tab key={t.to} {...t} end={t.to === '/'} />)}
          <OrderFab />
          {USER_TABS_RIGHT.map((t) => <Tab key={t.to} {...t} />)}
        </div>
      </nav>
    </div>
  )
}

/* ---------------------------- Admin layout ---------------------------- */

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const loc = useLocation()

  /* Admin live desk: new tickets / orders / deposits ping instantly. */
  useAdminLive({
    onTicket: (t) => {
      bus.emit('admin-tickets', t)
      toast(`New ticket: ${(t.subject || '').slice(0, 60)}`, 'info')
      sfx('receive')
    },
    onReply: (m) => {
      if (m.sender_role === 'user') {
        bus.emit('admin-tickets', m)
        sfx('pop')
      }
    },
    onOrder: (o) => {
      bus.emit('admin-orders', o)
      toast(`New order #${o.id} — ${money(o.charge)}`, 'info')
    },
    onUser: (u) => {
      bus.emit('admin-users', u)
      toast(`New user signed up: ${u.email || String(u.id).slice(0, 8)}`, 'info')
      sfx('pop')
    },
    onTxn: (p) => {
      bus.emit('admin-txns', p)
      if (p.eventType === 'INSERT' && p.new?.type === 'credit' && p.new?.status === 'pending') {
        toast(`New deposit request: ${money(p.new.amount)}`, 'info')
        sfx('coin')
      }
    },
  })

  return (
    <div className="min-h-screen md:flex md:items-stretch">
      <AdminSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="min-w-0 flex-1">
        <LiveBar />
        <header className="sticky top-0 z-30 border-b border-amber-500/15 bg-black/90 backdrop-blur md:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70">
              <Menu size={20} />
            </button>
            <Logo admin />
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4 md:pt-6">
          <PageFade k={loc.pathname}>
            <Outlet />
          </PageFade>
        </main>
      </div>
    </div>
  )
}
