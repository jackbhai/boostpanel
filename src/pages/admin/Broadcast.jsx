import { useEffect, useMemo, useState } from 'react'
import { Btn, EmptyState, Field, Input, PageHead, Select, Textarea, toast } from '../../components/ui'
import { Bell, Megaphone, Users } from '../../components/icons'
import { broadcastHistory, broadcastSend, listUsers } from '../../lib/db'
import { fullDate } from '../../lib/utils'

const SEGMENTS = [
  { id: 'all', label: 'All active users' },
  { id: 'new', label: 'New users (joined in last 7 days)' },
  { id: 'vip', label: 'VIP tagged users' },
]

export default function AdminBroadcast() {
  const [users, setUsers] = useState([])
  const [history, setHistory] = useState([])
  const [segment, setSegment] = useState('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [u, h] = await Promise.all([listUsers().catch(() => []), broadcastHistory().catch(() => [])])
      setUsers(u || []); setHistory(h || [])
    } catch { /* ignore */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const audience = useMemo(() => {
    const active = users.filter((u) => u.status === 'active')
    if (segment === 'new') {
      const week = Date.now() - 7 * 86400000
      return active.filter((u) => new Date(u.created_at).getTime() > week)
    }
    if (segment === 'vip') return active.filter((u) => (u.tags || '').toLowerCase().includes('vip'))
    return active
  }, [users, segment])

  const batches = useMemo(() => {
    const m = new Map()
    for (const h of history) {
      if (!m.has(h.batch)) m.set(h.batch, { batch: h.batch, title: h.title, body: h.body, created_at: h.created_at, count: 0 })
      m.get(h.batch).count++
    }
    return [...m.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30)
  }, [history])

  const send = async () => {
    if (!title.trim() || !body.trim()) return toast('Title + message required', 'error')
    if (!window.confirm(`Send to ${audience.length} user(s)? This cannot be undone.`)) return
    setBusy(true)
    try {
      const r = await broadcastSend(title.trim(), body.trim(), segment)
      toast(`Sent to ${r.sent} user(s)`)
      setTitle(''); setBody(''); load()
    } catch (err) { toast(err.message || 'Send failed', 'error') }
    setBusy(false)
  }

  return (
    <div>
      <PageHead title="Broadcast" sub="Push notification messages to user segments. Delivered instantly." />

      <div className="card mb-3 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-white">
          <Megaphone size={15} className="text-amber-300" /> Compose
        </p>
        <div className="grid gap-2">
          <Field label={`Audience — ${audience.length} user(s) will receive this`}>
            <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
              {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekend offer: flat 15% off" maxLength={120} />
          </Field>
          <Field label={`Message — ${body.length}/1000`}>
            <Textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 1000))} rows={4} placeholder="Write the notification users will see…" />
          </Field>
        </div>
        {(title || body) && (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/35"><Bell size={11} /> Preview</p>
            <p className="text-[14px] font-bold text-white">{title || 'Title'}</p>
            <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-white/60">{body || 'Message…'}</p>
          </div>
        )}
        <Btn onClick={send} loading={busy} className="mt-3 w-full py-3">
          <Users size={16} /> Send to {audience.length} user(s)
        </Btn>
      </div>

      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/45">History</p>
      {loading ? <p className="py-4 text-center text-[13px] text-white/40">Loading…</p>
        : batches.length === 0 ? <EmptyState icon={<Megaphone size={36} />} title="No broadcasts yet" hint="Your sent messages will appear here." />
        : (
          <div className="space-y-2">
            {batches.map((b) => (
              <div key={b.batch} className="card p-3.5">
                <div className="flex items-center gap-2">
                  <p className="flex-1 truncate text-[14px] font-bold text-white">{b.title}</p>
                  <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-bold text-violet-200">{b.count} sent</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] text-white/50">{b.body}</p>
                <p className="mt-1.5 text-[11px] text-white/30">{fullDate(b.created_at)}</p>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
