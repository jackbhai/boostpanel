import { useEffect, useMemo, useState } from 'react'
import { Badge, Btn, EmptyState, PageHead, toast } from '../../components/ui'
import { AlertCircle, Check, Shield, X } from '../../components/icons'
import { apiLogsAdmin, flagTxn, flaggedTxns, getAllTxns } from '../../lib/db'
import { money, timeAgo } from '../../lib/utils'
import { useStore } from '../../lib/store'
import { Link } from 'react-router-dom'

export default function AdminRisk() {
  const { currency } = useStore()
  const [txns, setTxns] = useState([])
  const [flagged, setFlagged] = useState([])
  const [api, setApi] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [t, f, a] = await Promise.all([
        getAllTxns(1000).catch(() => []), flaggedTxns().catch(() => []), apiLogsAdmin(500).catch(() => []),
      ])
      setTxns(t || []); setFlagged(f || []); setApi(a || [])
    } catch { toast('Load failed', 'error') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const signals = useMemo(() => {
    // duplicate UTRs across different users
    const byRef = {}
    for (const t of txns) {
      const r = (t.txn_ref || '').trim()
      if (!r || r.startsWith('ORD-')) continue
      if (!byRef[r]) byRef[r] = []
      byRef[r].push(t)
    }
    const dupes = Object.entries(byRef).filter(([, v]) => new Set(v.map((t) => t.user_id)).size > 1)
    // rapid deposits: 3+ pending/approved deposits by same user within 10 min
    const deps = txns.filter((t) => t.type === 'credit' && ['UPI', 'upi', 'Card', 'Crypto', 'Bank', 'card', 'crypto', 'bank'].includes(t.method))
    const byUser = {}
    for (const t of deps) { if (!byUser[t.user_id]) byUser[t.user_id] = []; byUser[t.user_id].push(t) }
    const rapid = []
    for (const [u, list] of Object.entries(byUser)) {
      const sorted = [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      for (let i = 0; i + 2 < sorted.length; i++) {
        const dt = new Date(sorted[i + 2].created_at) - new Date(sorted[i].created_at)
        if (dt < 10 * 60000) { rapid.push({ user: u, txns: sorted.slice(i, i + 3) }); break }
      }
    }
    // large pending deposits
    const big = txns.filter((t) => t.type === 'credit' && t.status === 'pending' && Number(t.amount) >= 5000)
    // api hammering: 60+ calls by one key in last hour
    const hr = Date.now() - 3600000
    const perKey = {}
    for (const l of api) {
      if (new Date(l.created_at).getTime() < hr || !l.user_id) continue
      perKey[l.user_id] = (perKey[l.user_id] || 0) + 1
    }
    const hammer = Object.entries(perKey).filter(([, n]) => n >= 60)
    return { dupes, rapid, big, hammer }
  }, [txns, api])

  const unflag = async (t) => {
    setBusy(t.id)
    try { await flagTxn(t.id, false, ''); toast('Flag removed'); load() } catch (err) { toast(err.message, 'error') }
    setBusy(null)
  }
  const flag = async (t, note) => {
    setBusy(t.id)
    try { await flagTxn(t.id, true, note); toast('Transaction flagged'); load() } catch (err) { toast(err.message, 'error') }
    setBusy(null)
  }

  const total = signals.dupes.length + signals.rapid.length + signals.big.length + signals.hammer.length + flagged.length

  return (
    <div>
      <PageHead title="Risk Center" sub="Fraud signals + flagged money. Review before approving." />
      <div className={`card mb-3 flex items-center gap-3 p-4 ${total ? 'border-rose-500/30 bg-rose-500/5' : 'border-emerald-500/25 bg-emerald-500/5'}`}>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${total ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
          <Shield size={24} />
        </span>
        <div>
          <p className="text-[15px] font-extrabold text-white">{loading ? 'Scanning…' : total ? `${total} open signal(s)` : 'All clear'}</p>
          <p className="text-[12px] text-white/50">{loading ? 'Analyzing transactions + API logs…' : total ? 'Review each item below.' : 'No duplicate UTRs, bursts or flags found.'}</p>
        </div>
        <Btn variant="ghost" onClick={load} className="ml-auto !px-3 !py-1.5 text-[12px]">Rescan</Btn>
      </div>

      {loading ? <p className="py-6 text-center text-[13px] text-white/40">Scanning…</p> : total === 0 ? (
        <EmptyState icon={<Check size={36} />} title="Nothing suspicious" hint="Duplicate UTRs, deposit bursts and API hammering will appear here." />
      ) : (
        <div className="space-y-3">
          {flagged.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-rose-300">Flagged transactions ({flagged.length})</p>
              <div className="space-y-1.5">
                {flagged.map((t) => (
                  <div key={t.id} className="card border-rose-500/25 p-3">
                    <div className="flex items-center gap-2">
                      <Badge status="closed">flagged</Badge>
                      <span className="flex-1 text-[13px] font-bold text-white">{money(t.amount, currency())}</span>
                      <span className="font-mono text-[11px] text-white/40">{t.txn_ref || '—'}</span>
                    </div>
                    {t.flag_note && <p className="mt-1 text-[12px] text-rose-200/80">{t.flag_note}</p>}
                    <div className="mt-2 flex gap-2">
                      <Link to="/admin/funds" className="rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-bold text-white">Open in Funds</Link>
                      <Btn variant="success" onClick={() => unflag(t)} loading={busy === t.id} className="!px-3 !py-1.5 text-[12px]"><Check size={13} />Clear flag</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {signals.dupes.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-300">Same UTR, different users ({signals.dupes.length})</p>
              <div className="space-y-1.5">
                {signals.dupes.slice(0, 10).map(([ref, list]) => (
                  <div key={ref} className="card border-amber-500/25 p-3">
                    <p className="font-mono text-[13px] font-bold text-amber-200">{ref}</p>
                    {list.map((t) => (
                      <div key={t.id} className="mt-1.5 flex items-center gap-2 text-[12px] text-white/60">
                        <span className="flex-1">txn #{t.id} · {money(t.amount, currency())} · {t.status}</span>
                        <button onClick={() => flag(t, `Duplicate UTR ${ref}`)} className="rounded-lg bg-rose-500/15 px-2.5 py-1 font-bold text-rose-200">Flag</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {signals.rapid.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-300">Deposit bursts — 3+ in 10 min ({signals.rapid.length})</p>
              <div className="space-y-1.5">
                {signals.rapid.slice(0, 10).map((r, i) => (
                  <div key={i} className="card p-3">
                    <p className="font-mono text-[12px] text-white/60">user {r.user.slice(0, 8)}…</p>
                    {r.txns.map((t) => (
                      <div key={t.id} className="mt-1 flex items-center gap-2 text-[12px] text-white/60">
                        <span className="flex-1">#{t.id} · {money(t.amount, currency())} · {timeAgo(t.created_at)}</span>
                        <button onClick={() => flag(t, 'Deposit burst (3+ in 10 min)')} className="rounded-lg bg-rose-500/15 px-2.5 py-1 font-bold text-rose-200">Flag</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {signals.big.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-300">Large pending deposits ({signals.big.length})</p>
              <div className="space-y-1.5">
                {signals.big.slice(0, 10).map((t) => (
                  <div key={t.id} className="card flex items-center gap-2 p-3">
                    <AlertCircle size={16} className="shrink-0 text-amber-300" />
                    <span className="flex-1 text-[13px] text-white/70">#{t.id} · <b className="text-white">{money(t.amount, currency())}</b> · {timeAgo(t.created_at)}</span>
                    <button onClick={() => flag(t, 'Large pending deposit — verify manually')} className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-[12px] font-bold text-rose-200">Flag</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {signals.hammer.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-300">API hammering — 60+/hour ({signals.hammer.length})</p>
              <div className="space-y-1.5">
                {signals.hammer.map(([u, n]) => (
                  <div key={u} className="card flex items-center gap-2 p-3">
                    <X size={16} className="shrink-0 text-rose-300" />
                    <span className="flex-1 font-mono text-[12px] text-white/60">user {u.slice(0, 8)}…</span>
                    <span className="text-[13px] font-bold text-white">{n} calls/hr</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
