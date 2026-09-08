import { useEffect, useState } from 'react'
import { Badge, Btn, Field, Input, PageHead, Select, toast } from '../../components/ui'
import { Copy, Plug, Send } from '../../components/icons'
import { myApiLogs } from '../../lib/db'
import { timeAgo } from '../../lib/utils'
import { useStore } from '../../lib/store'
import { FN_URL } from '../../lib/supabase'

const ACTIONS = [
  { id: 'services', label: 'services — list catalog', fields: [] },
  { id: 'balance', label: 'balance — check funds', fields: [] },
  { id: 'add', label: 'add — place order', fields: ['service', 'link', 'quantity'] },
  { id: 'status', label: 'status — order status', fields: ['order'] },
  { id: 'refill', label: 'refill — refill order', fields: ['order'] },
  { id: 'cancel', label: 'cancel — cancel order', fields: ['order'] },
]

export default function Playground() {
  const { user, profile } = useStore()
  const [action, setAction] = useState('services')
  const [params, setParams] = useState({ service: '', link: '', quantity: '', order: '' })
  const [resp, setResp] = useState(null)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState([])

  const fields = ACTIONS.find((a) => a.id === action)?.fields || []

  useEffect(() => {
    if (user) myApiLogs(user.id, 20).then(setHistory).catch(() => {})
  }, [user, resp])

  const run = async () => {
    if (!profile?.api_key) return toast('No API key found', 'error')
    for (const f of fields) {
      if (!String(params[f]).trim()) return toast(`"${f}" is required`, 'error')
    }
    setBusy(true)
    setResp(null)
    const payload = { key: profile.api_key, action }
    for (const f of fields) payload[f] = f === 'quantity' || f === 'service' || f === 'order' ? Number(params[f]) : params[f]
    const t0 = Date.now()
    try {
      const r = await fetch(`${FN_URL}/public-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json().catch(() => ({}))
      setResp({ ok: r.ok && !data.error, status: r.status, ms: Date.now() - t0, body: data })
    } catch (err) {
      setResp({ ok: false, status: 0, ms: Date.now() - t0, body: { error: err.message || 'Network error' } })
    }
    setBusy(false)
  }

  const curl = `curl -X POST ${FN_URL}/public-api \\
  -H "Content-Type: application/json" \\
  -d '{"key":"YOUR_KEY","action":"${action}"${fields.map((f) => `,"${f}":"…"stu`.replace('stu', '')).join('')}}'`

  return (
    <div>
      <PageHead title="API Playground" sub="Test the reseller API live with your own key." />
      <div className="card mb-3 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-white"><Plug size={15} className="text-sky-300" /> Request builder</p>
        <div className="grid gap-2">
          <Field label="Action">
            <Select value={action} onChange={(e) => setAction(e.target.value)}>
              {ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </Select>
          </Field>
          {fields.map((f) => (
            <Field key={f} label={f}>
              <Input
                value={params[f]}
                onChange={(e) => setParams({ ...params, [f]: e.target.value })}
                placeholder={f === 'link' ? 'https://…' : f === 'quantity' ? '1000' : f === 'service' ? 'Service ID (see API Docs)' : 'Order #'}
                type={f === 'link' ? 'text' : f === 'quantity' || f === 'service' || f === 'order' ? 'number' : 'text'}
              />
            </Field>
          ))}
        </div>
        <Btn onClick={run} loading={busy} className="mt-3 w-full py-3"><Send size={15} />Send live request</Btn>
      </div>

      {resp && (
        <div className={`card mb-3 p-4 ${resp.ok ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
          <div className="mb-2 flex items-center gap-2">
            <Badge status={resp.ok ? 'completed' : 'closed'}>{resp.ok ? 'success' : 'error'}</Badge>
            <span className="text-[12px] text-white/45">HTTP {resp.status} · {resp.ms} ms</span>
            <button
              onClick={() => { navigator.clipboard.writeText(JSON.stringify(resp.body, null, 2)); toast('Response copied!') }}
              className="ml-auto flex items-center gap-1 text-[12px] font-bold text-white/50 hover:text-white"
            >
              <Copy size={13} />Copy
            </button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-xl bg-black/50 p-3 font-mono text-[12px] leading-relaxed text-emerald-100">
            {JSON.stringify(resp.body, null, 2)}
          </pre>
        </div>
      )}

      <div className="card mb-3 p-4">
        <p className="mb-1 text-[13px] font-bold text-white">Equivalent curl</p>
        <pre className="overflow-auto rounded-xl bg-black/50 p-3 font-mono text-[11.5px] leading-relaxed text-white/60">{curl}</pre>
      </div>

      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-white/45">Your recent API calls</p>
      {history.length === 0 ? <p className="card p-4 text-center text-[12.5px] text-white/40">No calls yet — run one above.</p> : (
        <div className="space-y-1.5">
          {history.map((h, i) => (
            <div key={i} className="card flex items-center gap-2 p-2.5">
              <span className={`h-2 w-2 rounded-full ${h.ok !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="flex-1 font-mono text-[12px] font-bold text-violet-200">{h.action}</span>
              <span className="text-[11px] text-white/35">{timeAgo(h.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
