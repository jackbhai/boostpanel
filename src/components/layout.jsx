import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { money } from '../lib/utils'
import { ClipboardList, Home, LayoutGrid, Plus, Rocket, Settings, ShoppingCart, Users, Wallet } from './icons'

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
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <span className="grad-btn mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-violet-600/30">
          <Rocket size={30} className="text-white" />
        </span>
        <p className="grad-text mt-3 text-xl font-extrabold">BoostPanel</p>
        <p className="mt-1 text-xs text-white/40">loading…</p>
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
  const { profile, currency } = useStore()
  const navigate = useNavigate()
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
              onClick={() => navigate('/profile')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white"
            >
              {(profile?.email || 'U')[0].toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-32 pt-4">
        <Outlet />
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

const ADMIN_TABS = [
  { to: '/admin', icon: Home, label: 'Home', end: true },
  { to: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/funds', icon: Wallet, label: 'Funds' },
  { to: '/admin/settings', icon: Settings, label: 'Setup' },
]

export function AdminLayout() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen">
      <LiveBar />
      <header className="sticky top-0 z-40 border-b border-amber-500/15 bg-black/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/admin')}><Logo admin /></button>
          <button
            onClick={() => navigate('/')}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10"
          >
            ← View site
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-stretch px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1">
          {ADMIN_TABS.map((t) => <Tab key={t.to} {...t} end={t.end} />)}
        </div>
      </nav>
    </div>
  )
}
