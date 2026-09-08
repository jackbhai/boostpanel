import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Btn, PageHead, toast } from '../../components/ui'
import { AlertCircle, Copy, RefreshCw, Sparkles, Zap } from '../../components/icons'
import { myApiLogs, regenerateApiKey } from '../../lib/db'
import { useStore } from '../../lib/store'

function Code({ children }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3.5 font-mono text-[12px] leading-relaxed text-emerald-200">
      {children}
    </pre>
  )
}

export default function ApiDocs() {
  const { user, profile, refreshProfile } = useStore()
  const [busy, setBusy] = useState(false)
  const [calls, setCalls] = useState([])

  const copy = () => {
    navigator.clipboard.writeText(profile?.api_key || '').then(
      () => toast('API key copied!'),
      () => toast('Copy failed', 'error'),
    )
  }

  const regen = async () => {
    if (!window.confirm('Generate a new API key? Your old key will stop working.')) return
    setBusy(true)
    try {
      await regenerateApiKey(user.id)
      await refreshProfile()
      toast('New API key generated!')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (user) myApiLogs(user.id, 200).then(setCalls).catch(() => {})
  }, [user])

  return (
    <div>
      <PageHead title="API Docs" sub="Automate orders from your own app." />

      <div className="card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-white/45">Your API key</p>
        <p className="mt-1.5 break-all rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[13px] text-violet-200">
          {profile?.api_key || '—'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn variant="ghost" onClick={copy} className="!py-2 text-[13px]"><Copy size={14} /> Copy</Btn>
          <Btn variant="ghost" onClick={regen} loading={busy} className="!py-2 text-[13px]"><RefreshCw size={14} /> Regenerate</Btn>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-white/35">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> Never share your key publicly. It can spend your balance.
        </p>
      </div>

      <Link to="/playground" className="card mt-3 flex items-center gap-3 border-violet-500/30 bg-violet-500/10 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200"><Zap size={20} /></span>
        <span className="flex-1">
          <span className="block text-[14px] font-bold text-white">Try the API Playground</span>
          <span className="block text-[12px] text-white/45">Send live requests with your key</span>
        </span>
      </Link>

      <div className="card mt-3 p-4">
        <p className="text-[13px] font-bold text-white">Your usage</p>
        <p className="mt-0.5 text-[12.5px] text-white/50">
          {calls.length ? `${calls.length} call(s) logged · ${calls.filter((c) => c.ok !== false).length} succeeded · ${calls.filter((c) => c.ok === false).length} failed` : 'No API calls yet.'}
        </p>
      </div>

      <div className="card mt-3 border-emerald-500/25 bg-emerald-500/5 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-200">Base URL — live, key auth, no login needed</p>
        <p className="mt-1.5 break-all rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[12px] text-sky-200">{FN_URL}/public-api</p>
        <p className="mt-2 text-[11px] leading-relaxed text-white/50">POST your <span className="font-mono text-white/70">key</span> + <span className="font-mono text-white/70">action</span> as form fields or JSON. Actions: services, add, status, balance, refill, cancel.</p>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-1.5 text-sm font-bold text-white">1 · Service list</p>
          <Code>{`POST /api/v2
{ "key": "YOUR_KEY", "action": "services" }

→ [ { "id": 104, "name": "…", "rate": 9,
      "min": 100, "max": 10000000 } ]`}</Code>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-bold text-white">2 · Place an order</p>
          <Code>{`POST /api/v2
{ "key": "YOUR_KEY", "action": "add",
  "service": 104,
  "link": "https://instagram.com/reel/abc",
  "quantity": 5000 }

→ { "order": 1042 }`}</Code>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-bold text-white">3 · Order status</p>
          <Code>{`POST /api/v2
{ "key": "YOUR_KEY", "action": "status",
  "order": 1042 }

→ { "status": "In progress",
    "remains": 640, "charge": "45.00" }`}</Code>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-bold text-white">4 · Balance</p>
          <Code>{`POST /api/v2
{ "key": "YOUR_KEY", "action": "balance" }

→ { "balance": "1250.00", "currency": "INR" }`}</Code>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-bold text-white">5 · Refill / Cancel</p>
          <Code>{`{ "key": "…", "action": "refill", "order": 1042 }
{ "key": "…", "action": "cancel", "order": 1042 }`}</Code>
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] leading-relaxed text-white/45">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-violet-300" />
        <span><b className="text-white/70">Reseller tip:</b> connect this API to your own website and sell
        services at your own price — the classic SMM reseller model.</span>
      </p>
    </div>
  )
}
