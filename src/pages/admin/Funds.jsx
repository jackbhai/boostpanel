import { useEffect, useMemo, useState } from 'react'
import { approveTopup, getAllTxns, listUsers, rejectTopup, flagTxn } from '../../lib/db'
import { useLiveEvent } from '../../lib/cache'
import { useStore } from '../../lib/store'
import { money } from '../../lib/utils'
import { downloadCSV } from '../../lib/csv'
import {
  Badge, Btn, EmptyState, Modal, PageHead,
  SearchInput, Skeleton, toast,
} from '../../components/ui'
import { Check, Download, Eye, X, AlertCircle } from '../../components/icons'

const small = '!px-3 !py-1.5 text-[12px]'

export default function AdminFunds() {
  const { currency } = useStore()
  const [txns, setTxns] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(null)
  const [shot, setShot] = useState('')

  const load = async (silent) => {
    try {
      const [t, u] = await Promise.all([getAllTxns(), listUsers()])
      setTxns(t || [])
      setUsers(u || [])
    } catch (e) {
      if (!silent) toast(e.message, 'error')
    }
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLiveEvent('admin-txns', () => load(true))

  const umap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.email])), [users])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return txns.filter((t) => {
      if (tab === 'pending' && !(t.type === 'credit' && t.status === 'pending')) return false
      if (tab === 'deposits' && !(t.type === 'credit' && ['UPI', 'upi', 'Card', 'card', 'Crypto', 'crypto', 'Bank', 'bank'].includes(t.method))) return false
      if (tab === 'flagged' && !t.flagged) return false
      if (!s) return true
      return (umap[t.user_id] || '').toLowerCase().includes(s) || (t.txn_ref || '').toLowerCase().includes(s) || String(t.id).includes(s)
    })
  }, [txns, tab, q, umap])

  const pendCount = txns.filter((t) => t.type === 'credit' && t.status === 'pending').length

  const act = async (id, fn, label) => {
    setBusy(id)
    try {
      const r = await fn(id)
      toast(label + (r?.credited ? ` — credited ${money(r.credited, currency())} (incl. bonus)` : ''))
    } catch (e) {
      toast(e.message, 'error')
    }
    setBusy(null)
    load()
  }

  const flagIt = async (t) => {
    setBusy(`f${t.id}`)
    try {
      if (t.flagged) { await flagTxn(t.id, false, ''); toast('Flag removed') }
      else {
        const note = window.prompt('Flag reason (visible to admins + Risk Center):', '')
        if (note === null) { setBusy(null); return }
        await flagTxn(t.id, true, note); toast('Flagged for review')
      }
    } catch (e) { toast(e.message, 'error') }
    setBusy(null)
    load()
  }

  if (loading) return <Skeleton lines={5} />
  return (
    <div>
      <PageHead title="Funds" sub="Verify screenshots + UTR, then approve. Credit runs server-side." />
      <div className="mb-4 flex flex-wrap gap-2">
        {[['pending', `Pending approval (${pendCount})`], ['deposits', 'All deposits'], ['flagged', `Flagged (${txns.filter((t) => t.flagged).length})`], ['all', 'Full ledger']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`rounded-xl px-4 py-2 text-[13px] font-bold transition ${tab === v ? 'grad-btn text-white' : 'bg-white/5 text-white/50 hover:text-white'}`}>{l}</button>
        ))}
        <div className="min-w-[180px] flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search user, UTR, id…" /></div>
        <Btn variant="ghost" onClick={() => downloadCSV('transactions.csv', rows.map((t) => ({ id: t.id, user: umap[t.user_id] || t.user_id, type: t.type, amount: t.amount, method: t.method || '', utr: t.txn_ref || '', status: t.status, note: t.note || '', created: t.created_at })))} className={small}><Download size={14} />CSV</Btn>
      </div>
      {rows.length === 0 ? <EmptyState title="Nothing here" /> : (
        <div className="space-y-2">
          {rows.map((t) => (
            <div key={t.id} className="card p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/35">#{t.id}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{umap[t.user_id] || t.user_id}</span>
                <Badge status={t.status} />
                <span className={`text-sm font-extrabold ${t.type === 'credit' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {t.type === 'credit' ? '+' : '−'}{money(t.amount, currency())}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/45">
                {t.method || t.type}{t.txn_ref ? ` · ${t.txn_ref}` : ''} · {new Date(t.created_at).toLocaleString()}
              </p>
              {t.note && <p className="mt-0.5 text-xs text-white/40">{t.note}</p>}
              {t.flagged && <p className="mt-1 rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-xs font-semibold text-rose-200">Flagged{t.flag_note ? `: ${t.flag_note}` : ''}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.screenshot_url && <Btn variant="subtle" onClick={() => setShot(t.screenshot_url)} className={small}><Eye size={13} />Screenshot</Btn>}
                {t.type === 'credit' && t.status === 'pending' && (
                  <>
                    <Btn onClick={() => act(t.id, approveTopup, `Deposit #${t.id} approved`)} loading={busy === t.id} className={small}><Check size={13} />Approve + credit</Btn>
                    <Btn variant="danger" onClick={() => act(t.id, rejectTopup, `Deposit #${t.id} rejected`)} loading={busy === t.id} className={small}><X size={13} />Reject</Btn>
                  </>
                )}
                <Btn variant="subtle" onClick={() => flagIt(t)} loading={busy === `f${t.id}`} className={small}><AlertCircle size={13} />{t.flagged ? 'Unflag' : 'Flag'}</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      {shot && (
        <Modal title="Payment screenshot" onClose={() => setShot('')}>
          <img src={shot} alt="Payment proof" className="max-h-[70vh] w-full rounded-xl object-contain" />
        </Modal>
      )}
    </div>
  )
}
