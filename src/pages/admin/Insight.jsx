import { useEffect, useMemo, useState } from 'react'
import { Badge, Btn, EmptyState, PageHead, Select, toast } from '../../components/ui'
import { Plug, RefreshCw, TrendingUp, Wallet, X } from '../../components/icons'
import { apiLogsAdmin, balanceLogs, listProviders } from '../../lib/db'
import { downloadCSV } from '../../lib/csv'
import { money, timeAgo } from '../../lib/utils'
import { useStore } from '../../lib/store'

export default function AdminInsight() {
  const { currency } = useStore()
  const [logs, setLogs] = useState([])
  const [providers, setProviders] = useState([])
  const [provId, setProvId] = useState('')
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('all')

  const load = async (silent) => {
    if (!silent) setLoading(true)
    try {
      const [l, p] = await Promise.all([apiLogsAdmin(500).catch(() => []), listProviders().catch(() => [])])
      setLogs(l || []); setProviders(p || [])
      if (!provId && p?.length) setProvId(String(p[0].id))
    } catch { if (!silent) toast('Load failed', 'error') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!provId) return
    balanceLogs(Number(provId)).then(setBalances).catch(() => setBalances([]))
  }, [provId])

  const stats = useMemo(() => {
    const now = Date.now()
    const d = (n) => logs.filter((l) => now - new Date(l.created_at).getTime() < n * 86400000)
    const ok = logs.filter((l) => l.ok !== false).length
    const byAction = {}
    for (const l of logs) byAction[l.action] = (byAction[l.action] || 0) + 1
    const byUser = {}
    for (const l of logs) { if (l.user_id) byUser[l.user_id] = (byUser[l.user_id] || 0) + 1 }
    const errors = logs.filter((l) => l.ok === false)
    return {
      total: logs.length, d1: d(1).length, d7: d(7).length,
      rate: logs.length ? Math.round((ok / logs.length) * 100) : 100,
      byAction: Object.entries(byAction).sort((a, b) => b[1] - a[1]),
      topUsers: Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 8),
      errors: errors.slice(0, 20),
    }
  }, [logs])

  const rows = actionFilter === 'all' ? logs.slice(0, 120) : logs.filter((l) => l.action === actionFilter).slice(0, 120)
  const maxBal = Math.max(1, ...balances.map((b) => Number(b.balance)))
  const prov = providers.find((p) => String(p.id) === String(provId))

  return (
    <div>
      <PageHead title="API Insight" sub="Reseller API usage, errors + provider balance history." />
      <div className="mb-2 flex gap-2">
        <Btn variant="ghost" onClick={() => load()} className="!px-3 !py-1.5 text-[12px]"><RefreshCw size={13} />Refresh</Btn>
        <Btn variant="ghost" onClick={() => downloadCSV('api-logs.csv', logs)} className="!px-3 !py-1.5 text-[12px]">Export CSV</Btn>
      </div>

      {loading ? <p className="py-6 text-center text-[13px] text-white/40">Loading…</p> : (
        <div>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {[
              ['24h calls', stats.d1, 'text-white'],
              ['7d calls', stats.d7, 'text-white'],
              ['Success', `${stats.rate}%`, stats.rate >= 95 ? 'text-emerald-300' : 'text-amber-300'],
              ['Errors', stats.errors.length, stats.errors.length ? 'text-rose-300' : 'text-white/40'],
            ].map(([l, v, c]) => (
              <div key={l} className="card p-2.5 text-center">
                <p className={`text-lg font-extrabold ${c}`}>{v}</p>
                <p className="text-[10.5px] text-white/45">{l}</p>
              </div>
            ))}
          </div>

          <div className="card mb-3 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-white"><Plug size={14} className="text-sky-300" /> Calls by action</p>
            {stats.byAction.length === 0 ? <p className="text-[12px] text-white/40">No API calls logged yet.</p> : (
              <div className="space-y-1.5">
                {stats.byAction.map(([a, n]) => (
                  <div key={a} className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-20 shrink-0 font-mono font-bold text-violet-200">{a}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${Math.max(3, (n / stats.total) * 100)}%` }} />
                    </div>
                    <span className="w-10 text-right font-bold text-white/60">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card mb-3 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-white"><Wallet size={14} className="text-emerald-300" /> Provider balance history</p>
            <Select value={provId} onChange={(e) => setProvId(e.target.value)} className="mb-2">
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            {prov && (
              <p className="mb-2 text-[12px] text-white/50">
                Now: <b className="text-emerald-300">{money(prov.balance || 0, prov.currency ? `${prov.currency} ` : currency())}</b>
                {prov.last_latency_ms != null && <span> · latency {prov.last_latency_ms} ms</span>}
                {prov.last_sync && <span> · synced {timeAgo(prov.last_sync)}</span>}
              </p>
            )}
            {balances.length === 0 ? <p className="text-[12px] text-white/40">No snapshots yet — press “Check balance” on Providers.</p> : (
              <div className="flex h-24 items-end gap-1">
                {[...balances].reverse().slice(-30).map((b, i) => (
                  <div key={i} title={`${b.balance} · ${timeAgo(b.created_at)}`} className="min-w-0 flex-1 rounded-t bg-emerald-500/50" style={{ height: `${Math.max(6, (Number(b.balance) / maxBal) * 100)}%` }} />
                ))}
              </div>
            )}
          </div>

          {stats.topUsers.length > 0 && (
            <div className="card mb-3 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-white"><TrendingUp size={14} className="text-amber-300" /> Top API users</p>
              {stats.topUsers.map(([u, n]) => (
                <div key={u} className="flex items-center justify-between border-b border-white/5 py-1.5 text-[12.5px] last:border-0">
                  <span className="font-mono text-white/60">{u.slice(0, 8)}…</span>
                  <span className="font-bold text-white">{n} calls</span>
                </div>
              ))}
            </div>
          )}

          {stats.errors.length > 0 && (
            <div className="card mb-3 border-rose-500/25 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-rose-200"><X size={14} /> Recent failed calls ({stats.errors.length})</p>
              {stats.errors.map((l) => (
                <div key={l.id} className="flex items-center gap-2 border-b border-white/5 py-1.5 text-[12px] last:border-0">
                  <Badge status="closed">{l.action}</Badge>
                  <span className="flex-1 truncate font-mono text-white/50">{l.user_id ? l.user_id.slice(0, 8) + '…' : 'bad key'}</span>
                  <span className="text-white/35">{timeAgo(l.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mb-2 flex items-center gap-2">
            <p className="flex-1 text-xs font-bold uppercase tracking-wide text-white/45">Recent calls</p>
            <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="!w-auto !py-1.5 text-[12px]">
              <option value="all">All actions</option>
              {[...new Set(logs.map((l) => l.action))].map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </div>
          {rows.length === 0 ? <EmptyState icon={<Plug size={36} />} title="No calls yet" hint="Reseller API usage will be logged here." /> : (
            <div className="space-y-1.5">
              {rows.slice(0, 40).map((l) => (
                <div key={l.id} className="card flex items-center gap-2 p-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${l.ok !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className="font-mono text-[12px] font-bold text-violet-200">{l.action}</span>
                  <span className="flex-1 truncate font-mono text-[11px] text-white/40">{l.user_id ? l.user_id.slice(0, 8) + '…' : '—'}</span>
                  {l.ms != null && <span className="text-[11px] text-white/35">{l.ms} ms</span>}
                  <span className="text-[11px] text-white/35">{timeAgo(l.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
