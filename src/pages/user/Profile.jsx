import { AlertCircle, Bell, Check, Copy, KeyRound, Lock, LogOut, RefreshCcw, Shield, Volume2, VolumeX, Wifi, X } from '../../components/icons'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Field, Input, PageHead, toast } from '../../components/ui'
import { changePassword, deleteAccountSelf, killSession, listSecEvents, logSecEvent, mfaEnroll, mfaFactors, mfaUnenroll, mfaVerifyEnroll, mySessions, rotateApiKey, setEmailSelf, touchSession } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { bus } from '../../lib/cache'
import { deviceName, lockPrefs, pwScore } from '../../lib/security'
import { setSoundOn, sfx, soundOn } from '../../lib/sound'
import { fullDate, money, timeAgo } from '../../lib/utils'

function PwMeter({ pw }) {
  if (!pw) return null
  const { level, label } = pwScore(pw)
  const colors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-300']
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i <= level ? colors[level] : 'bg-white/10'}`} />
        ))}
      </div>
      <p className="mt-1 text-[11px] font-bold text-white/45">
        Strength: <span className="text-white/75">{label}</span>
      </p>
    </div>
  )
}

function Toggle({ on, onFlip, label, hint }) {
  return (
    <button onClick={() => { onFlip(!on); sfx('toggle') }} className="flex w-full items-center gap-3 py-1 text-left">
      <span className="flex-1">
        <span className="block text-[13.5px] font-bold text-white">{label}</span>
        {hint && <span className="block text-[12px] text-white/45">{hint}</span>}
      </span>
      <span className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${on ? 'grad-btn justify-end' : 'justify-start bg-white/10'}`}>
        <span className="h-5 w-5 rounded-full bg-white shadow" />
      </span>
    </button>
  )
}

