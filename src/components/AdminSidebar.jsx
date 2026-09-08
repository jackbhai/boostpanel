import { NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import {
  ClipboardList, Home, LogOut, Plug, Receipt, Rocket, Settings,
  ShoppingCart, Ticket, Users, Wallet, X,
} from './icons'

const LINKS = [
  { to: '/admin', end: true, label: 'Dashboard', icon: Home },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/funds', label: 'Funds', icon: Wallet },
  { to: '/admin/services', label: 'Services', icon: ClipboardList },
  { to: '/admin/providers', label: 'API / Providers', icon: Plug },
  { to: '/admin/tickets', label: 'Tickets', icon: Ticket },
  { to: '/admin/logs', label: 'Activity Logs', icon: Receipt },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminSidebar({ mobileOpen, setMobileOpen }) {
  const { logout } = useStore()
  const navigate = useNavigate()

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
    </>
  )
}
