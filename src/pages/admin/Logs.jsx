import { useEffect, useMemo, useState } from 'react'
import { getAdminLogs } from '../../lib/db'
import { downloadCSV } from '../../lib/csv'
import { Btn, EmptyState, PageHead, SearchInput, Skeleton, toast } from '../../components/ui'
import { Download, Receipt } from '../../components/icons'

export default function AdminLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    getAdminLogs(300)
      .then((r) => setLogs(r || []))
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return logs
    return logs.filter((l) =>
      (l.action || '').toLowerCase().includes(s) || (l.actor_email || '').toLowerCase().includes(s) ||
      (l.target || '').toLowerCase().includes(s) || JSON.stringify(l.meta || {}).toLowerCase().includes(s))
  }, [logs, q])

  if (loading) return <Skeleton lines={5} />
  return (
    <div>
      <PageHead
        title="Activity Logs"
        sub="Every admin action is recorded here. Logs are append-only — nobody can edit or delete them."
      />
      <div className="mb-4 flex gap-2">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search action, admin, target…" /></div>
        <Btn variant="ghost" onClick={() => downloadCSV('admin-logs.csv', rows.map((l) => ({ id: l.id, time: l.created_at, admin: l.actor_email, action: l.action, target: l.target, meta: JSON.stringify(l.meta || {}) })))} className="!px-3 !py-1.5 text-[12px]"><Download size={14} />CSV</Btn>
      </div>
      {rows.length === 0 ? <EmptyState icon={<Receipt size={36} />} title="No activity yet" hint="Admin actions will appear here." /> : (
        <div className="space-y-2">
          {rows.map((l) => (
            <div key={l.id} className="card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Receipt size={15} className="text-violet-300" />
                <span className="rounded bg-violet-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-violet-200">{l.action}</span>
                {l.target && <span className="text-xs font-bold text-white/80">{l.target}</span>}
              </div>
              <p className="mt-1 text-[11px] text-white/40">
                {l.actor_email || 'system'} · {new Date(l.created_at).toLocaleString()}
                {l.meta && Object.keys(l.meta).length > 0 && <span className="font-mono"> · {JSON.stringify(l.meta)}</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
