import { useCallback, useEffect, useState } from 'react'
import { Btn, EmptyState, PageHead, toast } from '../../components/ui'
import { Bell, Check, Trash2 } from '../../components/icons'
import { clearReadNotifs, deleteNotif, listNotifications, markAllNotifsRead, markNotifRead } from '../../lib/db'
import { bus, useLiveEvent } from '../../lib/cache'
import { timeAgo } from '../../lib/utils'
import { useStore } from '../../lib/store'

export default function Notifications() {
  const { user } = useStore()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async (silent) => {
    if (!user) return
    if (!silent) setLoading(true)
    try { setList(await listNotifications(user.id)) } catch { if (!silent) toast('Load failed', 'error') }
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus) }
  }, [load])
  useLiveEvent('notifs', () => load(true))

  const open = async (n) => {
    if (!n.read) {
      setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      try { await markNotifRead(n.id); bus.emit('notifs') } catch { /* ignore */ }
    }
  }
  const markAll = async () => {
    try { await markAllNotifsRead(user.id); setList((prev) => prev.map((x) => ({ ...x, read: true }))); bus.emit('notifs'); toast('All marked as read') }
    catch (err) { toast(err.message, 'error') }
  }
  const remove = async (n) => {
    try { await deleteNotif(n.id); setList((prev) => prev.filter((x) => x.id !== n.id)); bus.emit('notifs') } catch (err) { toast(err.message, 'error') }
  }
  const clearRead = async () => {
    if (!window.confirm('Delete all read notifications?')) return
    try { await clearReadNotifs(user.id); setList((prev) => prev.filter((x) => !x.read)); toast('Cleared') } catch (err) { toast(err.message, 'error') }
  }

  const rows = filter === 'all' ? list : list.filter((n) => !n.read)
  const unread = list.filter((n) => !n.read).length

  return (
    <div>
      <PageHead title="Notifications" sub={unread ? `${unread} unread` : 'All caught up.'} />
      <div className="mb-2 flex gap-1.5">
        {[['all', `All (${list.length})`], ['unread', `Unread (${unread})`]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${filter === id ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/55'}`}
          >
            {label}
          </button>
        ))}
        <span className="flex-1" />
        {unread > 0 && (
          <button onClick={markAll} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-white/60">
            <Check size={13} />Read all
          </button>
        )}
        {list.some((n) => n.read) && (
          <button onClick={clearRead} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-white/60">
            <Trash2 size={13} />Clear read
          </button>
        )}
      </div>

      {loading ? <p className="py-6 text-center text-[13px] text-white/40">Loading…</p>
        : rows.length === 0 ? (
          <EmptyState
            icon={<Bell size={36} />}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            hint="Order updates, deposits, price alerts and promos land here."
          />
        ) : (
          <div className="space-y-1.5">
            {rows.map((n) => (
              <div
                key={n.id}
                onClick={() => open(n)}
                className={`card flex cursor-pointer items-start gap-2.5 p-3.5 transition ${n.read ? 'opacity-70' : 'border-violet-500/25 bg-violet-500/[0.06]'}`}
              >
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-white/15' : 'bg-violet-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 truncate text-[14px] font-bold text-white">{n.title}</p>
                    {n.is_broadcast && (
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Promo</span>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-white/60">{n.body}</p>
                  <p className="mt-1 text-[11px] text-white/30">{timeAgo(n.created_at)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(n) }}
                  className="shrink-0 rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-rose-300"
                  aria-label="Delete notification"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
