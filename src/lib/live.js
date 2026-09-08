/* ═══════════════════════════════════════════════════════════════
   Realtime layer (Supabase postgres_changes + broadcast + presence).
   Zero polling: ticket chat, order status, funds, notifications, admin feed
   all arrive instantly. RLS still enforced on every event.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { bus } from './cache'

/* --------------------- instant ticket chat --------------------- */

/**
 * Live channel for one ticket: new messages, status changes, typing
 * indicator (broadcast) and viewer presence. Returns sendTyping().
 */
export function useTicketLive(ticketId, userId, role, cbs = {}) {
  const ref = useRef(cbs)
  ref.current = cbs
  const chRef = useRef(null)
  const lastType = useRef(0)

  useEffect(() => {
    if (!ticketId || !userId) return
    const ch = supabase.channel(`ticket:${ticketId}`)
    chRef.current = ch
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketId}` },
      (p) => ref.current.onMessage?.(p.new),
    )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` },
        (p) => ref.current.onTicket?.(p.new),
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.who && payload.who !== userId) ref.current.onTyping?.(payload)
      })
      .on('presence', { event: 'sync' }, () => {
        const others = Object.values(ch.presenceState())
          .flat()
          .filter((o) => o.user_id !== userId)
        ref.current.onPresence?.(others)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.track({ user_id: userId, role: role || 'user', at: Date.now() }).catch(() => {})
        }
      })
    return () => {
      supabase.removeChannel(ch)
      chRef.current = null
    }
  }, [ticketId, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendTyping = () => {
    const now = Date.now()
    if (now - lastType.current < 2000) return
    lastType.current = now
    try {
      chRef.current?.send({ type: 'broadcast', event: 'typing', payload: { who: userId, role } })
    } catch {
      /* ignore */
    }
  }
  return { sendTyping }
}

/* --------------------- user-wide live feed --------------------- */

export function useUserLive(userId, cbs = {}) {
  const ref = useRef(cbs)
  ref.current = cbs
  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel(`user:${userId}`)
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (p) => ref.current.onNotif?.(p.new),
    )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
        (p) => ref.current.onOrder?.(p),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        (p) => ref.current.onTxn?.(p),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `user_id=eq.${userId}` },
        (p) => ref.current.onTicket?.(p),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'services' },
        (p) => ref.current.onCatalog?.(p),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (p) => ref.current.onAnnounce?.(p.new),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [userId])
}

/* --------------------- admin-wide live feed --------------------- */

export function useAdminLive(cbs = {}) {
  const ref = useRef(cbs)
  ref.current = cbs
  useEffect(() => {
    const ch = supabase.channel('admin:live')
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tickets' },
      (p) => ref.current.onTicket?.(p.new),
    )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages' },
        (p) => ref.current.onReply?.(p.new),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (p) => ref.current.onOrder?.(p.new),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (p) => ref.current.onTxn?.(p),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (p) => ref.current.onUser?.(p.new),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])
}

/* --------------------- live unread badge --------------------- */

export function useLiveBadge(userId) {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    if (!userId) return
    let dead = false
    const fetchCount = async () => {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false)
        if (!dead) setUnread(count || 0)
      } catch {
        /* ignore */
      }
    }
    fetchCount()
    return bus.on('notifs', fetchCount)
  }, [userId])
  return unread
}
