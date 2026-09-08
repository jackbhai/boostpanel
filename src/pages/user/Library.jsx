import { useEffect, useMemo, useState } from 'react'
import { Badge, Btn, EmptyState, PageHead, SearchInput } from '../../components/ui'
import { ArrowLeft, Calendar, ClipboardList, TrendingUp } from '../../components/icons'
import { listEventsPublic, listLibraryPublic } from '../../lib/db'
import { fullDate } from '../../lib/utils'

export default function Library() {
  const [articles, setArticles] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const [a, e] = await Promise.all([listLibraryPublic().catch(() => []), listEventsPublic().catch(() => [])])
        setArticles(a || []); setEvents(e || [])
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  const cats = useMemo(() => ['all', ...new Set(articles.map((a) => a.category || 'Guide'))], [articles])
  const rows = useMemo(() => articles.filter((a) => {
    if (cat !== 'all' && (a.category || 'Guide') !== cat) return false
    const s = q.trim().toLowerCase()
    if (s && !((a.title || '').toLowerCase().includes(s) || (a.body || '').toLowerCase().includes(s))) return false
    return true
  }), [articles, cat, q])

  const liveEvents = useMemo(() => {
    const now = Date.now()
    return events.filter((e) => {
      const s = e.starts_at ? new Date(e.starts_at).getTime() : 0
      const en = e.ends_at ? new Date(e.ends_at).getTime() : Infinity
      return now >= s && now <= en
    })
  }, [events])
  const upcoming = useMemo(() => {
    const now = Date.now()
    return events.filter((e) => e.starts_at && new Date(e.starts_at).getTime() > now).slice(0, 5)
  }, [events])

  if (open) {
    return (
      <div>
        <Btn variant="ghost" onClick={() => setOpen(null)} className="mb-3 !px-3 !py-1.5 text-[13px]"><ArrowLeft size={15} />All articles</Btn>
        <div className="card p-5">
          <Badge status="completed">{open.category}</Badge>
          <h1 className="mt-2 text-xl font-extrabold text-white">{open.title}</h1>
          <div className="mt-3 space-y-3">
            {(open.body || '').split(/\n\n+/).map((p, i) => (
              <p key={i} className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/70">{p}</p>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHead title="Library" sub="Guides, promos & events." />

      {liveEvents.length > 0 && (
        <div className="mb-3 space-y-2">
          {liveEvents.map((e) => (
            <div key={e.id} className="card border-amber-500/30 bg-gradient-to-r from-amber-500/12 to-orange-500/8 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                <TrendingUp size={13} /> Live now{e.ends_at ? ` · ends ${fullDate(e.ends_at)}` : ''}
              </p>
              <p className="mt-1 text-[15px] font-extrabold text-white">{e.title}</p>
              {e.body && <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-white/60">{e.body}</p>}
            </div>
          ))}
        </div>
      )}

      <SearchInput value={q} onChange={setQ} placeholder="Search guides…" />
      <div className="mb-3 mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${cat === c ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/55'}`}
          >
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      {loading ? <p className="py-6 text-center text-[13px] text-white/40">Loading…</p>
        : rows.length === 0 ? <EmptyState icon={<ClipboardList size={36} />} title="No articles" hint={q ? 'Nothing matches your search.' : 'Guides will appear here.'} />
        : (
          <div className="space-y-2">
            {rows.map((a) => (
              <button key={a.id} onClick={() => setOpen(a)} className="card block w-full p-4 text-left transition hover:border-violet-500/40">
                <Badge status="completed">{a.category}</Badge>
                <p className="mt-1.5 text-[15px] font-bold text-white">{a.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-white/50">{(a.body || '').slice(0, 140)}…</p>
              </button>
            ))}
          </div>
        )}

      {upcoming.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/45"><Calendar size={13} /> Upcoming</p>
          <div className="space-y-1.5">
            {upcoming.map((e) => (
              <div key={e.id} className="card p-3">
                <p className="text-[14px] font-bold text-white">{e.title}</p>
                <p className="text-[12px] text-white/45">Starts {fullDate(e.starts_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
