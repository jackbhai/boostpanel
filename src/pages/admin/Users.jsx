import { AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Btn, EmptyState, Field, Input, Modal, PageHead, SearchInput, Skeleton, toast } from '../../components/ui'
import { adjustBalance, listUsers, updateProfile } from '../../lib/db'
import { useStore } from '../../lib/store'
import { money, timeAgo } from '../../lib/utils'

export default function AdminUsers() {
  const { user: me, currency } = useStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    listUsers().then(setUsers).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const list = useMemo(() => users.filter((u) =>
    !q || `${u.email} ${u.id}`.toLowerCase().includes(q.toLowerCase())
  ), [users, q])

  const adjust = async (sign) => {
    const amt = Number(amount)
    if (!amt || amt <= 0) return toast('Enter a valid amount', 'error')
    setBusy(true)
    try {
      await adjustBalance(edit.id, sign * amt, `Manual ${sign > 0 ? 'credit' : 'debit'} by admin`)
      toast(`${sign > 0 ? 'Added' : 'Deducted'} ${money(amt, currency())}`)
      setAmount('')
      const fresh = await listUsers()
      setUsers(fresh)
      setEdit(fresh.find((u) => u.id === edit.id))
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const setRole = async (role) => {
    if (edit.id === me.id) return toast('You cannot change your own role', 'error')
    try {
      await updateProfile(edit.id, { role })
      toast(`User is now ${role}`)
      load()
      setEdit(null)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const setStatus = async (status) => {
    if (edit.id === me.id) return toast('You cannot ban yourself 😅', 'error')
    try {
      await updateProfile(edit.id, { status })
      toast(status === 'banned' ? 'User banned 🚫' : 'User unbanned ✅')
      load()
      setEdit(null)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div>
      <PageHead title="Users" sub={`${users.length} registered`} />
      <SearchInput value={q} onChange={setQ} placeholder="Search email…" />

      <div className="mt-4 space-y-2.5">
        {loading && <Skeleton lines={4} />}
        {!loading && list.length === 0 && <EmptyState icon="👥" title="No users found" />}
        {list.map((u) => (
          <button key={u.id} onClick={() => setEdit(u)} className="card card-hover flex w-full items-center gap-3 p-3.5 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/40 to-fuchsia-500/40 text-lg font-bold text-white">
              {u.email[0].toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-white">{u.email}</span>
              <span className="mt-0.5 block text-[11px] text-white/40">Joined {timeAgo(u.created_at)}</span>
            </span>
            <span className="text-right">
              <span className="block text-[15px] font-extrabold text-emerald-300">{money(u.balance, currency())}</span>
              <span className="mt-1 flex justify-end gap-1">
                {u.role === 'admin' && <Badge status="pending">admin</Badge>}
                {u.status === 'banned' ? <Badge status="banned" /> : <Badge status="active" />}
              </span>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {edit && (
          <Modal title="Manage user" onClose={() => setEdit(null)}>
            <div className="space-y-4">
              <div className="rounded-xl bg-white/5 p-3 text-[13px]">
                <p className="truncate font-bold text-white">{edit.email}</p>
                <p className="mt-0.5 text-white/50">Balance: <b className="text-emerald-300">{money(edit.balance, currency())}</b></p>
              </div>

              <Field label="Add / deduct balance">
                <div className="flex gap-2">
                  <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <Btn variant="success" onClick={() => adjust(1)} loading={busy} className="!px-4">+ Add</Btn>
                  <Btn variant="danger" onClick={() => adjust(-1)} loading={busy} className="!px-4">− Cut</Btn>
                </div>
              </Field>

              <Field label="Role">
                <div className="grid grid-cols-2 gap-2">
                  <Btn variant={edit.role === 'user' ? 'primary' : 'ghost'} onClick={() => setRole('user')}>👤 User</Btn>
                  <Btn variant={edit.role === 'admin' ? 'primary' : 'ghost'} onClick={() => setRole('admin')}>🛠️ Admin</Btn>
                </div>
              </Field>

              {edit.status === 'banned' ? (
                <Btn variant="success" onClick={() => setStatus('active')} className="w-full">Unban User</Btn>
              ) : (
                <Btn variant="danger" onClick={() => setStatus('banned')} className="w-full">Ban User 🚫</Btn>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
