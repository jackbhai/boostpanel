import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, EmptyState, PageHead, SearchInput, Skeleton, toast } from '../../components/ui'
import { Ticket, User, Clock, Star } from '../../components/icons'
import { getAllTickets, listUsers } from '../../lib/db'
import { useStore } from '../../lib/store'
import { shortId, timeAgo } from '../../lib/utils'

export default function AdminTickets() {
  const [tickets, setTickets] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const { settings } = useStore()

  useEffect(() => {
    Promise.all([getAllTickets(), listUsers().catch(() => [])])
      .then(([t, u]) => { setTickets(t); setUsers(u) })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const emailOf = (id) => users.find((u) => u.id === id)?.email || String(id).slice(0, 8)

  const list = useMemo(() => tickets.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false
    if (q && !`${t.id} ${t.subject} ${emailOf(t.user_id)}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [tickets, filter, q, users])

  return (
    <div>
      <PageHead title="Tickets" sub={`${tickets.filter((t) => t.status === 'open').length} open`} />
      <SearchInput value={q} onChange={setQ} placeholder="Search tickets…" />
      <div className="mt-3 flex gap-2">
        {['all', 'open', 'answered', 'closed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold capitalize ${filter === f ? 'grad-btn text-white' : 'card text-white/55'}`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-2.5">
        {loading && <Skeleton lines={3} />}
        {!loading && list.length === 0 && <EmptyState icon={<Ticket size={40} />} title="No tickets" />}
        {list.map((t) => (
          <Link key={t.id} to={`/admin/tickets/${t.id}`} className="card card-hover block p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[12px] text-violet-300">{shortId(t.id)}</p>
              <div className="flex gap-1.5">
                <Badge status={t.priority === 'high' ? 'pending' : 'closed'}>{t.priority}</Badge>
                <Badge status={t.status} />
              </div>
            </div>
            <p className="mt-1 text-sm font-semibold text-white">{t.subject}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {t.satisfaction > 0 && <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-300"><Star size={11} fill="currentColor" /> {t.satisfaction}/5</span>}
              {t.status !== 'closed' && Number(settings?.ticket_sla_hours) > 0 && (Date.now() - new Date(t.created_at).getTime()) > Number(settings.ticket_sla_hours) * 3600000 && (
                <span className="flex items-center gap-0.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300"><Clock size={10} /> SLA breach</span>
              )}
              {t.assigned_to && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">asg: {String(t.assigned_to).slice(0, 6)}</span>}
            </div>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-white/35">
              <User size={11} /> {emailOf(t.user_id)} · {t.order_id ? `Order #${t.order_id} · ` : ''}Updated {timeAgo(t.updated_at)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
