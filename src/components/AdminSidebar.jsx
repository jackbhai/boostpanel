import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import GlobalSearch from './GlobalSearch'
import { useStore } from '../lib/store'
import {
  ClipboardList, Home, Layers, LogOut, Megaphone, Plug, Receipt, Rocket, Search, Settings,
  Shield, ShoppingCart, Star, Tag, Ticket, TrendingUp, Users, Wallet, X,
} from './icons'

const LINKS = [
  { to: '/admin', end: true, label: 'Dashboard', icon: Home },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/funds', label: 'Funds', icon: Wallet },
  { to: '/admin/services', label: 'Services', icon: ClipboardList },
  { to: '/admin/providers', label: 'API / Providers', icon: Plug },
  { to: '/admin/tickets', label: 'Tickets', icon: Ticket },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag },
  { to: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/content', label: 'Content', icon: Layers },
  { to: '/admin/insight', label: 'API Insight', icon: TrendingUp },
  { to: '/admin/risk', label: 'Risk Center', icon: Shield },
  { to: '/admin/logs', label: 'Activity Logs', icon: Receipt },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminSidebar({ mobileOpen, setMobileOpen }) {
  const { logout } = useStore()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const close = () => setMobileOpen(false)
  const out = async () => {
    await logout()
    navigate('/login')
  }

  const body = (
    <div className="flex h-full flex-col">
      <button className="flex items-center gap-2 px-5 pb-5 pt-6 text-left" onClick={() => { navigate('/admin'); close() }}>
        <span className="grad-btn flex h-9 w-9 items-center justify-center rounded-xl shadow-lg shadow-violet-600/30">
          <Rocket size={19} className="text-white" />
        </span>
        <span>
          <span className="block text-[15px] font-extrabold tracking-tight text-white">
            Boost<span className="grad-text">Panel</span>
          </span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Admin Console</span>
        </span>
      </button>
      <div className="px-3 pb-2">
        <button onClick={() => setSearchOpen(true)} className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13px] font-semibold text-white/40 transition hover:border-violet-500/40 hover:text-white/70">
          <Search size={16} /> Search… <kbd className="ml-auto rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            onClick={close}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold transition ${
                isActive
                  ? 'bg-violet-500/15 text-white shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]'
                  : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <l.icon size={18} />
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => { navigate('/'); close() }}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold text-white/50 transition hover:bg-white/5 hover:text-white"
        >
          <Home size={18} />View site
        </button>
        <button
          onClick={out}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold text-white/50 transition hover:bg-rose-500/10 hover:text-rose-300"
        >
          <LogOut size={18} />Log out
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-white/10 bg-[#050507] md:block">
        {body}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={close} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-white/10 bg-[#050507]">
            <button onClick={close} aria-label="Close menu" className="absolute right-3 top-5 rounded-lg p-1.5 text-white/50 hover:bg-white/10">
              <X size={20} />
            </button>
            {body}
          </aside>
        </div>
      )}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
