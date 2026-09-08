import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Logo } from '../components/layout'
import { Btn, Field, Input, toast } from '../components/ui'
import { Shield } from '../components/icons'
import { useStore } from '../lib/store'
import { claimReferral } from '../lib/db'
import { supabase } from '../lib/supabase'
import { pwScore } from '../lib/security'
import { sfx } from '../lib/sound'

/* ------------------------- animated shell ------------------------- */

function Particles() {
  const dots = useMemo(
    () =>
      [...Array(16)].map((_, i) => ({
        left: (i * 61 + 7) % 100,
        size: 2 + ((i * 7) % 4),
        dur: 7 + ((i * 13) % 8),
        delay: -((i * 17) % 11),
      })),
    [],
  )
  return (
    <>
      {dots.map((d, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${d.left}%`,
            width: d.size,
            height: d.size,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
    </>
  )
}

function Shell({ title, sub, children, footer, shakeKey }) {
  const cardRef = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const el = cardRef.current
    if (!el) return
    el.classList.remove('shake')
    void el.offsetWidth
    el.classList.add('shake')
    const t = setTimeout(() => el.classList.remove('shake'), 450)
    return () => clearTimeout(t)
  }, [shakeKey])
  return (
    <div className="auth-stage flex min-h-screen items-center justify-center px-4 py-8">
      <div className="auth-orb a" />
      <div className="auth-orb b" />
      <Particles />
      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="mb-6 flex flex-col items-center text-center"
        >
          <span className="halo-logo flex">
            <Logo />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-white">{title}</h1>
          <p className="mt-1 text-sm text-white/50">{sub}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.12, ease: 'easeOut' }}
        >
          <div ref={cardRef} className="card p-5">
            {children}
          </div>
        </motion.div>
        {footer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 text-center text-sm text-white/50"
          >
            {footer}
          </motion.div>
        )}
      </div>
    </div>
  )
}

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
        Password strength: <span className="text-white/75">{label}</span>
      </p>
    </div>
  )
}

/* ------------------------------ login ------------------------------ */

export function Login() {
  const { user, profile, login, verifyMfa, authBusy, boot } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('password')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpBusy, setOtpBusy] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaStep, setMfaStep] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const navigate = useNavigate()

  if (user) return <Navigate to={profile?.role === 'admin' ? '/admin' : '/'} replace />

  const fail = (msg) => {
    setShakeKey((k) => k + 1)
    toast(msg, 'error')
  }

  const sendOtp = async () => {
    if (!email.trim()) return fail('Enter your email first')
    setOtpBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
      if (error) throw error
      setOtpSent(true)
      toast('6-digit code sent to your email')
    } catch (err) {
      fail(err.message)
    }
    setOtpBusy(false)
  }

  const verifyOtp = async (e) => {
    e.preventDefault()
    if (otp.trim().length < 6) return fail('Enter the 6-digit code')
    setOtpBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: 'email' })
      if (error) throw error
      await boot()
      sfx('success')
      toast('Welcome back!')
      navigate('/', { replace: true })
    } catch (err) {
      fail(err.message)
    }
    setOtpBusy(false)
  }

  const forgot = async () => {
    if (!email.trim()) return fail('Enter your email first')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) throw error
      toast('Password reset link sent to your email')
    } catch (err) {
      fail(err.message)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      const p = await login(email, password)
      if (p?.needsMfa) {
        setMfaStep(true)
        toast('Enter your 2FA code', 'info')
        return
      }
      sfx('success')
      toast('Welcome back!')
      navigate(p?.role === 'admin' ? '/admin' : '/', { replace: true })
    } catch (err) {
      fail(err.message)
    }
  }

  const submitMfa = async (e) => {
    e.preventDefault()
    if (mfaCode.trim().length < 6) return fail('Enter the 6-digit code from your authenticator app')
    try {
      const p = await verifyMfa(mfaCode)
      sfx('success')
      toast('Verified — welcome back!')
      navigate(p?.role === 'admin' ? '/admin' : '/', { replace: true })
    } catch (err) {
      fail(err.message)
    }
  }

  return (
    <Shell
      title={mfaStep ? 'Two-factor check' : 'Welcome back'}
      sub={mfaStep ? 'Extra shield is on for this account' : 'Log in to your BoostPanel account'}
      shakeKey={shakeKey}
      footer={
        mfaStep ? null : (
          <>New here? <Link to="/signup" className="font-semibold text-violet-300">Create an account</Link></>
        )
      }
    >
      {mfaStep ? (
        <form onSubmit={submitMfa} className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <Shield size={20} className="shrink-0 text-emerald-300" />
            <p className="text-[13px] leading-snug text-emerald-100/90">
              2FA is enabled. Open your authenticator app and enter the 6-digit code.
            </p>
          </div>
          <Field label="Authenticator code">
            <Input
              inputMode="numeric"
              required
              autoFocus
              placeholder="123456"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
              className="text-center font-mono text-lg tracking-[0.3em]"
            />
          </Field>
          <Btn type="submit" loading={authBusy} className="w-full py-3">Verify & Log In</Btn>
          <button type="button" onClick={() => { setMfaStep(false); setMfaCode('') }} className="w-full text-center text-[13px] font-semibold text-violet-300">
            Back to login
          </button>
        </form>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {[['password', 'Password'], ['otp', 'Email code']].map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)} className={`rounded-xl px-3 py-2 text-[13px] font-bold transition ${mode === id ? 'grad-btn text-white' : 'border border-white/10 bg-white/10 text-white/55'}`}>
                {label}
              </button>
            ))}
          </div>
          {mode === 'password' ? (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Email">
                <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password">
                <Input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Btn type="submit" loading={authBusy} className="w-full py-3">Log In</Btn>
              <button type="button" onClick={forgot} className="w-full text-center text-[13px] font-semibold text-violet-300">
                Forgot password? Send reset link
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <Field label="Email">
                <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              {!otpSent ? (
                <Btn type="button" onClick={sendOtp} loading={otpBusy} className="w-full py-3">Send 6-digit code</Btn>
              ) : (
                <>
                  <Field label="6-digit code (check inbox + spam)">
                    <Input inputMode="numeric" required placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))} className="text-center font-mono text-lg tracking-[0.3em]" />
                  </Field>
                  <Btn type="submit" loading={otpBusy} className="w-full py-3">Verify & Log In</Btn>
                  <button type="button" onClick={sendOtp} className="w-full text-center text-[13px] font-semibold text-violet-300">
                    Resend code
                  </button>
                </>
              )}
            </form>
          )}
        </>
      )}
    </Shell>
  )
}

/* ------------------------------ signup ------------------------------ */

export function Signup() {
  const { user, profile, signup, authBusy } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const navigate = useNavigate()

  if (user) return <Navigate to={profile?.role === 'admin' ? '/admin' : '/'} replace />

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 8) {
      setShakeKey((k) => k + 1)
      return toast('Password must be at least 8 characters', 'error')
    }
    try {
      const res = await signup(email, password)
      if (res?.needsVerification) {
        toast('Account created! Please verify your email, then log in.')
        navigate('/login', { replace: true })
        return
      }
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref) { try { await claimReferral(ref); toast(`Referral ${ref} applied — your friend earns a reward!`) } catch { /* invalid code, ignore */ } }
      sfx('success')
      toast(res?.role === 'admin' ? 'Welcome, Admin! First account = admin' : 'Account created! Welcome aboard')
      navigate(res?.role === 'admin' ? '/admin' : '/', { replace: true })
    } catch (err) {
      setShakeKey((k) => k + 1)
      toast(err.message, 'error')
    }
  }

  return (
    <Shell
      title="Create account"
      sub="Start ordering in under a minute"
      shakeKey={shakeKey}
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-violet-300">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {new URLSearchParams(window.location.search).get('ref') && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-[13px] font-bold text-emerald-200">
            Referral {new URLSearchParams(window.location.search).get('ref')} will be applied
          </div>
        )}
        <Field label="Password" hint="Minimum 8 characters — mix letters, numbers & symbols">
          <Input type="password" required placeholder="Choose a strong password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PwMeter pw={password} />
        </Field>
        <Btn type="submit" loading={authBusy} className="w-full py-3">Sign Up Free</Btn>
      </form>
    </Shell>
  )
}
