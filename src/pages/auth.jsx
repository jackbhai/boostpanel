import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Logo } from '../components/layout'
import { Btn, Field, Input, toast } from '../components/ui'
import { useStore } from '../lib/store'

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
  const { user, profile, login, authBusy } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  if (user) return <Navigate to={profile?.role === 'admin' ? '/admin' : '/'} replace />

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
      title="Welcome back 👋"
      sub="Log in to your SMM panel account"
      footer={<>New here? <Link to="/signup" className="font-semibold text-violet-300">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Btn type="submit" loading={authBusy} className="w-full py-3">Log In</Btn>
      </form>
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
      toast(res?.role === 'admin' ? 'Welcome, Admin! First account = admin 🛠️' : 'Account created! Welcome aboard 🎉')
      navigate(res?.role === 'admin' ? '/admin' : '/', { replace: true })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <Shell
      title="Create account ✨"
      sub="Start ordering in under a minute"
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-violet-300">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" hint="Minimum 6 characters">
          <Input type="password" required placeholder="Choose a strong password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Btn type="submit" loading={authBusy} className="w-full py-3">Sign Up Free</Btn>
      </form>
    </Shell>
  )
}