export default function Profile() {
  const { user, profile, currency, logout, refreshProfile } = useStore()
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [sessions, setSessions] = useState([])
  const [accent, setAccent] = useState(() => {
    try {
      return localStorage.getItem('bp_accent') || 'violet'
    } catch {
      return 'violet'
    }
  })
  const [busy2, setBusy2] = useState(null)
  /* security center */
  const [factors, setFactors] = useState([])
  const [mfaStep, setMfaStep] = useState('idle')
  const [mfaData, setMfaData] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [secLog, setSecLog] = useState([])
  const [sound, setSound] = useState(() => soundOn())
  const [lock, setLock] = useState(() => lockPrefs())
  const [rotBusy, setRotBusy] = useState(false)
  const navigate = useNavigate()

  const savePw = async (e) => {
    e.preventDefault()
    if (newPw !== confirmPw) return toast('Passwords do not match', 'error')
    if (newPw.length < 8) return toast('Password must be at least 8 characters', 'error')
    setBusy(true)
    try {
      await changePassword(newPw)
      setNewPw('')
      setConfirmPw('')
      logSecEvent(user.id, 'password_change', deviceName()).catch(() => {})
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
      const dev = deviceName()
      touchSession(user.id, dev).catch(() => {})
      mySessions(user.id).then(setSessions).catch(() => {})
      mfaFactors().then(setFactors).catch(() => {})
      listSecEvents(user.id).then(setSecLog).catch(() => {})
    }
    try {
      document.documentElement.dataset.accent = localStorage.getItem('bp_accent') || 'violet'
    } catch {
      /* ignore */
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const setAccentAll = async (a) => {
    setAccent(a)
    try {
      localStorage.setItem('bp_accent', a)
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.accent = a
    sfx('toggle')
    try {
      await supabase.from('profiles').update({ accent: a }).eq('id', user.id)
    } catch {
      /* local only */
    }
  }

  const changeEmail = async (e) => {
    e.preventDefault()
    if (!email.trim() || email.trim().toLowerCase() === profile?.email) return
    setEmailBusy(true)
    try {
      await setEmailSelf(email.trim())
      await refreshProfile()
      logSecEvent(user.id, 'email_change', deviceName()).catch(() => {})
      toast('Email updated! Use it on your next login.')
    } catch (err) {
      toast(err.message, 'error')
    }
    setEmailBusy(false)
  }

  const removeSession = async (id) => {
    try {
      await killSession(id)
      setSessions(sessions.filter((s) => s.id !== id))
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const nukeAccount = async () => {
    const c = window.prompt('Type DELETE to permanently delete your account, balance and history. This cannot be undone:')
    if (c !== 'DELETE') return
    setBusy2('del')
    try {
      await deleteAccountSelf()
      await logout()
      navigate('/signup', { replace: true })
    } catch (err) {
      toast(err.message, 'error')
    }
    setBusy2(null)
  }

  const out = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  /* ---- 2FA ---- */
  const startEnroll = async () => {
    setMfaBusy(true)
    try {
      const data = await mfaEnroll()
      setMfaData(data)
      setMfaStep('qr')
    } catch (err) {
      toast(err.message, 'error')
    }
    setMfaBusy(false)
  }

  const confirmEnroll = async (e) => {
    e.preventDefault()
    if (mfaCode.trim().length < 6) return toast('Enter the 6-digit code', 'error')
    setMfaBusy(true)
    try {
      await mfaVerifyEnroll(mfaData?.id, mfaCode)
      setFactors(await mfaFactors().catch(() => [{ id: 1 }]))
      setMfaStep('idle')
      setMfaData(null)
      setMfaCode('')
      logSecEvent(user.id, '2fa_enabled', deviceName()).catch(() => {})
      sfx('success')
      toast('Two-factor authentication enabled!')
    } catch (err) {
      toast(err.message, 'error')
    }
    setMfaBusy(false)
  }

  const disableMfa = async () => {
    const f = factors[0]
    if (!f) return
    if (!window.confirm('Turn off two-factor authentication? Your account will be less protected.')) return
    setMfaBusy(true)
    try {
      await mfaUnenroll(f.id)
      setFactors([])
      logSecEvent(user.id, '2fa_disabled', deviceName()).catch(() => {})
      toast('Two-factor authentication turned off', 'info')
    } catch (err) {
      toast(err.message, 'error')
    }
    setMfaBusy(false)
  }

  const rotateKey = async () => {
    if (!window.confirm('Generate a new API key? Your old key will stop working immediately.')) return
    setRotBusy(true)
    try {
      await rotateApiKey(user.id)
      await refreshProfile()
      logSecEvent(user.id, 'api_rotate', deviceName()).catch(() => {})
      toast('New API key generated!')
    } catch (err) {
      toast(err.message, 'error')
    }
    setRotBusy(false)
  }

  const flipSound = (on) => {
    setSound(on)
    setSoundOn(on)
  }

  const flipLock = (on) => {
    const next = { ...lock, on }
    setLock(next)
    try {
      localStorage.setItem('bp_lock', on ? '1' : '0')
    } catch {
      /* ignore */
    }
    bus.emit('prefs')
  }

  const setLockMins = (mins) => {
    const next = { ...lock, mins: Number(mins) }
    setLock(next)
    try {
      localStorage.setItem('bp_lock_mins', String(mins))
    } catch {
      /* ignore */
    }
    bus.emit('prefs')
  }

  const mfaOn = factors.length > 0

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

      {/* ── Security center ── */}
      <div className="card mt-3 border-emerald-500/25 p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-white"><Shield size={15} className="text-emerald-300" /> Security center</p>

        {/* 2FA */}
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-violet-300" />
            <p className="flex-1 text-[13.5px] font-bold text-white">Two-factor authentication</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${mfaOn ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
              {mfaOn ? 'On' : 'Off'}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">
            {mfaOn ? 'Login needs your password + authenticator code.' : 'Add an authenticator code on top of your password.'}
          </p>
          {mfaStep === 'qr' && mfaData ? (
            <form onSubmit={confirmEnroll} className="mt-2.5 space-y-2.5">
              <div className="flex justify-center rounded-xl bg-white p-3">
                {mfaData?.totp?.qr_code ? (
                  <img src={mfaData.totp.qr_code} alt="2FA QR code" className="h-44 w-44" />
                ) : (
                  <p className="break-all p-2 font-mono text-[11px] text-black">{mfaData?.totp?.uri || 'QR unavailable — enter the secret manually.'}</p>
                )}
              </div>
              <p className="text-center font-mono text-[12px] tracking-widest text-violet-200">{mfaData?.totp?.secret}</p>
              <Field label="Enter the 6-digit code to confirm">
                <Input inputMode="numeric" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))} placeholder="123456" className="text-center font-mono text-lg tracking-[0.3em]" />
              </Field>
              <div className="flex gap-2">
                <Btn type="button" variant="ghost" onClick={() => { setMfaStep('idle'); setMfaData(null); setMfaCode('') }} className="flex-1 !py-2 text-[13px]">Cancel</Btn>
                <Btn type="submit" loading={mfaBusy} className="flex-1 !py-2 text-[13px]">Enable 2FA</Btn>
              </div>
            </form>
          ) : mfaOn ? (
            <Btn variant="ghost" onClick={disableMfa} loading={mfaBusy} className="mt-2.5 w-full !py-2 text-[13px]">Turn off 2FA</Btn>
          ) : (
            <Btn onClick={startEnroll} loading={mfaBusy} className="mt-2.5 w-full !py-2 text-[13px]">Set up 2FA</Btn>
          )}
        </div>

        {/* toggles */}
        <div className="mt-2 divide-y divide-white/5">
          <Toggle on={sound} onFlip={flipSound} label="Sound effects" hint={sound ? 'UI blips are on' : 'Muted'} />
          <Toggle on={lock.on} onFlip={flipLock} label="Auto-lock on idle" hint="Log out automatically when inactive" />
        </div>
        {lock.on && (
          <div className="mt-1 flex items-center gap-2 pl-1">
            <Lock size={13} className="text-white/40" />
            <p className="flex-1 text-[12.5px] text-white/55">Lock after</p>
            <div className="flex gap-1.5">
              {[15, 30, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => setLockMins(m)}
                  className={`rounded-lg px-2.5 py-1 text-[12px] font-bold ${lock.mins === m ? 'grad-btn text-white' : 'bg-white/5 text-white/55'}`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        )}

        {/* security log */}
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/35">
            <Bell size={12} /> Recent security activity
          </p>
          {secLog.length === 0 ? (
            <p className="text-[12.5px] text-white/40">No events yet — logins appear here.</p>
          ) : (
            <div className="space-y-1.5">
              {secLog.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px]">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.kind === 'new_device' ? 'bg-amber-400' : s.kind === 'login' ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                  <span className="flex-1 truncate font-semibold capitalize text-white/75">
                    {s.kind.replace(/_/g, ' ')}
                    <span className="ml-1.5 font-normal text-white/40">{s.detail}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-white/30">{timeAgo(s.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/[0.03] p-2.5">
          {sound ? <Volume2 size={16} className="ml-1 shrink-0 text-white/50" /> : <VolumeX size={16} className="ml-1 shrink-0 text-white/50" />}
          <p className="flex-1 text-[13px] font-semibold text-white/70">Interface sounds</p>
          <button onClick={() => flipSound(!sound)} className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${sound ? 'grad-btn justify-end' : 'justify-start bg-white/10'}`}>
            <span className="h-5 w-5 rounded-full bg-white shadow" />
          </button>
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
            aria-label="Copy API key"
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/60 hover:bg-white/10"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={rotateKey}
            aria-label="Generate new API key"
            title="Generate new key"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300 hover:bg-amber-500/20"
          >
            <RefreshCcw size={16} className={rotBusy ? 'animate-spin' : ''} />
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
            <PwMeter pw={newPw} />
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
