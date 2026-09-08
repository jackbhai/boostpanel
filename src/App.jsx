import { useEffect } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { AdminLayout, BootSplash, RequireAdmin, RequireAuth, UserLayout } from './components/layout'
import { Toasts } from './components/ui'
import { useStore } from './lib/store'
import { Login, Signup } from './pages/auth'
import AdminDashboard from './pages/admin/Dashboard'
import AdminFunds from './pages/admin/Funds'
import AdminOrders from './pages/admin/Orders'
import AdminProviders from './pages/admin/Providers'
import AdminServices from './pages/admin/Services'
import AdminSettings from './pages/admin/Settings'
import AdminTickets from './pages/admin/Tickets'
import AdminUsers from './pages/admin/Users'
import AddFunds from './pages/user/AddFunds'
import ApiDocs from './pages/user/ApiDocs'
import Dashboard from './pages/user/Dashboard'
import MassOrder from './pages/user/MassOrder'
import More from './pages/user/More'
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
        <p className="text-4xl">🔌</p>
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

export default function App() {
  const { boot, booted, setupError } = useStore()

  useEffect(() => {
    boot()
  }, [])

  if (!booted) return <BootSplash />
  if (setupError) return <SetupNeeded />

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
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
