import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Btn, EmptyState, Field, Input, Modal, PageHead, Select, Skeleton, Textarea, toast } from '../../components/ui'
import { ArrowLeft, Lock, Send, Shield, Ticket as TicketIcon, User, Star } from '../../components/icons'
import { addTicketMessage, createTicket, getTicketWithMessages, getUserTickets, setTicketStatus, listMacros, rateTicket } from '../../lib/db'
import { useStore } from '../../lib/store'
import { shortId, timeAgo } from '../../lib/utils'

/* ------------------------------- List ------------------------------- */

export function Tickets() {
  const { user } = useStore()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ subject: '', order_id: '', priority: 'medium', message: '' })
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    getUserTickets(user.id).then(setTickets).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const t = await createTicket(user.id, form)
      setShowNew(false)
      setForm({ subject: '', order_id: '', priority: 'medium', message: '' })
      toast(`Ticket ${shortId(t.id)} created!`)
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHead
        title="Support Tickets"
        sub="We reply within a few hours."
        right={<Btn onClick={() => setShowNew(true)} className="!px-3.5 !py-2 text-[13px]">+ New</Btn>}
      />

      {loading && <Skeleton lines={3} />}
      {!loading && tickets.length === 0 && (
        <EmptyState icon={<TicketIcon size={40} />} title="No tickets yet" hint="Facing an issue? Open your first ticket." action={<Btn onClick={() => setShowNew(true)}>Open Ticket</Btn>} />
      )}
      <div className="space-y-2.5">
        {tickets.map((t) => (
          <Link key={t.id} to={`/tickets/${t.id}`} className="card card-hover block p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[12px] text-violet-300">{shortId(t.id)}</p>
              <div className="flex gap-1.5">
                <Badge status={t.priority === 'high' ? 'pending' : 'closed'}>{t.priority}</Badge>
                <Badge status={t.status} />
              </div>
            </div>
            <p className="mt-1 text-sm font-semibold text-white">{t.subject}</p>
            <p className="mt-1 text-[11px] text-white/35">
              {t.order_id ? `Order #${t.order_id} · ` : ''}Updated {timeAgo(t.updated_at)}
            </p>
          </Link>
        ))}
      </div>

      <AnimatePresence>
        {showNew && (
          <Modal title="New Support Ticket" onClose={() => setShowNew(false)}>
            <form onSubmit={submit} className="space-y-3.5">
              <Field label="Subject">
                <Input placeholder="e.g. Order is stuck in pending" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Order ID (optional)">
                  <Input type="number" placeholder="#" value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} />
                </Field>
                <Field label="Priority">
                  <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Select>
                </Field>
              </div>
              <Field label="Message">
                <Textarea placeholder="Describe your issue in detail…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
              </Field>
              <Btn type="submit" loading={busy} className="w-full">Submit Ticket</Btn>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

const CANNED = [
  'Thanks for contacting support. We are checking this and will update you shortly.',
  'Your order has been forwarded to the provider. Please allow the start time mentioned on the service.',
  'We have refilled your order. Drops (if any) will recover within 24 hours.',
  'Your deposit has been approved and balance credited. Thank you!',
  'This service needs a public link. Please make the target public and reply here.',
]

/* ------------------------------ Detail ------------------------------ */

export function TicketDetail({ role = 'user', backTo = '/tickets', onStatusChange }) {
  const { id } = useParams()
  const { user } = useStore()
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [macros, setMacros] = useState([])
  const [rating, setRating] = useState(0)
  const navigate = useNavigate()

  const load = () => {
    getTicketWithMessages(id)
      .then(({ ticket: t, messages: m }) => {
        if (!t) return toast('Ticket not found', 'error')
        if (role !== 'admin' && t.user_id !== user.id) {
          toast('Not your ticket', 'error')
          return navigate(backTo)
        }
        setTicket(t)
        setMessages(m)
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [id])

  useEffect(() => {
    if (role === 'admin') listMacros().then(setMacros).catch(() => {})
  }, [role])

  const send = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    setBusy(true)
    try {
      await addTicketMessage(ticket.id, user.id, role, reply)
      setReply('')
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const close = async (status) => {
    try {
      await setTicketStatus(ticket.id, status)
      toast(`Ticket ${status}`)
      onStatusChange?.()
      load()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  if (loading) return <Skeleton lines={4} />
  if (!ticket) return <EmptyState icon={<TicketIcon size={40} />} title="Ticket not found" action={<Btn onClick={() => navigate(backTo)}>Go back</Btn>} />

  return (
    <div>
      <button onClick={() => navigate(backTo)} className="mb-3 flex items-center gap-1 text-[13px] font-semibold text-white/50 hover:text-white">
        <ArrowLeft size={15} /> Back
      </button>
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[12px] text-violet-300">{shortId(ticket.id)}</p>
          <Badge status={ticket.status} />
        </div>
        <p className="mt-1 font-bold text-white">{ticket.subject}</p>
        {ticket.order_id && <p className="mt-0.5 text-[12px] text-white/45">Linked order #{ticket.order_id}</p>}
        {role === 'admin' && ticket.status !== 'closed' && (
          <Btn variant="subtle" onClick={() => close('closed')} className="mt-3 w-full !py-2 text-[13px]">Close ticket</Btn>
        )}
        {role === 'admin' && ticket.status === 'closed' && (
          <Btn variant="subtle" onClick={() => close('open')} className="mt-3 w-full !py-2 text-[13px]">Re-open ticket</Btn>
        )}
      </div>

      {/* Chat */}
      <div className="mt-3 space-y-2.5">
        {messages.map((m) => {
          const mine = m.sender_id === user.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${mine ? 'grad-btn rounded-br-md text-white' : 'card rounded-bl-md'}`}>
                {!mine && (
                  <p className={`mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${m.sender_role === 'admin' ? 'text-amber-300' : 'text-sky-300'}`}>
                    {m.sender_role === 'admin' ? <><Shield size={10} /> Support</> : <><User size={10} /> User</>}
                  </p>
                )}
                <p className="text-[13px] leading-relaxed">{m.message}</p>
                <p className={`mt-1 text-right text-[10px] ${mine ? 'text-white/60' : 'text-white/35'}`}>{timeAgo(m.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {role === 'admin' && ticket.status !== 'closed' && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/35">
            Quick replies{macros.length ? ` — ${macros.length} from library` : ' — defaults (add more in Content)'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(macros.length ? macros : CANNED.map((c) => ({ title: c.slice(0, 32), body: c }))).map((mc, i) => (
              <button key={i} onClick={() => setReply(mc.body)} title={mc.body} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[11px] font-bold text-white/60 hover:border-violet-500/40 hover:text-white">
                {(mc.title || mc.body).slice(0, 34)}{(mc.title || mc.body).length > 34 ? '…' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      {ticket.status !== 'closed' ? (
        <form onSubmit={send} className="sticky bottom-24 mt-4 flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your message…"
            className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-500/60"
          />
          <button type="submit" disabled={busy || !reply.trim()} className="grad-btn flex h-[46px] w-[52px] shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50">
            <Send size={18} />
          </button>
        </form>
      ) : (
        <div>
          {role === 'user' && !ticket.satisfaction ? (
            <div className="card mt-4 p-4 text-center">
              <p className="text-[13px] font-bold text-white">How was our support?</p>
              <div className="mt-2 flex justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} onClick={() => setRating(i)} aria-label={`${i} stars`}>
                    <Star size={30} className={i <= rating ? 'text-amber-300' : 'text-white/20'} fill={i <= rating ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <button
                  onClick={async () => { try { await rateTicket(ticket.id, rating); toast('Thanks for rating!'); load() } catch (e) { toast(e.message, 'error') } }}
                  className="grad-btn mt-2.5 rounded-xl px-5 py-2 text-[13px] font-bold text-white"
                >
                  Submit {rating}/5
                </button>
              )}
            </div>
          ) : ticket.satisfaction > 0 ? (
            <p className="mt-4 text-center text-[12.5px] text-white/45">
              {role === 'user' ? 'You rated this ticket' : 'User rated'} <b className="text-amber-300">{ticket.satisfaction}/5</b>
            </p>
          ) : null}
          <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 text-center text-[13px] text-white/45">
            <Lock size={14} /> This ticket is closed. {role === 'user' ? 'Open a new ticket if you need more help.' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
