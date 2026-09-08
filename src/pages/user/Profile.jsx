import { Copy, LogOut } from '../../components/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Field, Input, PageHead, toast } from '../../components/ui'
import { changePassword } from '../../lib/db'
import { useStore } from '../../lib/store'
import { fullDate, money } from '../../lib/utils'

export default function Profile() {
  const { profile, currency, logout, refreshProfile } = useStore()
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const savePw = async (e) => {
    e.preventDefault()
    if (newPw !== confirmPw) return toast('Passwords do not match', 'error')
    setBusy(true)
    try {
      await changePassword(newPw)
      setNewPw('')
      setConfirmPw('')
      toast('Password updated!')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const out = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <PageHead title="Profile" sub="Your account settings." />

      <div className="card flex items-center gap-3.5 p-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl font-extrabold text-white">
          {(profile?.email || 'U')[0].toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-white">{profile?.email}</p>
          <p className="mt-0.5 text-[12px] text-white/45">Member since {fullDate(profile?.created_at)}</p>
        </div>
        <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-bold uppercase text-violet-300">
          {profile?.role}
        </span>
      </div>

      <div className="card mt-3 flex items-center justify-between border-emerald-500/25 bg-emerald-500/5 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Balance</p>
          <p className="text-2xl font-extrabold text-emerald-300">{money(profile?.balance, currency())}</p>
        </div>
        <Btn onClick={() => navigate('/funds')} className="!py-2 text-[13px]">+ Add Funds</Btn>
      </div>

      <div className="card mt-3 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-white/45">API key</p>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="flex-1 truncate rounded-xl border border-white/10 bg-black/40 p-2.5 font-mono text-[12px] text-violet-200">
            {profile?.api_key}
          </p>
          <button
            onClick={() => { navigator.clipboard.writeText(profile?.api_key || ''); toast('API key copied!') }}
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/60 hover:bg-white/10"
          >
            <Copy size={16} />
          </button>
        </div>
        <button onClick={() => { refreshProfile(); navigate('/api') }} className="mt-2 text-[13px] font-semibold text-violet-300">
          View API docs →
        </button>
      </div>

      <div className="card mt-3 p-4">
        <p className="mb-3 text-sm font-bold text-white">Change password</p>
        <form onSubmit={savePw} className="space-y-3">
          <Field label="New password">
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
          </Field>
          <Btn type="submit" loading={busy} variant="ghost" className="w-full">Update Password</Btn>
        </form>
      </div>

      <Btn variant="danger" onClick={out} className="mt-4 w-full py-3">
        <LogOut size={16} /> Log Out
      </Btn>
    </div>
  )
}
