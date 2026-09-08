import { Copy, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Btn, PageHead, toast } from '../../components/ui'
import { regenerateApiKey } from '../../lib/db'
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
        <p className="mt-2 text-[11px] text-white/35">⚠️ Never share your key publicly. It can spend your balance.</p>
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

      <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] leading-relaxed text-white/45">
        💡 <b className="text-white/70">Reseller tip:</b> connect this API to your own website and sell
        services at your own price — the classic SMM reseller model.
      </p>
    </div>
  )
}
