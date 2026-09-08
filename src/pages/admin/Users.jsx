import { useEffect, useMemo, useState } from 'react'
import { adjustBalance, getUserOrders, listUsers, updateUserAdmin } from '../../lib/db'
import { useStore } from '../../lib/store'
import { money } from '../../lib/utils'
import { downloadCSV } from '../../lib/csv'
import {
  Badge, Btn, EmptyState, Input, Modal, PageHead,
  SearchInput, Select, Skeleton, toast,
} from '../../components/ui'
import { BadgeCheck, Check, Download, Pencil, Wallet, XCircle } from '../../components/icons'

const small = '!px-3 !py-1.5 text-[12px]'

export default function AdminUsers() {
  const { currency } = useStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [rf, setRf] = useState('all')
  const [sf, setSf] = useState('all')
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState({ role: 'user', status: 'active', discount_pct: 0, order_limit: 0, note: '' })
  const [adj, setAdj] = useState({ delta: '', note: '' })
  const [spent, setSpent] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      setUsers((await listUsers()) || [])
    } catch (e) {
      toast(e.message, 'error')
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return users.filter((u) => {
      if (rf !== 'all' && u.role !== rf) return false
      if (sf !== 'all' && u.status !== sf) return false
      if (s && !(u.email || '').toLowerCase().includes(s)) return false
      return true
    })
  }, [users, q, rf, sf])

  const open = async (u) => {
    setSel(u)
    setForm({ role: u.role, status: u.status, discount_pct: u.discount_pct || 0, order_limit: u.order_limit || 0, note: u.note || '' })
    setAdj({ delta: '', note: '' })
    setSpent(null)
    try {
      const o = await getUserOrders(u.id)
      setSpent({ n: o.length, total: o.reduce((a, x) => a + Number(x.charge || 0), 0) })
    } catch { setSpent({ n: 0, total: 0 }) }
  }

  const save = async () => {
    setBusy(true)
    try {
      await updateUserAdmin(sel.id, { ...form, discount_pct: Number(form.discount_pct) || 0, order_limit: Number(form.order_limit) || 0 })
      toast(`Saved ${sel.email}.`)
      setSel({ ...sel, ...form, discount_pct: Number(form.discount_pct) || 0, order_limit: Number(form.order_limit) || 0 })
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
    setBusy(false)
  }

  const adjust = async () => {
    setBusy(true)
    try {
      const bal = await adjustBalance(sel.id, Number(adj.delta), adj.note || 'Manual adjustment by admin')
      toast(`Balance updated → ${money(bal, currency())}.`)
      setSel({ ...sel, balance: bal })
      setAdj({ delta: '', note: '' })
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
    setBusy(false)
  }

  const quick = async (u, patch) => {
    try {
      await updateUserAdmin(u.id, patch)
      toast(`${u.email} updated.`)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  if (loading) return <Skeleton lines={5} />
  return (
    <div>
      <PageHead title="Users" sub="Balance, discount, limits, role — everything is in your hands." />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search email…" /></div>
        <Select value={rf} onChange={(e) => setRf(e.target.value)} className="sm:w-36">
          <option value="all">All roles</option><option value="user">Users</option><option value="admin">Admins</option>
        </Select>
        <Select value={sf} onChange={(e) => setSf(e.target.value)} className="sm:w-36">
          <option value="all">All status</option><option value="active">Active</option><option value="banned">Banned</option>
        </Select>
        <Btn variant="ghost" onClick={() => downloadCSV('users.csv', rows.map((u) => ({ email: u.email, balance: u.balance, role: u.role, status: u.status, discount: u.discount_pct, limit: u.order_limit, joined: u.created_at })))} className={small}><Download size={14} />CSV</Btn>
      </div>
      <p className="mb-3 text-xs text-white/40">{rows.length} users · tap a row to manage.</p>
      {rows.length === 0 ? <EmptyState title="No users found" /> : (
        <div className="space-y-2">
          {rows.map((u) => (
            <div key={u.id} onClick={() => open(u)} className="card card-hover cursor-pointer p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-white">{u.email}</span>
                {u.role === 'admin' && <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300"><BadgeCheck size={11} />ADMIN</span>}
                <Badge status={u.status} />
                <span className="text-[13px] font-extrabold text-emerald-300">{money(u.balance, currency())}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/40">
                <span>discount {u.discount_pct || 0}%</span>
                <span>daily limit {u.order_limit > 0 ? u.order_limit : 'unlimited'}</span>
                {u.note && <span className="truncate">note: {u.note}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {sel && (
        <Modal title={sel.email} onClose={() => setSel(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/5 p-2.5"><p className="text-[10px] uppercase tracking-wide text-white/40">Balance</p><p className="text-sm font-extrabold text-emerald-300">{money(sel.balance, currency())}</p></div>
              <div className="rounded-xl bg-white/5 p-2.5"><p className="text-[10px] uppercase tracking-wide text-white/40">Orders</p><p className="text-sm font-extrabold text-white">{spent ? spent.n : '…'}</p></div>
              <div className="rounded-xl bg-white/5 p-2.5"><p className="text-[10px] uppercase tracking-wide text-white/40">Spent</p><p className="text-sm font-extrabold text-white">{spent ? money(spent.total, currency()) : '…'}</p></div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-white/60">Add / remove balance</p>
              <div className="flex gap-2">
                <Input value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} placeholder="+100 or -50" type="number" />
                <Input value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} placeholder="Note" />
                <Btn onClick={adjust} loading={busy} disabled={!adj.delta} className={small}><Wallet size={14} />Apply</Btn>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-xs font-bold text-white/60">Role</span>
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="user">User</option><option value="admin">Admin</option></Select></label>
              <label className="block"><span className="mb-1 block text-xs font-bold text-white/60">Status</span>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="banned">Banned</option></Select></label>
              <label className="block"><span className="mb-1 block text-xs font-bold text-white/60">Discount % (all orders)</span>
                <Input value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })} type="number" min="0" max="100" /></label>
              <label className="block"><span className="mb-1 block text-xs font-bold text-white/60">Daily order limit (0 = ∞)</span>
                <Input value={form.order_limit} onChange={(e) => setForm({ ...form, order_limit: e.target.value })} type="number" min="0" /></label>
            </div>
            <label className="block"><span className="mb-1 block text-xs font-bold text-white/60">Private note (only admins see)</span>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. VIP reseller, pays monthly" /></label>
            <div className="flex gap-2">
              <Btn onClick={save} loading={busy} className="flex-1"><Pencil size={15} />Save user</Btn>
              {sel.status === 'active'
                ? <Btn variant="danger" onClick={() => { quick(sel, { status: 'banned' }); setSel(null) }}><XCircle size={15} />Ban</Btn>
                : <Btn variant="success" onClick={() => { quick(sel, { status: 'active' }); setSel(null) }}><Check size={15} />Unban</Btn>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
