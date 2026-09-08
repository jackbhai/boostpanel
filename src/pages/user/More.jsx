import { ChevronRight, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Btn, PageHead } from '../../components/ui'
import { useStore } from '../../lib/store'

const LINKS = [
  { to: '/mass-order', icon: '📦', label: 'Mass Order', hint: 'Bulk ordering' },
  { to: '/funds', icon: '💰', label: 'Add Funds', hint: 'UPI · Card · Crypto' },
  { to: '/transactions', icon: '🧾', label: 'Transactions', hint: 'Payment history' },
  { to: '/tickets', icon: '🎫', label: 'Support Tickets', hint: 'Get help' },
  { to: '/api', icon: '🔌', label: 'API Docs', hint: 'For resellers' },
  { to: '/profile', icon: '👤', label: 'Profile & Settings', hint: 'Account' },
]

export default function More() {
  const { profile, logout, settings } = useStore()
  const navigate = useNavigate()
  const admin = profile?.role === 'admin'

  const out = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <PageHead title="More" sub={profile?.email} />

      {admin && (
        <Link to="/admin" className="mb-3 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-orange-500/10 p-4">
          <span className="text-2xl">🛠️</span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-white">Admin Panel</span>
            <span className="block text-[12px] text-amber-200/70">Manage users, orders & funds</span>
          </span>
          <ChevronRight size={18} className="text-amber-300" />
        </Link>
      )}

      <div className="card divide-y divide-white/5 overflow-hidden !p-0">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="flex items-center gap-3 p-4 transition hover:bg-white/5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl">{l.icon}</span>
            <span className="flex-1">
              <span className="block text-[14px] font-semibold text-white">{l.label}</span>
              <span className="block text-[12px] text-white/40">{l.hint}</span>
            </span>
            <ChevronRight size={17} className="text-white/25" />
          </Link>
        ))}
      </div>

      <div className="card mt-3 p-4 text-[12px] leading-relaxed text-white/45">
        <p className="font-bold text-white/70">{settings?.site_name || 'BoostPanel'} · v2.0</p>
        <p className="mt-1">🟢 Backend: Supabase Live (secure cloud database)</p>
        {settings?.support_email && <p>Support: {settings.support_email}</p>}
      </div>

      <Btn variant="danger" onClick={out} className="mt-3 w-full py-3">
        <LogOut size={16} /> Log Out
      </Btn>
    </div>
  )
}
