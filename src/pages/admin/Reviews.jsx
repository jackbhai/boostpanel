import { useEffect, useMemo, useState } from 'react'
import { Badge, Btn, EmptyState, Input, PageHead, Textarea, toast } from '../../components/ui'
import { Check, Star, X } from '../../components/icons'
import { approveReview, deleteReviewAdmin, listReviewsAdmin, replyReview } from '../../lib/db'
import { timeAgo } from '../../lib/utils'

function Stars({ n, size = 13 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= n ? 'text-amber-300' : 'text-white/20'} />
      ))}
    </span>
  )
}

export default function AdminReviews() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [q, setQ] = useState('')
  const [replyId, setReplyId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [busy, setBusy] = useState(null)

  const load = async () => {
    setLoading(true)
    try { setList(await listReviewsAdmin()) } catch { toast('Failed to load reviews', 'error') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const rows = useMemo(() => list.filter((r) => {
    if (filter === 'pending' && r.approved) return false
    if (filter === 'approved' && !r.approved) return false
    if (filter === 'low' && Number(r.rating) > 2) return false
    const s = q.trim().toLowerCase()
    if (s && !((r.text || '').toLowerCase().includes(s) || (r.services?.name || '').toLowerCase().includes(s))) return false
    return true
  }), [list, filter, q])

  const stats = useMemo(() => ({
    pending: list.filter((r) => !r.approved).length,
    approved: list.filter((r) => r.approved).length,
    avg: list.length ? (list.reduce((s, r) => s + Number(r.rating), 0) / list.length).toFixed(1) : '—',
  }), [list])

  const act = async (id, fn, msg) => {
    setBusy(id)
    try { await fn(); toast(msg); load() } catch (err) { toast(err.message, 'error') }
    setBusy(null)
  }

  const sendReply = async (r) => {
    if (!replyText.trim()) return toast('Write a reply first', 'error')
    await act(r.id, () => replyReview(r.id, replyText.trim()), 'Reply posted')
    setReplyId(null); setReplyText('')
  }

  return (
    <div>
      <PageHead title="Reviews" sub="Users can review completed orders. Approved reviews show on Services." />
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center"><p className="text-xl font-extrabold text-amber-300">{stats.pending}</p><p className="text-[11px] text-white/45">Pending</p></div>
        <div className="card p-3 text-center"><p className="text-xl font-extrabold text-emerald-300">{stats.approved}</p><p className="text-[11px] text-white/45">Approved</p></div>
        <div className="card p-3 text-center"><p className="text-xl font-extrabold text-white">{stats.avg}</p><p className="text-[11px] text-white/45">Avg rating</p></div>
      </div>

      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {[['pending', `Pending (${stats.pending})`], ['approved', 'Approved'], ['low', 'Low ratings'], ['all', 'All']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${filter === id ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/55'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search review or service…" className="mb-2" />

      {loading ? <p className="py-6 text-center text-[13px] text-white/40">Loading…</p>
        : rows.length === 0 ? <EmptyState icon={<Star size={36} />} title="No reviews here" hint={filter === 'pending' ? 'New reviews will land here for approval.' : 'Nothing matches this filter.'} />
        : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="card p-3.5">
                <div className="flex items-center gap-2">
                  <Stars n={Number(r.rating)} />
                  <span className="flex-1 truncate text-[12.5px] font-semibold text-white">{r.services?.name || `Service #${r.service_id}`}</span>
                  <Badge status={r.approved ? 'completed' : 'pending'}>{r.approved ? 'live' : 'pending'}</Badge>
                </div>
                {r.text && <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">“{r.text}”</p>}
                <p className="mt-1 text-[11px] text-white/35">Order #{r.order_id} · {timeAgo(r.created_at)}</p>
                {r.admin_reply && (
                  <p className="mt-2 rounded-lg border border-violet-500/25 bg-violet-500/10 p-2 text-[12.5px] text-violet-100">
                    <b>Your reply:</b> {r.admin_reply}
                  </p>
                )}
                {replyId === r.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} placeholder="Write a public reply…" />
                    <div className="flex gap-2">
                      <Btn onClick={() => sendReply(r)} loading={busy === r.id} className="!px-3 !py-1.5 text-[12px]">Post reply</Btn>
                      <Btn variant="ghost" onClick={() => { setReplyId(null); setReplyText('') }} className="!px-3 !py-1.5 text-[12px]">Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {!r.approved
                      ? <Btn variant="success" onClick={() => act(r.id, () => approveReview(r.id, true), 'Review approved + live')} loading={busy === r.id} className="!px-3 !py-1.5 text-[12px]"><Check size={13} />Approve</Btn>
                      : <Btn variant="subtle" onClick={() => act(r.id, () => approveReview(r.id, false), 'Review hidden')} loading={busy === r.id} className="!px-3 !py-1.5 text-[12px]">Unpublish</Btn>}
                    <Btn variant="subtle" onClick={() => { setReplyId(r.id); setReplyText(r.admin_reply || '') }} className="!px-3 !py-1.5 text-[12px]">Reply</Btn>
                    <Btn variant="danger" onClick={() => { if (window.confirm('Delete this review?')) act(r.id, () => deleteReviewAdmin(r.id), 'Review deleted') }} loading={busy === r.id} className="ml-auto !px-3 !py-1.5 text-[12px]"><X size={13} />Delete</Btn>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
