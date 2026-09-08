import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Logo } from '../components/layout'
import { Btn, Field, Input, toast } from '../components/ui'
import { useStore } from '../lib/store'
import { claimReferral } from '../lib/db'
import { supabase } from '../lib/supabase'

function Shell({ title, sub, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-4 text-2xl font-extrabold text-white">{title}</h1>
          <p className="mt-1 text-sm text-white/50">{sub}</p>
        </div>
        <div className="card p-5">{children}</div>
        {footer && <div className="mt-4 text-center text-sm text-white/50">{footer}</div>}
      </div>
    </div>
  )
}

export function Login() {
  const { user, profile, login, authBusy, boot } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('password')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpBusy, setOtpBusy] = useState(false)
  const navigate = useNavigate()

  if (user) return <Navigate to={profile?.role === 'admin' ? '/admin' : '/'} replace />

  const sendOtp = async () => {
    if (!email.trim()) return toast('Enter your email first', 'error')
    setOtpBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
      if (error) throw error
      setOtpSent(true)
      toast('6-digit code sent to your email')
    } catch (err) { toast(err.message, 'error') }
    setOtpBusy(false)
  }

  const verifyOtp = async (e) => {
    e.preventDefault()
    if (otp.trim().length < 6) return toast('Enter the 6-digit code', 'error')
    setOtpBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: 'email' })
      if (error) throw error
      await boot()
      toast('Welcome back!')
      navigate('/', { replace: true })
    } catch (err) { toast(err.message, 'error') }
    setOtpBusy(false)
  }

  const forgot = async () => {
    if (!email.trim()) return toast('Enter your email first', 'error')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) throw error
      toast('Password reset link sent to your email')
    } catch (err) { toast(err.message, 'error') }
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      const p = await login(email, password)
      toast(`Welcome back!`)
      navigate(p?.role === 'admin' ? '/admin' : '/', { replace: true })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <Shell
      title="Welcome back"
      sub="Log in to your SMM panel account"
      footer={<>New here? <Link to="/signup" className="font-semibold text-violet-300">Create an account</Link></>}
    >
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
    </Shell>
  )
}

export function Signup() {
  const { user, profile, signup, authBusy } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  if (user) return <Navigate to={profile?.role === 'admin' ? '/admin' : '/'} replace />

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 6) return toast('Password must be at least 6 characters', 'error')
    try {
      const res = await signup(email, password)
      if (res?.needsVerification) {
        toast('Account created! Please verify your email, then log in.')
        navigate('/login', { replace: true })
        return
      }
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref) { try { await claimReferral(ref); toast(`Referral ${ref} applied — your friend earns a reward!`) } catch { /* invalid code, ignore */ } }
      toast(res?.role === 'admin' ? 'Welcome, Admin! First account = admin' : 'Account created! Welcome aboard')
      navigate(res?.role === 'admin' ? '/admin' : '/', { replace: true })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <Shell
      title="Create account"
      sub="Start ordering in under a minute"
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
        <Field label="Password" hint="Minimum 6 characters">
          <Input type="password" required placeholder="Choose a strong password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Btn type="submit" loading={authBusy} className="w-full py-3">Sign Up Free</Btn>
      </form>
    </Shell>
  )
}
