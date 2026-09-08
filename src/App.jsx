import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { AdminLayout, BootSplash, RequireAdmin, RequireAuth, UserLayout } from './components/layout'
import { Toasts, toast } from './components/ui'
import { Plug } from './components/icons'
import { useStore } from './lib/store'
import { bus } from './lib/cache'
import { lockPrefs, useIdleLogout } from './lib/security'

/* Route code-splitting: each panel page loads on demand (fast first paint). */
const Login = lazy(() => import('./pages/auth').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('./pages/auth').then((m) => ({ default: m.Signup })))
const AdminBroadcast = lazy(() => import('./pages/admin/Broadcast'))
const AdminContent = lazy(() => import('./pages/admin/Content'))
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminInsight = lazy(() => import('./pages/admin/Insight'))
const AdminReviews = lazy(() => import('./pages/admin/Reviews'))
const AdminRisk = lazy(() => import('./pages/admin/Risk'))
const AdminFunds = lazy(() => import('./pages/admin/Funds'))
const AdminLogs = lazy(() => import('./pages/admin/Logs'))
const AdminOrders = lazy(() => import('./pages/admin/Orders'))
const AdminProviders = lazy(() => import('./pages/admin/Providers'))
const AdminServices = lazy(() => import('./pages/admin/Services'))
const AdminSettings = lazy(() => import('./pages/admin/Settings'))
const AdminTickets = lazy(() => import('./pages/admin/Tickets'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AddFunds = lazy(() => import('./pages/user/AddFunds'))
const Analytics = lazy(() => import('./pages/user/Analytics'))
const ApiDocs = lazy(() => import('./pages/user/ApiDocs'))
const Dashboard = lazy(() => import('./pages/user/Dashboard'))
const Help = lazy(() => import('./pages/user/Help'))
const Library = lazy(() => import('./pages/user/Library'))
const MassOrder = lazy(() => import('./pages/user/MassOrder'))
const More = lazy(() => import('./pages/user/More'))
const Notifications = lazy(() => import('./pages/user/Notifications'))
const Playground = lazy(() => import('./pages/user/Playground'))
const Rewards = lazy(() => import('./pages/user/Rewards'))
const NewOrder = lazy(() => import('./pages/user/NewOrder'))
const Orders = lazy(() => import('./pages/user/Orders'))
const Profile = lazy(() => import('./pages/user/Profile'))
const Services = lazy(() => import('./pages/user/Services'))
const UserTickets = lazy(() => import('./pages/user/Tickets').then((m) => ({ default: m.Tickets })))
const TicketDetail = lazy(() => import('./pages/user/Tickets').then((m) => ({ default: m.TicketDetail })))
const Transactions = lazy(() => import('./pages/user/Transactions'))

function IdleLock() {
  const { user, logout } = useStore()
  const [tick, setTick] = useState(0)
  useEffect(() => bus.on('prefs', () => setTick((t) => t + 1)), [])
  const prefs = useMemo(lockPrefs, [user?.id, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  useIdleLogout(!!user && prefs.on, prefs.mins, async () => {
    toast('Locked due to inactivity — please log in again', 'info')
    await logout()
  })
  return null
}

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
      <IdleLock />
      <Suspense fallback={<BootSplash />}>
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
            <Route path="/tickets" element={<UserTickets />} />
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
      </Suspense>
    </Router>
  )
}
