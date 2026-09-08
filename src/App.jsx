import { useEffect } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { AdminLayout, BootSplash, RequireAdmin, RequireAuth, UserLayout } from './components/layout'
import { Toasts } from './components/ui'
import { Plug } from './components/icons'
import { useStore } from './lib/store'
import { Login, Signup } from './pages/auth'
import AdminBroadcast from './pages/admin/Broadcast'
import AdminContent from './pages/admin/Content'
import AdminCoupons from './pages/admin/Coupons'
import AdminDashboard from './pages/admin/Dashboard'
import AdminInsight from './pages/admin/Insight'
import AdminReviews from './pages/admin/Reviews'
import AdminRisk from './pages/admin/Risk'
import AdminFunds from './pages/admin/Funds'
import AdminLogs from './pages/admin/Logs'
import AdminOrders from './pages/admin/Orders'
import AdminProviders from './pages/admin/Providers'
import AdminServices from './pages/admin/Services'
import AdminSettings from './pages/admin/Settings'
import AdminTickets from './pages/admin/Tickets'
import AdminUsers from './pages/admin/Users'
import AddFunds from './pages/user/AddFunds'
import Analytics from './pages/user/Analytics'
import ApiDocs from './pages/user/ApiDocs'
import Dashboard from './pages/user/Dashboard'
import Help from './pages/user/Help'
import Library from './pages/user/Library'
import MassOrder from './pages/user/MassOrder'
import More from './pages/user/More'
import Notifications from './pages/user/Notifications'
import Playground from './pages/user/Playground'
import Rewards from './pages/user/Rewards'
import NewOrder from './pages/user/NewOrder'
import Orders from './pages/user/Orders'
import Profile from './pages/user/Profile'
import Services from './pages/user/Services'
import { TicketDetail, Tickets } from './pages/user/Tickets'
import Transactions from './pages/user/Transactions'

function AdminTicketDetail() {
  return <TicketDetail role="admin" backTo="/admin/tickets" />
}

function SetupNeeded() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="card max-w-md p-8 text-center">
        <Plug size={40} className="mx-auto text-violet-300" />
        <h1 className="mt-3 text-xl font-extrabold text-white">Backend not configured</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Add your Supabase credentials to <span className="font-mono text-violet-300">.env</span> and
          restart the server. See README for the 5-minute setup.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-black/40 p-3 text-left font-mono text-[12px] text-emerald-200">
          VITE_SUPABASE_URL=https://…supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=eyJhbGciOi…
        </pre>
      </div>
    </div>
  )
}

function Maintenance() {
  const { logout } = useStore()
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="card max-w-md p-8 text-center">
        <p className="grad-text text-xl font-extrabold">Under maintenance</p>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          The panel is being upgraded. Please come back in a few minutes.
        </p>
        <button onClick={logout} className="mt-4 rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10">
          Log out
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { boot, booted, setupError, settings, profile } = useStore()

  useEffect(() => {
    boot()
  }, [])

  if (!booted) return <BootSplash />
  if (setupError) return <SetupNeeded />
  if (settings?.maintenance && profile && profile.role !== 'admin') return <Maintenance />

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Toasts />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* ── User panel ── */}
        <Route element={<RequireAuth />}>
          <Route element={<UserLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/order" element={<NewOrder />} />
            <Route path="/services" element={<Services />} />
            <Route path="/mass-order" element={<MassOrder />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/funds" element={<AddFunds />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/api" element={<ApiDocs />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/library" element={<Library />} />
            <Route path="/help" element={<Help />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/more" element={<More />} />
          </Route>
        </Route>

        {/* ── Admin panel ── */}
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/services" element={<AdminServices />} />
            <Route path="/admin/providers" element={<AdminProviders />} />
            <Route path="/admin/funds" element={<AdminFunds />} />
            <Route path="/admin/tickets" element={<AdminTickets />} />
            <Route path="/admin/tickets/:id" element={<AdminTicketDetail />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/coupons" element={<AdminCoupons />} />
            <Route path="/admin/broadcast" element={<AdminBroadcast />} />
            <Route path="/admin/reviews" element={<AdminReviews />} />
            <Route path="/admin/content" element={<AdminContent />} />
            <Route path="/admin/insight" element={<AdminInsight />} />
            <Route path="/admin/risk" element={<AdminRisk />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
