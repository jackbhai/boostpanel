import { AlertCircle, Check, Copy, LogOut, Shield, Wifi, X } from '../../components/icons'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Field, Input, PageHead, toast } from '../../components/ui'
import { changePassword, deleteAccountSelf, killSession, mySessions, setEmailSelf, touchSession } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { fullDate, money } from '../../lib/utils'

export default function Profile() {
  const { user, profile, currency, logout, refreshProfile } = useStore()
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [sessions, setSessions] = useState([])
  const [accent, setAccent] = useState(() => localStorage.getItem('bp_accent') || 'violet')
  const [busy2, setBusy2] = useState(null)
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

  useEffect(() => {
    if (profile?.email) setEmail(profile.email)
    if (user) {
      const device = `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'} · ${navigator.platform || 'Web'}`
      touchSession(user.id, device).catch(() => {})
      mySessions(user.id).then(setSessions).catch(() => {})
    }
    document.documentElement.dataset.accent = localStorage.getItem('bp_accent') || 'violet'
  }, [user])

  const setAccentAll = async (a) => {
    setAccent(a)
    localStorage.setItem('bp_accent', a)
    document.documentElement.dataset.accent = a
    try { await supabase.from('profiles').update({ accent: a }).eq('id', user.id) } catch { /* local only */ }
  }

  const changeEmail = async (e) => {
    e.preventDefault()
    if (!email.trim() || email.trim().toLowerCase() === profile?.email) return
    setEmailBusy(true)
    try {
      await setEmailSelf(email.trim())
      await refreshProfile()
      toast('Email updated! Use it on your next login.')
    } catch (err) { toast(err.message, 'error') }
    setEmailBusy(false)
  }

  const removeSession = async (id) => {
    try { await killSession(id); setSessions(sessions.filter((s) => s.id !== id)) }
    catch (err) { toast(err.message, 'error') }
  }

  const nukeAccount = async () => {
    const c = window.prompt('Type DELETE to permanently delete your account, balance and history. This cannot be undone:')
    if (c !== 'DELETE') return
    setBusy2('del')
    try {
      await deleteAccountSelf()
      await logout()
      navigate('/signup', { replace: true })
    } catch (err) { toast(err.message, 'error') }
    setBusy2(null)
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

      <div className="card mt-3 grid grid-cols-2 gap-2 p-4 text-center">
        <button onClick={() => navigate('/rewards')}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Loyalty points</p>
          <p className="text-xl font-extrabold text-amber-300">{profile?.loyalty_points || 0}</p>
        </button>
        <button onClick={() => navigate('/rewards')}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Referral code</p>
          <p className="font-mono text-xl font-extrabold tracking-widest text-violet-200">{profile?.referral_code || '—'}</p>
        </button>
      </div>

      <div className="card mt-3 p-4">
        <p className="text-sm font-bold text-white">App theme</p>
        <div className="mt-2.5 flex gap-2.5">
          {[['violet', '#8b5cf6'], ['sky', '#0ea5e9'], ['emerald', '#10b981'], ['amber', '#f59e0b'], ['rose', '#f43f5e'], ['orange', '#f97316']].map(([id, c]) => (
            <button
              key={id}
              onClick={() => setAccentAll(id)}
              aria-label={`${id} theme`}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition ${accent === id ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : 'opacity-60 hover:opacity-100'}`}
              style={{ background: c }}
            >
              {accent === id && <Check size={16} className="text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-3 p-4">
        <p className="mb-2.5 text-sm font-bold text-white">Change email</p>
        <form onSubmit={changeEmail} className="flex gap-2">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="flex-1" />
          <Btn type="submit" loading={emailBusy} variant="ghost" className="!py-2 text-[13px]">Update</Btn>
        </form>
      </div>

      <div className="card mt-3 p-4">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-white"><Wifi size={15} className="text-sky-300" /> Login sessions</p>
        <p className="mb-2 text-[12px] text-white/45">Devices recorded on your account.</p>
        {sessions.length === 0 ? <p className="text-[12.5px] text-white/40">No sessions recorded yet.</p> : (
          <div className="space-y-1.5">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[12.5px]">
                <span className="flex-1 truncate text-white/70">{s.device || 'Unknown device'}</span>
                <span className="shrink-0 text-[11px] text-white/35">{new Date(s.last_seen).toLocaleDateString()}</span>
                <button onClick={() => removeSession(s.id)} aria-label="Remove session" className="rounded-lg p-1 text-white/35 hover:bg-white/10 hover:text-rose-300"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(profile?.discount_pct > 0 || profile?.order_limit > 0) && (
        <div className="card mt-3 flex gap-2 border-violet-500/25 bg-violet-500/5 p-4 text-center">
          {profile?.discount_pct > 0 && (
            <div className="flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Your discount</p><p className="text-xl font-extrabold text-violet-200">{profile.discount_pct}%</p></div>
          )}
          {profile?.order_limit > 0 && (
            <div className="flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Daily order limit</p><p className="text-xl font-extrabold text-white">{profile.order_limit}</p></div>
          )}
        </div>
      )}
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

      <div className="card mt-3 border-rose-500/30 p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-rose-200"><Shield size={15} /> Danger zone</p>
        <p className="mt-1 text-[12.5px] text-white/50">Delete your account, balance, orders and history permanently.</p>
        <Btn variant="danger" onClick={nukeAccount} loading={busy2 === 'del'} className="mt-2.5 w-full !py-2 text-[13px]">
          <AlertCircle size={15} /> Delete my account
        </Btn>
      </div>

      <Btn variant="danger" onClick={out} className="mt-4 w-full py-3">
        <LogOut size={16} /> Log Out
      </Btn>
    </div>
  )
}
