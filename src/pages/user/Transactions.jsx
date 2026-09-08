import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, EmptyState, PageHead, Skeleton, toast } from '../../components/ui'
import { ArrowDownLeft, ArrowUpRight, Receipt } from '../../components/icons'
import { getUserTxns } from '../../lib/db'
import { useStore } from '../../lib/store'
import { money, timeAgo } from '../../lib/utils'

export default function Transactions() {
  const { user, currency } = useStore()
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getUserTxns(user.id).then(setTxns).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false))
  }, [])

  const list = useMemo(() => txns.filter((t) => filter === 'all' || t.type === filter), [txns, filter])
  const inflow = txns.filter((t) => t.type === 'credit' && t.status === 'approved').reduce((s, t) => s + Number(t.amount), 0)
  const outflow = txns.filter((t) => t.type === 'debit' && t.status === 'approved').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div>
      <PageHead title="Transactions" sub="Every rupee, tracked." right={
        <Link to="/funds" className="grad-btn rounded-xl px-3.5 py-2 text-[13px] font-bold text-white">+ Add Funds</Link>
      } />

      <div className="grid grid-cols-2 gap-2.5">
        <div className="card border-emerald-500/20 p-3.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/45">
            <ArrowDownLeft size={12} className="text-emerald-300" /> Added
          </p>
          <p className="mt-1 text-lg font-extrabold text-emerald-300">+{money(inflow, currency())}</p>
        </div>
        <div className="card border-rose-500/20 p-3.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/45">
            <ArrowUpRight size={12} className="text-rose-300" /> Spent
          </p>
          <p className="mt-1 text-lg font-extrabold text-rose-300">−{money(outflow, currency())}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {[
          { id: 'all', label: 'All', icon: null },
          { id: 'credit', label: 'Credits', icon: ArrowDownLeft },
          { id: 'debit', label: 'Debits', icon: ArrowUpRight },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold capitalize transition ${
              filter === f.id ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/55'
            }`}
          >
            {f.icon && <f.icon size={14} />} {f.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2.5">
        {loading && <Skeleton lines={4} />}
        {!loading && list.length === 0 && (
          <EmptyState icon={<Receipt size={40} />} title="No transactions" hint="Top-ups and order charges will appear here." />
        )}
        {list.map((t) => {
          const credit = t.type === 'credit'
          return (
            <div key={t.id} className="card flex items-center gap-3 p-3.5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${credit ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                {credit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">
                  {t.note || (credit ? 'Balance top-up' : 'Order payment')}
                </p>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {t.method}{t.txn_ref ? ` · ${t.txn_ref}` : ''} · {timeAgo(t.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-[15px] font-extrabold ${credit ? 'text-emerald-300' : 'text-white'}`}>
                  {credit ? '+' : '−'}{money(t.amount, currency())}
                </p>
                <div className="mt-1"><Badge status={t.status} /></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
