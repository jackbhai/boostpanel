import { AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Badge, EmptyState, Modal, PageHead, Skeleton, toast } from '../../components/ui'
import { approveTopup, getAllTxns, listUsers, rejectTopup } from '../../lib/db'
import { useStore } from '../../lib/store'
import { money, timeAgo } from '../../lib/utils'

export default function AdminFunds() {
  const { currency } = useStore()
  const [txns, setTxns] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')
  const [acting, setActing] = useState(null)
  const [shot, setShot] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([getAllTxns(), listUsers().catch(() => [])])
      .then(([t, u]) => { setTxns(t); setUsers(u) })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const emailOf = (id) => users.find((u) => u.id === id)?.email || String(id).slice(0, 8)
  const pending = useMemo(() => txns.filter((t) => t.status === 'pending' && t.type === 'credit'), [txns])
  const history = useMemo(() => txns.filter((t) => t.status !== 'pending'), [txns])
  const list = tab === 'pending' ? pending : history

  const decide = async (txn, approve) => {
    const action = approve ? 'APPROVE' : 'REJECT'
    if (!window.confirm(`${action} ${money(txn.amount, currency())} for ${emailOf(txn.user_id)}?`)) return
    setActing(txn.id)
    try {
      if (approve) await approveTopup(txn)
      else await rejectTopup(txn)
      toast(approve ? 'Approved — balance added ✅' : 'Rejected ❌')
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setActing(null)
    }
  }

  return (
    <div>
      <PageHead title="Funds" sub="Verify screenshots, then approve." />

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`rounded-xl px-3 py-2.5 text-[13px] font-bold transition ${tab === 'pending' ? 'grad-btn text-white' : 'card text-white/55'}`}
        >
          ⏳ Pending ({pending.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`rounded-xl px-3 py-2.5 text-[13px] font-bold transition ${tab === 'history' ? 'grad-btn text-white' : 'card text-white/55'}`}
        >
          🧾 History ({history.length})
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        {loading && <Skeleton lines={4} />}
        {!loading && list.length === 0 && (
          <EmptyState icon={tab === 'pending' ? '✅' : '🧾'} title={tab === 'pending' ? 'All caught up!' : 'No history yet'} hint={tab === 'pending' ? 'No pending fund requests.' : ''} />
        )}
        {list.map((t) => (
          <div key={t.id} className="card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-bold text-white">👤 {emailOf(t.user_id)}</p>
              <Badge status={t.status} />
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div className="text-[12px] text-white/50">
                <p>{t.method}{t.txn_ref ? ` · UTR: ` : ''}{t.txn_ref && <span className="font-mono font-bold text-violet-200">{t.txn_ref}</span>}</p>
                <p className="mt-0.5 text-[11px] text-white/35">{t.type} · {timeAgo(t.created_at)}</p>
                {t.note && <p className="mt-0.5 text-[11px] text-white/45">{t.note}</p>}
              </div>
              <p className={`shrink-0 text-xl font-extrabold ${t.type === 'credit' ? 'text-emerald-300' : 'text-white'}`}>
                {t.type === 'credit' ? '+' : '−'}{money(t.amount, currency())}
              </p>
            </div>
            {t.screenshot_url && (
              <button onClick={() => setShot(t)} className="mt-2.5 block w-full overflow-hidden rounded-xl border border-white/10">
                <img src={t.screenshot_url} alt="payment proof" className="max-h-56 w-full object-contain bg-black/40" loading="lazy" />
                <span className="block bg-white/5 py-1.5 text-[12px] font-semibold text-violet-300">🔍 Tap to verify full screenshot</span>
              </button>
            )}
            {t.status === 'pending' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  disabled={acting === t.id}
                  onClick={() => decide(t, true)}
                  className="rounded-xl bg-emerald-600/90 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  ✅ Approve
                </button>
                <button
                  disabled={acting === t.id}
                  onClick={() => decide(t, false)}
                  className="rounded-xl bg-rose-600/90 py-2.5 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  ❌ Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {shot && (
          <Modal title={`Proof · ${money(shot.amount, currency())}`} onClose={() => setShot(null)} wide>
            <img src={shot.screenshot_url} alt="proof full" className="max-h-[60vh] w-full rounded-xl object-contain bg-black/40" />
            <div className="mt-3 rounded-xl bg-white/5 p-3 text-[13px] text-white/70">
              <p>👤 {emailOf(shot.user_id)}</p>
              <p className="mt-0.5">UTR: <span className="font-mono font-bold text-violet-200">{shot.txn_ref || '—'}</span> · {shot.method}</p>
            </div>
            {shot.status === 'pending' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={async () => { setShot(null); await decide(shot, true) }}
                  className="rounded-xl bg-emerald-600/90 py-2.5 text-sm font-bold text-white"
                >
                  ✅ Approve
                </button>
                <button
                  onClick={async () => { setShot(null); await decide(shot, false) }}
                  className="rounded-xl bg-rose-600/90 py-2.5 text-sm font-bold text-white"
                >
                  ❌ Reject
                </button>
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
