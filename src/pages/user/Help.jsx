import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHead, SearchInput } from '../../components/ui'
import { ChevronRight, LifeBuoy, Ticket } from '../../components/icons'
import { listFaqsPublic } from '../../lib/db'
import { useStore } from '../../lib/store'

export default function Help() {
  const { settings } = useStore()
  const [faqs, setFaqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    listFaqsPublic().then((r) => { setFaqs(r || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const cats = useMemo(() => ['all', ...new Set(faqs.map((f) => f.category || 'General'))], [faqs])
  const rows = useMemo(() => faqs.filter((f) => {
    if (cat !== 'all' && (f.category || 'General') !== cat) return false
    const s = q.trim().toLowerCase()
    if (s && !((f.question || '').toLowerCase().includes(s) || (f.answer || '').toLowerCase().includes(s))) return false
    return true
  }), [faqs, cat, q])

  return (
    <div>
      <PageHead title="Help Center" sub="Answers first — tickets when you need a human." />
      <SearchInput value={q} onChange={setQ} placeholder="Search help articles…" />
      <div className="mb-3 mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${cat === c ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/55'}`}
          >
            {c === 'all' ? 'All topics' : c}
          </button>
        ))}
      </div>

      {loading ? <p className="py-6 text-center text-[13px] text-white/40">Loading…</p>
        : rows.length === 0 ? <EmptyState icon={<LifeBuoy size={36} />} title="No answers found" hint="Try different words, or open a ticket below." />
        : (
          <div className="card divide-y divide-white/5 overflow-hidden !p-0">
            {rows.map((f) => (
              <div key={f.id}>
                <button onClick={() => setOpen(open === f.id ? null : f.id)} className="flex w-full items-center gap-2 p-4 text-left transition hover:bg-white/[0.03]">
                  <span className="flex-1 text-[14px] font-semibold text-white">{f.question}</span>
                  <ChevronRight size={17} className={`shrink-0 text-white/30 transition-transform ${open === f.id ? 'rotate-90' : ''}`} />
                </button>
                {open === f.id && (
                  <p className="whitespace-pre-wrap px-4 pb-4 text-[13.5px] leading-relaxed text-white/60">{f.answer}</p>
                )}
              </div>
            ))}
          </div>
        )}

      <div className="card mt-3 p-4">
        <p className="text-[14px] font-bold text-white">Still stuck?</p>
        <p className="mt-0.5 text-[12.5px] text-white/50">
          Our team replies{settings?.ticket_sla_hours ? ` within ~${settings.ticket_sla_hours}h` : ''}.
          {settings?.support_email ? ` You can also mail ${settings.support_email}.` : ''}
        </p>
        <Link to="/tickets" className="grad-btn mt-3 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-bold text-white">
          <Ticket size={16} /> Open a support ticket
        </Link>
      </div>
    </div>
  )
}
