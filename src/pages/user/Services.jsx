import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, EmptyState, PageHead, SearchInput, toast, Select } from '../../components/ui'
import { PlatformIcon, RefreshCcw, Search, Star, Bell, MessageCircle, X, Plus, ChevronRight } from '../../components/icons'
import { getFavorites, toggleFavorite, addAlert, deleteAlert, listApprovedReviews, myAlerts, reviewAggregate } from '../../lib/db'
import { PLATFORM_COLOR } from '../../data/catalog'
import { useStore } from '../../lib/store'
import { money } from '../../lib/utils'

export default function Services() {
  const { user, categories, services, currency } = useStore()
  const savedF = useMemo(() => { try { return JSON.parse(localStorage.getItem('bp_svc_filters') || '{}') } catch { return {} } }, [])
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [favSet, setFavSet] = useState(new Set())
  const [ratings, setRatings] = useState({})
  const [reviewsFor, setReviewsFor] = useState(null)
  const [reviews, setReviews] = useState([])
  const [alerts, setAlerts] = useState([])
  const [alertFor, setAlertFor] = useState(null)
  const [alertPrice, setAlertPrice] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [priceMin, setPriceMin] = useState(savedF.priceMin || '')
  const [priceMax, setPriceMax] = useState(savedF.priceMax || '')
  const [needQty, setNeedQty] = useState(savedF.needQty || '')
  const [minRating, setMinRating] = useState(savedF.minRating || '0')
  const [platform, setPlatform] = useState(savedF.platform || 'all')
  const [stype, setStype] = useState(savedF.stype || 'all')
  const [onlyRefill, setOnlyRefill] = useState(!!savedF.onlyRefill)
  const [onlyReviewed, setOnlyReviewed] = useState(!!savedF.onlyReviewed)
  const [onlyDrip, setOnlyDrip] = useState(!!savedF.onlyDrip)
  const [sortBy, setSortBy] = useState(savedF.sortBy || 'default')
  const [compare, setCompare] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (user) getFavorites(user.id).then((f) => setFavSet(new Set(f))).catch(() => {})
    reviewAggregate().then((r) => {
      const m = {}
      for (const x of r || []) {
        if (!m[x.service_id]) m[x.service_id] = { s: 0, n: 0 }
        m[x.service_id].s += Number(x.rating); m[x.service_id].n++
      }
      setRatings(m)
    }).catch(() => {})
    if (user) myAlerts(user.id).then(setAlerts).catch(() => {})
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

  const platforms = useMemo(() => [...new Set((services || []).map((s) => s.platform).filter(Boolean))].sort(), [services])
  const stypes = useMemo(() => [...new Set((services || []).map((s) => s.type).filter(Boolean))].sort(), [services])
  const activeCount = [priceMin !== '', priceMax !== '', needQty !== '', minRating !== '0', platform !== 'all', stype !== 'all', onlyRefill, onlyReviewed, onlyDrip, sortBy !== 'default'].filter(Boolean).length
  const clearFilters = () => {
    setPriceMin(''); setPriceMax(''); setNeedQty(''); setMinRating('0')
    setPlatform('all'); setStype('all')
    setOnlyRefill(false); setOnlyReviewed(false); setOnlyDrip(false); setSortBy('default')
  }
  useEffect(() => {
    try {
      localStorage.setItem('bp_svc_filters', JSON.stringify({ priceMin, priceMax, needQty, minRating, platform, stype, onlyRefill, onlyReviewed, onlyDrip, sortBy }))
    } catch { /* ignore */ }
  }, [priceMin, priceMax, needQty, minRating, platform, stype, onlyRefill, onlyReviewed, onlyDrip, sortBy])
  const toggleCompare = (id) => setCompare((p) => {
    if (p.includes(id)) return p.filter((x) => x !== id)
    if (p.length >= 3) { toast('Compare up to 3 services', 'error'); return p }
    return [...p, id]
  })

  const openReviews = async (s) => {
    if (reviewsFor === s.id) { setReviewsFor(null); return }
    setReviewsFor(s.id)
    try { setReviews(await listApprovedReviews(s.id)) } catch { setReviews([]) }
  }

  const saveAlert = async (s) => {
    if (!(Number(alertPrice) > 0)) return toast('Enter a target price', 'error')
    try {
      await addAlert(user.id, s.id, 'price_below', Number(alertPrice))
      setAlerts(await myAlerts(user.id))
      setAlertFor(null); setAlertPrice('')
      toast('Price alert set! We will notify you on a drop.')
    } catch (err) { toast(err.message, 'error') }
  }

  const removeAlert = async (id) => {
    try { await deleteAlert(id); setAlerts(alerts.filter((a) => a.id !== id)); toast('Alert removed') }
    catch (err) { toast(err.message, 'error') }
  }

  const list = useMemo(() => {
    const nq = Number(needQty) || 0
    const pmin = priceMin === '' ? -Infinity : Number(priceMin)
    const pmax = priceMax === '' ? Infinity : Number(priceMax)
    const out = services.filter((s) => {
      if (s.active === false) return false
      if (cat === 'fav' && !favSet.has(s.id)) return false
      if (cat !== 'all' && cat !== 'fav' && String(s.category_id) !== String(cat)) return false
      if (q && !`${s.id} ${s.name} ${s.platform} ${s.type}`.toLowerCase().includes(q.toLowerCase())) return false
      const rate = Number(s.rate) || 0
      if (rate < pmin || rate > pmax) return false
      if (nq > 0 && (Number(s.min_qty) > nq || Number(s.max_qty) < nq)) return false
      if (platform !== 'all' && (s.platform || '') !== platform) return false
      if (stype !== 'all' && (s.type || '') !== stype) return false
      if (onlyRefill && !(Number(s.refill_days) > 0)) return false
      if (onlyDrip && !s.provider_id) return false
      const r = ratings[s.id]
      const avg = r ? r.s / r.n : 0
      if (onlyReviewed && !r) return false
      if (Number(minRating) > 0 && avg < Number(minRating)) return false
      return true
    })
    const avgOf = (s) => { const r = ratings[s.id]; return r ? r.s / r.n : 0 }
    const valOf = (s) => ((avgOf(s) || 3) * 1000) / Math.max(0.01, Number(s.rate) || 1)
    if (sortBy === 'price_asc') out.sort((a, b) => Number(a.rate) - Number(b.rate))
    else if (sortBy === 'price_desc') out.sort((a, b) => Number(b.rate) - Number(a.rate))
    else if (sortBy === 'rating') out.sort((a, b) => avgOf(b) - avgOf(a) || (ratings[b.id]?.n || 0) - (ratings[a.id]?.n || 0))
    else if (sortBy === 'min_asc') out.sort((a, b) => Number(a.min_qty) - Number(b.min_qty))
    else if (sortBy === 'value') out.sort((a, b) => valOf(b) - valOf(a))
    return out
  }, [services, cat, q, favSet, ratings, priceMin, priceMax, needQty, minRating, platform, stype, onlyRefill, onlyReviewed, onlyDrip, sortBy])

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
      {compare.length > 0 && !showCompare && (
        <div className="fixed bottom-20 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <button onClick={() => setShowCompare(true)} className="grad-btn flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-bold text-white shadow-xl shadow-violet-600/30">
            Compare {compare.length} service{compare.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
      {showCompare && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center" onClick={() => setShowCompare(false)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#0a0a10] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-extrabold text-white">Side-by-side compare</p>
              <button onClick={() => setShowCompare(false)} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10"><X size={18} /></button>
            </div>
            <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${compare.length}, minmax(0, 1fr))` }}>
              {compare.map((id) => {
                const s = services.find((x) => x.id === id)
                if (!s) return null
                const r = ratings[s.id]
                return (
                  <div key={id} className="min-w-0 rounded-xl border border-white/10 bg-white/10 p-2.5">
                    <p className="truncate text-[12px] font-bold text-white" title={s.name}>{s.name}</p>
                    <p className="mt-1 text-[15px] font-extrabold text-emerald-300">{money(s.rate, currency())}<span className="text-[10px] font-normal text-white/40">/1k</span></p>
                    <div className="mt-1.5 space-y-1 text-[11px] text-white/60">
                      <p>Min <b className="text-white/85">{Number(s.min_qty).toLocaleString()}</b></p>
                      <p>Max <b className="text-white/85">{Number(s.max_qty).toLocaleString()}</b></p>
                      <p>Refill <b className="text-white/85">{Number(s.refill_days) > 0 ? `${s.refill_days}d` : 'No'}</b></p>
                      <p>Rating <b className="text-amber-300">{r ? `${(r.s / r.n).toFixed(1)} (${r.n})` : '—'}</b></p>
                      <p>Drip <b className="text-white/85">{s.provider_id ? 'Yes' : 'Manual'}</b></p>
                      {s.avg_time && <p>Speed <b className="text-white/85">{s.avg_time}</b></p>}
                    </div>
                    <button onClick={() => { setShowCompare(false); navigate('/order') }} className="grad-btn mt-2 w-full rounded-lg py-1.5 text-[12px] font-bold text-white">Order</button>
                    <button onClick={() => toggleCompare(id)} className="mt-1 w-full text-[11px] font-bold text-white/40">Remove</button>
                  </div>
                )
              })}
            </div>
            <button onClick={() => { setCompare([]); setShowCompare(false) }} className="mt-3 w-full text-center text-[12.5px] font-bold text-rose-300">Clear compare</button>
          </div>
        </div>
      )}
      <PageHead title="Services" sub={`${services.filter((s) => s.active !== false).length} active services`} />

      <SearchInput value={q} onChange={setQ} placeholder="Search services… (id, name, platform)" />

      <button onClick={() => setShowFilters(!showFilters)} className="mt-2.5 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-[13.5px] font-bold text-white/75">
        Deep filters
        {activeCount > 0 && <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[11px] font-bold text-white">{activeCount}</span>}
        <span className="ml-auto text-[12px] font-semibold text-white/40">{list.length} match{list.length !== 1 ? 'es' : ''}</span>
        <ChevronRight size={16} className={`text-white/40 transition-transform ${showFilters ? 'rotate-90' : ''}`} />
      </button>
      {showFilters && (
        <div className="card mt-2 space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-white/50">Min price /1k</span>
              <input type="number" min="0" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="0" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white outline-none" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-white/50">Max price /1k</span>
              <input type="number" min="0" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Any" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white outline-none" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-white/50">I need qty</span>
              <input type="number" min="0" value={needQty} onChange={(e) => setNeedQty(e.target.value)} placeholder="5000" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white outline-none" /></label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-white/50">Platform</span>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="all">All ({services.filter((s) => s.active !== false).length})</option>
                {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-white/50">Type</span>
              <Select value={stype} onChange={(e) => setStype(e.target.value)}>
                <option value="all">All</option>
                {stypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-white/50">Min rating</span>
              <Select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                <option value="0">Any</option>
                <option value="3">3+ stars</option>
                <option value="4">4+ stars</option>
                <option value="4.5">4.5+ stars</option>
              </Select></label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[[onlyRefill, setOnlyRefill, 'Refill included'], [onlyReviewed, setOnlyReviewed, 'Has reviews'], [onlyDrip, setOnlyDrip, 'Drip-feed ready']].map(([v, set, label]) => (
              <button key={label} onClick={() => set(!v)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${v ? 'grad-btn text-white' : 'border border-white/10 bg-white/10 text-white/55'}`}>
                {label}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-bold text-white/50">Sort by</p>
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {[['default', 'Default'], ['value', 'Best value'], ['price_asc', 'Price: low'], ['price_desc', 'Price: high'], ['rating', 'Top rated'], ['min_asc', 'Smallest min']].map(([id, label]) => (
                <button key={id} onClick={() => setSortBy(id)} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${sortBy === id ? 'grad-btn text-white' : 'border border-white/10 bg-white/10 text-white/55'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {activeCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-[12.5px] font-bold text-rose-300">
              <X size={13} /> Clear all filters ({activeCount})
            </button>
          )}
        </div>
      )}

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
                    {ratings[s.id] && <span className="flex items-center gap-0.5 font-bold text-amber-300"><Star size={10} fill="currentColor" /> {(ratings[s.id].s / ratings[s.id].n).toFixed(1)} ({ratings[s.id].n})</span>}
                  </div>
                  <div className="mt-2 flex gap-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openReviews(s)} className="flex items-center gap-1 text-[12px] font-bold text-sky-300"><MessageCircle size={12} />Reviews{ratings[s.id] ? ` (${ratings[s.id].n})` : ''}</button>
                    {(() => {
                      const ex = alerts.find((a) => a.service_id === s.id && a.active !== false)
                      return ex
                        ? <button onClick={() => removeAlert(ex.id)} className="flex items-center gap-1 text-[12px] font-bold text-emerald-300"><Bell size={12} />Alert on — tap to off</button>
                        : <button onClick={() => setAlertFor(s.id)} className="flex items-center gap-1 text-[12px] font-bold text-violet-300"><Bell size={12} />Price alert</button>
                    })()}
                    <button onClick={() => toggleCompare(s.id)} className={`flex items-center gap-1 text-[12px] font-bold ${compare.includes(s.id) ? 'text-emerald-300' : 'text-white/45'}`}>
                      <Plus size={12} />{compare.includes(s.id) ? 'Added' : 'Compare'}
                    </button>
                  </div>
                  {reviewsFor === s.id && (
                    <div className="mt-2 space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-3" onClick={(e) => e.stopPropagation()}>
                      {reviews.length === 0 ? <p className="text-[12px] text-white/40">No reviews yet — be the first after your order completes.</p> : reviews.map((r, i) => (
                        <div key={i} className="border-b border-white/10 pb-1.5 last:border-0">
                          <span className="text-[13px] text-amber-300">{'★'.repeat(Number(r.rating))}<span className="text-white/20">{'★'.repeat(5 - Number(r.rating))}</span></span>
                          {r.text && <p className="text-[12.5px] text-white/65">“{r.text}”</p>}
                          <p className="text-[10.5px] text-white/30">{(r.profiles?.email || 'verified buyer').split('@')[0]} · verified order</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {alertFor === s.id && (
                    <div className="mt-2 flex gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 p-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="number" min="0" step="0.01" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} placeholder={`Notify below ${s.rate}/1k`} className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[13px] text-white outline-none" />
                      <button onClick={() => saveAlert(s)} className="grad-btn shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold text-white">Set</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
