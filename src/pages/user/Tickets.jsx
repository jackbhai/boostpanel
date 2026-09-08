import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Btn, EmptyState, Field, Input, Modal, PageHead, Select, Skeleton, Textarea, toast } from '../../components/ui'
import { TypingDots } from '../../components/motion'
import { ArrowLeft, Lock, Send, Shield, Ticket as TicketIcon, User, Star } from '../../components/icons'
import { addTicketMessage, createTicket, getTicketWithMessages, getUserTickets, setTicketStatus, listMacros, rateTicket } from '../../lib/db'
import { useLiveEvent } from '../../lib/cache'
import { useTicketLive } from '../../lib/live'
import { sfx } from '../../lib/sound'
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

  const load = (silent) => {
    if (!silent) setLoading(true)
    getUserTickets(user.id)
      .then(setTickets)
      .catch((e) => {
        if (!silent) toast(e.message, 'error')
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLiveEvent('tickets', () => load(true))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const t = await createTicket(user.id, form)
      setShowNew(false)
      setForm({ subject: '', order_id: '', priority: 'medium', message: '' })
      sfx('success')
      toast(`Ticket ${shortId(t.id)} created!`)
      load(true)
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
        sub="Live chat — replies arrive instantly."
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

/* ------------------------- Instant chat detail ------------------------- */

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
  const [typingRole, setTypingRole] = useState(null)
  const [viewers, setViewers] = useState([])
  const navigate = useNavigate()
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const tmpId = useRef(0)
  const typeTimer = useRef(null)

  const load = () => {
    getTicketWithMessages(id)
      .then(({ ticket: t, messages: m }) => {
        if (!t) return toast('Ticket not found', 'error')
        if (role !== 'admin' && t.user_id !== user.id) {
          toast('Not your ticket', 'error')
          return navigate(backTo)
        }
        setTicket(t)
        setMessages((prev) => {
          /* keep optimistic pendings, adopt server list */
          const pend = prev.filter((x) => x.pending && !m.some((s) => s.message === x.message && s.sender_id === x.sender_id))
          return [...m, ...pend]
        })
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (role === 'admin') listMacros().then(setMacros).catch(() => {})
  }, [role])

  /* Live wire: messages + status + typing + presence — no refresh needed. */
  const { sendTyping } = useTicketLive(id, user?.id, role, {
    onMessage: (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        const ti = prev.findIndex((m) => m.pending && m.sender_id === msg.sender_id && m.message === msg.message)
        if (ti >= 0) {
          const copy = [...prev]
          copy[ti] = msg
          return copy
        }
        return [...prev, msg]
      })
      setTypingRole(null)
      if (msg.sender_id !== user.id) sfx('receive')
    },
    onTicket: (t) => {
      if (t) {
        setTicket(t)
        onStatusChange?.()
      }
    },
    onTyping: (p) => {
      setTypingRole(p.role)
      clearTimeout(typeTimer.current)
      typeTimer.current = setTimeout(() => setTypingRole(null), 3200)
    },
    onPresence: setViewers,
  })

  /* Smart auto-scroll: follow live chat, never yank while reading history. */
  useEffect(() => {
    const nearBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 500
    const lastMine = messages[messages.length - 1]?.sender_id === user?.id
    if (nearBottom || lastMine) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, typingRole]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e, override) => {
    e?.preventDefault?.()
    const body = (override ?? reply).trim()
    if (!body || busy) return
    if (!override) setReply('')
    else setMessages((prev) => prev.filter((m) => m.id !== override._failedId))
    const temp = {
      id: `tmp-${++tmpId.current}`,
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: role,
      message: body,
      created_at: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, temp])
    sfx('send')
    setBusy(true)
    try {
      const real = await addTicketMessage(ticket.id, user.id, role, body)
      setMessages((prev) => {
        if (prev.some((m) => m.id === real.id)) return prev.filter((m) => m.id !== temp.id)
        return prev.map((m) => (m.id === temp.id ? real : m))
      })
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, failed: true, pending: false } : m)))
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const retry = (m) => {
    const text = m.message
    setMessages((prev) => prev.filter((x) => x.id !== m.id))
    send(null, text)
  }

  const close = async (status) => {
    try {
      await setTicketStatus(ticket.id, status)
      toast(`Ticket ${status}`)
      onStatusChange?.()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  if (loading) return <Skeleton lines={4} />
  if (!ticket) return <EmptyState icon={<TicketIcon size={40} />} title="Ticket not found" action={<Btn onClick={() => navigate(backTo)}>Go back</Btn>} />

  const otherOnline = viewers.some((v) => (role === 'user' ? v.role === 'admin' : v.role === 'user'))

  return (
    <div>
      <button onClick={() => navigate(backTo)} className="mb-3 flex items-center gap-1 text-[13px] font-semibold text-white/50 hover:text-white">
        <ArrowLeft size={15} /> Back
      </button>
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[12px] text-violet-300">{shortId(ticket.id)}</p>
          <div className="flex items-center gap-2">
            {otherOnline && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {role === 'user' ? 'Support online' : 'User viewing'}
              </span>
            )}
            <Badge status={ticket.status} />
          </div>
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
            <div key={m.id} className="msg-in flex justify-start" style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${mine ? 'grad-btn rounded-br-md text-white' : 'card rounded-bl-md'} ${m.failed ? 'opacity-70 ring-1 ring-rose-500/60' : ''}`}>
                {!mine && (
                  <p className={`mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${m.sender_role === 'admin' ? 'text-amber-300' : 'text-sky-300'}`}>
                    {m.sender_role === 'admin' ? <><Shield size={10} /> Support</> : <><User size={10} /> User</>}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.message}</p>
                <p className={`mt-1 flex items-center justify-end gap-1 text-right text-[10px] ${mine ? 'text-white/60' : 'text-white/35'}`}>
                  {m.pending && 'sending… '}
                  {timeAgo(m.created_at)}
                </p>
                {m.failed && (
                  <button onClick={() => retry(m)} className="mt-1 text-[11px] font-bold text-rose-200 underline">
                    Failed — tap to retry
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {typingRole && (
          <div className="msg-in flex justify-start">
            <div className="card rounded-bl-md px-4 py-3">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {role === 'admin' && ticket.status !== 'closed' && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/35">
            Quick replies{macros.length ? ` — ${macros.length} from library` : ' — defaults (add more in Content)'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(macros.length ? macros : CANNED.map((c) => ({ title: c.slice(0, 32), body: c }))).map((mc, i) => (
              <button key={i} onClick={() => { setReply(mc.body); inputRef.current?.focus(); }} title={mc.body} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[11px] font-bold text-white/60 hover:border-violet-500/40 hover:text-white">
                {(mc.title || mc.body).slice(0, 34)}{(mc.title || mc.body).length > 34 ? '…' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      {ticket.status !== 'closed' ? (
        <form onSubmit={send} className="sticky bottom-24 mt-4 flex gap-2">
          <input
            ref={inputRef}
            value={reply}
            onChange={(e) => { setReply(e.target.value); if (e.target.value.trim()) sendTyping() }}
            placeholder={otherOnline ? 'They are online — type your message…' : 'Type your message…'}
            className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-500/60"
          />
          <button type="submit" disabled={busy || !reply.trim()} className="grad-btn tab-pop flex h-[46px] w-[52px] shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50">
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
                  onClick={async () => { try { await rateTicket(ticket.id, rating); toast('Thanks for rating!') } catch (e) { toast(e.message, 'error') } }}
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
