import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, EmptyState, PageHead, SearchInput, toast } from '../../components/ui'
import { PlatformIcon, RefreshCcw, Search, Star } from '../../components/icons'
import { getFavorites, toggleFavorite } from '../../lib/db'
import { PLATFORM_COLOR } from '../../data/catalog'
import { useStore } from '../../lib/store'
import { money } from '../../lib/utils'

export default function Services() {
  const { user, categories, services, currency } = useStore()
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [favSet, setFavSet] = useState(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    if (user) getFavorites(user.id).then((f) => setFavSet(new Set(f))).catch(() => {})
  }, [user])

  const flipFav = async (id) => {
    const on = !favSet.has(id)
    setFavSet((p) => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n })
    try {
      await toggleFavorite(user.id, id, on)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const list = useMemo(() => {
    return services.filter((s) => {
      if (s.active === false) return false
      if (cat === 'fav' && !favSet.has(s.id)) return false
      if (cat !== 'all' && cat !== 'fav' && String(s.category_id) !== String(cat)) return false
      if (q && !`${s.id} ${s.name} ${s.platform} ${s.type}`.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [services, cat, q])

  const catName = (id) => categories.find((c) => String(c.id) === String(id))?.name || ''

  const grouped = useMemo(() => {
    const g = {}
    list.forEach((s) => {
      const k = catName(s.category_id) || s.platform
      if (!g[k]) g[k] = []
      g[k].push(s)
    })
    return Object.entries(g)
  }, [list])

  return (
    <div>
      <PageHead title="Services" sub={`${services.filter((s) => s.active !== false).length} active services`} />

      <SearchInput value={q} onChange={setQ} placeholder="Search services… (id, name, platform)" />

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setCat('all')}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
            cat === 'all' ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/60'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setCat('fav')}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
            cat === 'fav' ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/60'
          }`}
        >
          <Star size={14} /> Starred
        </button>
        {categories.filter((c) => c.active !== false).map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(String(c.id))}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
              String(cat) === String(c.id) ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/60'
            }`}
          >
            <PlatformIcon platform={c.name} size={15} /> {c.name}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-5">
        {grouped.length === 0 && (
          <EmptyState icon={<Search size={40} />} title="No services found" hint="Try a different search or category." />
        )}
        {grouped.map(([name, svcs]) => (
          <div key={name}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`h-5 w-1 rounded-full bg-gradient-to-b ${PLATFORM_COLOR[name] || 'from-violet-500 to-fuchsia-500'}`} />
              <PlatformIcon platform={name} size={16} className="text-white/70" />
              <p className="text-sm font-bold text-white">{name}</p>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/45">{svcs.length}</span>
            </div>
            <div className="space-y-2">
              {svcs.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate('/order')}
                  className="card card-hover block w-full cursor-pointer p-3.5 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-[13px] font-semibold leading-snug text-white">
                      <span className="mr-1.5 font-mono text-[11px] text-violet-300">#{s.id}</span>
                      {s.name}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); flipFav(s.id) }}
                      aria-label="Star service"
                      className={`shrink-0 rounded-lg p-1.5 ${favSet.has(s.id) ? 'text-amber-300' : 'text-white/25 hover:text-amber-200'}`}
                    >
                      <Star size={17} fill={favSet.has(s.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
                    <span className="font-bold text-emerald-300">{money(s.rate, currency())}<span className="font-normal text-white/40"> /1k</span></span>
                    <span>Min {Number(s.min_qty).toLocaleString()}</span>
                    <span>Max {Number(s.max_qty).toLocaleString()}</span>
                    <span>{s.avg_time || '—'}</span>
                    {s.refill_days > 0 && <Badge status="active"><RefreshCcw size={10} /> {s.refill_days}d refill</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
