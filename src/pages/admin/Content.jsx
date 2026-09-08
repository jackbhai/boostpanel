import { useEffect, useState } from 'react'
import { Badge, Btn, Field, Input, PageHead, Select, Textarea, toast } from '../../components/ui'
import { ClipboardList, LifeBuoy, Ticket, TrendingUp, X } from '../../components/icons'
import {
  deleteEvent, deleteFaq, deleteLibrary, deleteMacro,
  listEventsAdmin, listFaqs, listLibraryAdmin, listMacros,
  saveEvent, saveFaq, saveLibrary, saveMacro,
} from '../../lib/db'
import { timeAgo } from '../../lib/utils'

const TABS = [
  { id: 'faqs', label: 'FAQs', icon: LifeBuoy },
  { id: 'library', label: 'Library', icon: ClipboardList },
  { id: 'macros', label: 'Ticket macros', icon: Ticket },
  { id: 'events', label: 'Events', icon: TrendingUp },
]

function useCrud(listFn) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try { setItems(await listFn()) } catch { toast('Load failed', 'error') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  return { items, loading, load }
}

const Row = ({ title, sub, published, onEdit, onDelete, onToggle }) => (
  <div className="card p-3.5">
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-white">{title}</p>
        {sub && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-white/50">{sub}</p>}
      </div>
      {published !== undefined && (
        <Badge status={published ? 'completed' : 'closed'}>{published ? 'live' : 'draft'}</Badge>
      )}
    </div>
    <div className="mt-2.5 flex flex-wrap gap-2">
      <Btn variant="subtle" onClick={onEdit} className="!px-3 !py-1.5 text-[12px]">Edit</Btn>
      {onToggle && (
        <Btn variant="subtle" onClick={onToggle} className="!px-3 !py-1.5 text-[12px]">
          {published ? 'Unpublish' : 'Publish'}
        </Btn>
      )}
      <Btn variant="danger" onClick={onDelete} className="ml-auto !px-3 !py-1.5 text-[12px]"><X size={13} />Delete</Btn>
    </div>
  </div>
)

export default function AdminContent() {
  const [tab, setTab] = useState('faqs')
  const faqs = useCrud(listFaqs)
  const library = useCrud(listLibraryAdmin)
  const macros = useCrud(listMacros)
  const events = useCrud(listEventsAdmin)

  const [f, setF] = useState({ question: '', answer: '', category: 'General', sort: 0, published: true })
  const [fEdit, setFEdit] = useState(null)
  const [l, setL] = useState({ title: '', body: '', category: 'Guide', sort: 0, published: true })
  const [lEdit, setLEdit] = useState(null)
  const [m, setM] = useState({ title: '', body: '' })
  const [mEdit, setMEdit] = useState(null)
  const [e, setE] = useState({ title: '', body: '', starts_at: '', ends_at: '', published: true })
  const [eEdit, setEEdit] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = async (e2, payload, fn, reset, reload) => {
    e2?.preventDefault()
    setBusy(true)
    try { await fn(payload); toast('Saved'); reset(); reload() } catch (err) { toast(err.message, 'error') }
    setBusy(false)
  }
  const del = async (fn, reload, what) => {
    if (!window.confirm(`Delete this ${what}?`)) return
    try { await fn(); toast('Deleted'); reload() } catch (err) { toast(err.message, 'error') }
  }
  const dt = (v) => (v ? new Date(v).toISOString() : null)
  const dtLocal = (v) => (v ? v.slice(0, 16) : '')

  return (
    <div>
      <PageHead title="Content" sub="FAQs + guides users read, macros for tickets, promo events." />
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11.5px] font-bold transition ${tab === t.id ? 'border-violet-500/60 bg-violet-500/15 text-white' : 'border-white/10 bg-white/[0.03] text-white/50'}`}
          >
            <t.icon size={18} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'faqs' && (
        <div>
          <form onSubmit={(ev) => save(ev, { ...(fEdit ? { id: fEdit } : {}), ...f, sort: Number(f.sort) || 0 }, saveFaq, () => { setF({ question: '', answer: '', category: 'General', sort: 0, published: true }); setFEdit(null) }, faqs.load)} className="card mb-3 space-y-2 p-4">
            <p className="text-[13px] font-bold text-white">{fEdit ? 'Edit FAQ' : 'New FAQ'}</p>
            <Field label="Question"><Input value={f.question} onChange={(e2) => setF({ ...f, question: e2.target.value })} required /></Field>
            <Field label="Answer"><Textarea value={f.answer} onChange={(e2) => setF({ ...f, answer: e2.target.value })} rows={3} required /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Category"><Input value={f.category} onChange={(e2) => setF({ ...f, category: e2.target.value })} /></Field>
              <Field label="Sort"><Input type="number" value={f.sort} onChange={(e2) => setF({ ...f, sort: e2.target.value })} /></Field>
              <Field label="Status"><Select value={f.published ? 'on' : 'off'} onChange={(e2) => setF({ ...f, published: e2.target.value === 'on' })}><option value="on">Live</option><option value="off">Draft</option></Select></Field>
            </div>
            <div className="flex gap-2">
              <Btn type="submit" loading={busy} className="flex-1">{fEdit ? 'Save' : 'Add FAQ'}</Btn>
              {fEdit && <Btn variant="ghost" onClick={() => { setFEdit(null); setF({ question: '', answer: '', category: 'General', sort: 0, published: true }) }}>Cancel</Btn>}
            </div>
          </form>
          <div className="space-y-2">
            {faqs.items.map((x) => (
              <Row key={x.id} title={x.question} sub={`${x.category} · sort ${x.sort}`} published={x.published}
                onEdit={() => { setFEdit(x.id); setF({ question: x.question, answer: x.answer, category: x.category, sort: x.sort, published: x.published }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                onToggle={() => save(null, { id: x.id, question: x.question, answer: x.answer, category: x.category, sort: x.sort, published: !x.published }, saveFaq, () => {}, faqs.load)}
                onDelete={() => del(() => deleteFaq(x.id), faqs.load, 'FAQ')} />
            ))}
          </div>
        </div>
      )}

      {tab === 'library' && (
        <div>
          <form onSubmit={(ev) => save(ev, { ...(lEdit ? { id: lEdit } : {}), ...l, sort: Number(l.sort) || 0 }, saveLibrary, () => { setL({ title: '', body: '', category: 'Guide', sort: 0, published: true }); setLEdit(null) }, library.load)} className="card mb-3 space-y-2 p-4">
            <p className="text-[13px] font-bold text-white">{lEdit ? 'Edit article' : 'New article'}</p>
            <Field label="Title"><Input value={l.title} onChange={(e2) => setL({ ...l, title: e2.target.value })} required /></Field>
            <Field label="Body (plain text, paragraphs supported)"><Textarea value={l.body} onChange={(e2) => setL({ ...l, body: e2.target.value })} rows={5} required /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Category"><Input value={l.category} onChange={(e2) => setL({ ...l, category: e2.target.value })} /></Field>
              <Field label="Sort"><Input type="number" value={l.sort} onChange={(e2) => setL({ ...l, sort: e2.target.value })} /></Field>
              <Field label="Status"><Select value={l.published ? 'on' : 'off'} onChange={(e2) => setL({ ...l, published: e2.target.value === 'on' })}><option value="on">Live</option><option value="off">Draft</option></Select></Field>
            </div>
            <div className="flex gap-2">
              <Btn type="submit" loading={busy} className="flex-1">{lEdit ? 'Save' : 'Add article'}</Btn>
              {lEdit && <Btn variant="ghost" onClick={() => { setLEdit(null); setL({ title: '', body: '', category: 'Guide', sort: 0, published: true }) }}>Cancel</Btn>}
            </div>
          </form>
          <div className="space-y-2">
            {library.items.map((x) => (
              <Row key={x.id} title={x.title} sub={`${x.category} · sort ${x.sort}`} published={x.published}
                onEdit={() => { setLEdit(x.id); setL({ title: x.title, body: x.body, category: x.category, sort: x.sort, published: x.published }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                onToggle={() => save(null, { id: x.id, title: x.title, body: x.body, category: x.category, sort: x.sort, published: !x.published }, saveLibrary, () => {}, library.load)}
                onDelete={() => del(() => deleteLibrary(x.id), library.load, 'article')} />
            ))}
          </div>
        </div>
      )}

      {tab === 'macros' && (
        <div>
          <form onSubmit={(ev) => save(ev, { ...(mEdit ? { id: mEdit } : {}), ...m }, saveMacro, () => { setM({ title: '', body: '' }); setMEdit(null) }, macros.load)} className="card mb-3 space-y-2 p-4">
            <p className="text-[13px] font-bold text-white">{mEdit ? 'Edit macro' : 'New macro'}</p>
            <p className="-mt-1 text-[12px] text-white/40">Macros appear as one-tap replies inside ticket chats.</p>
            <Field label="Title"><Input value={m.title} onChange={(e2) => setM({ ...m, title: e2.target.value })} placeholder="e.g. Refill requested" required /></Field>
            <Field label="Message"><Textarea value={m.body} onChange={(e2) => setM({ ...m, body: e2.target.value })} rows={3} required /></Field>
            <div className="flex gap-2">
              <Btn type="submit" loading={busy} className="flex-1">{mEdit ? 'Save' : 'Add macro'}</Btn>
              {mEdit && <Btn variant="ghost" onClick={() => { setMEdit(null); setM({ title: '', body: '' }) }}>Cancel</Btn>}
            </div>
          </form>
          <div className="space-y-2">
            {macros.items.map((x) => (
              <Row key={x.id} title={x.title} sub={x.body}
                onEdit={() => { setMEdit(x.id); setM({ title: x.title, body: x.body }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                onDelete={() => del(() => deleteMacro(x.id), macros.load, 'macro')} />
            ))}
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div>
          <form onSubmit={(ev) => save(ev, { ...(eEdit ? { id: eEdit } : {}), title: e.title, body: e.body, starts_at: dt(e.starts_at), ends_at: dt(e.ends_at), published: e.published }, saveEvent, () => { setE({ title: '', body: '', starts_at: '', ends_at: '', published: true }); setEEdit(null) }, events.load)} className="card mb-3 space-y-2 p-4">
            <p className="text-[13px] font-bold text-white">{eEdit ? 'Edit event' : 'New event / promo'}</p>
            <Field label="Title"><Input value={e.title} onChange={(e2) => setE({ ...e, title: e2.target.value })} required /></Field>
            <Field label="Details"><Textarea value={e.body} onChange={(e2) => setE({ ...e, body: e2.target.value })} rows={3} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Starts"><Input type="datetime-local" value={e.starts_at} onChange={(e2) => setE({ ...e, starts_at: e2.target.value })} /></Field>
              <Field label="Ends"><Input type="datetime-local" value={e.ends_at} onChange={(e2) => setE({ ...e, ends_at: e2.target.value })} /></Field>
            </div>
            <Field label="Status"><Select value={e.published ? 'on' : 'off'} onChange={(e2) => setE({ ...e, published: e2.target.value === 'on' })}><option value="on">Live</option><option value="off">Draft</option></Select></Field>
            <div className="flex gap-2">
              <Btn type="submit" loading={busy} className="flex-1">{eEdit ? 'Save' : 'Add event'}</Btn>
              {eEdit && <Btn variant="ghost" onClick={() => { setEEdit(null); setE({ title: '', body: '', starts_at: '', ends_at: '', published: true }) }}>Cancel</Btn>}
            </div>
          </form>
          <div className="space-y-2">
            {events.items.map((x) => (
              <Row key={x.id} title={x.title} sub={`${x.starts_at ? timeAgo(x.starts_at) : 'no start'} → ${x.ends_at ? timeAgo(x.ends_at) : 'no end'}`} published={x.published}
                onEdit={() => { setEEdit(x.id); setE({ title: x.title, body: x.body || '', starts_at: dtLocal(x.starts_at), ends_at: dtLocal(x.ends_at), published: x.published }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                onToggle={() => save(null, { id: x.id, title: x.title, body: x.body, starts_at: x.starts_at, ends_at: x.ends_at, published: !x.published }, saveEvent, () => {}, events.load)}
                onDelete={() => del(() => deleteEvent(x.id), events.load, 'event')} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
