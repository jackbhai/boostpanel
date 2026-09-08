import { AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Btn, EmptyState, Field, Input, Modal, PageHead, SearchInput, Select, Textarea, toast } from '../../components/ui'
import { ClipboardList, Pencil, PlatformIcon, Plug, Plus, Power, Trash2 } from '../../components/icons'
import { deleteCategory, deleteService, listProviders, saveCategory, saveService } from '../../lib/db'
import { useStore } from '../../lib/store'
import { money } from '../../lib/utils'

const EMPTY_SVC = {
  id: '', category_id: '', name: '', platform: '', type: '',
  rate: '', min_qty: 100, max_qty: 100000, avg_time: '0-1 hr',
  refill_days: 0, quality: 'High', active: true, description: '',
  provider_id: '', provider_service_id: '', margin_pct: 0, cost_rate: 0,
}

export default function AdminServices() {
  const { categories, services, currency, refreshCatalog } = useStore()
  const [providers, setProviders] = useState([])
  const [tab, setTab] = useState('services')
  const [q, setQ] = useState('')
  const [svcForm, setSvcForm] = useState(null)
  const [catForm, setCatForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [bulk, setBulk] = useState({ provider_id: '', margin: '' })

  useEffect(() => {
    listProviders().then(setProviders).catch(() => {})
  }, [])

  const list = useMemo(() => services.filter((s) =>
    !q || `${s.id} ${s.name} ${s.platform}`.toLowerCase().includes(q.toLowerCase())
  ), [services, q])

  const catName = (id) => categories.find((c) => String(c.id) === String(id))?.name || '—'
  const provName = (id) => providers.find((p) => String(p.id) === String(id))?.name || ''

  /* ---------- services ---------- */

  const openNew = () => setSvcForm({ ...EMPTY_SVC, id: Math.max(100, ...services.map((s) => Number(s.id) || 0)) + 1, category_id: categories[0]?.id || '', platform: categories[0]?.name || '' })
  const openEdit = (s) => setSvcForm({ ...EMPTY_SVC, ...s, provider_id: s.provider_id || '' })

  const saveSvc = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveService({
        ...svcForm,
        id: Number(svcForm.id),
        category_id: Number(svcForm.category_id),
        rate: Number(svcForm.rate),
        margin_pct: Number(svcForm.margin_pct || 0),
        cost_rate: Number(svcForm.cost_rate || 0),
        min_qty: Number(svcForm.min_qty),
        max_qty: Number(svcForm.max_qty),
        refill_days: Number(svcForm.refill_days),
        provider_id: svcForm.provider_id ? Number(svcForm.provider_id) : null,
        provider_service_id: svcForm.provider_id ? String(svcForm.provider_service_id || '') : '',
      })
      toast('Service saved!')
      setSvcForm(null)
      refreshCatalog()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const delSvc = async (id) => {
    if (!window.confirm(`Delete service #${id}?`)) return
    try {
      await deleteService(id)
      toast('Service deleted')
      refreshCatalog()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const toggleSvc = async (s) => {
    try {
      await saveService({ ...s, active: !(s.active !== false) })
      refreshCatalog()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  /* ---------- bulk margin ---------- */

  const applyBulkMargin = async () => {
    const m = Number(bulk.margin)
    if (!bulk.provider_id) return toast('Choose a provider', 'error')
    if (!bulk.margin.toString().trim() || isNaN(m)) return toast('Enter margin %', 'error')
    const targets = services.filter((s) => String(s.provider_id) === String(bulk.provider_id) && Number(s.cost_rate) > 0)
    if (!targets.length) return toast('No mapped services with a stored cost rate', 'error')
    setBusy(true)
    try {
      for (const s of targets) {
        await saveService({ ...s, margin_pct: m, rate: Math.round(Number(s.cost_rate) * (1 + m / 100) * 100) / 100 })
      }
      toast(`Margin ${m}% applied to ${targets.length} services.`)
      refreshCatalog()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  /* ---------- categories ---------- */

  const saveCat = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveCategory({ ...catForm, sort: Number(catForm.sort || 99) })
      toast('Category saved!')
      setCatForm(null)
      refreshCatalog()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const delCat = async (c) => {
    if (!window.confirm(`Delete "${c.name}" and ALL its services?`)) return
    try {
      await deleteCategory(c.id)
      toast('Category deleted')
      refreshCatalog()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div>
      <PageHead
        title="Services"
        sub={`${services.length} services · ${categories.length} categories`}
        right={
          <Btn onClick={() => (tab === 'services' ? openNew() : setCatForm({ name: '', icon: '', sort: 99 }))} className="!px-3.5 !py-2 text-[13px]">
            <Plus size={15} /> {tab === 'services' ? 'Service' : 'Category'}
          </Btn>
        }
      />

      <div className="grid grid-cols-2 gap-2">
        {['services', 'categories'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-3 py-2.5 text-[13px] font-bold capitalize transition ${tab === t ? 'grad-btn text-white' : 'card text-white/55'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'services' && (
        <>
          <div className="mt-3"><SearchInput value={q} onChange={setQ} placeholder="Search services…" /></div>
          <div className="card mt-2 p-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/40">Bulk margin — one provider, all its services</p>
            <div className="flex gap-2">
              <Select value={bulk.provider_id} onChange={(e) => setBulk({ ...bulk, provider_id: e.target.value })}>
                <option value="">Provider…</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <Input type="number" placeholder="Margin %" value={bulk.margin} onChange={(e) => setBulk({ ...bulk, margin: e.target.value })} className="max-w-[130px]" />
              <Btn onClick={applyBulkMargin} loading={busy} className="!px-3.5 text-[13px]">Apply</Btn>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {list.length === 0 && <EmptyState icon={<ClipboardList size={40} />} title="No services" />}
            {list.map((s) => (
              <div key={s.id} className={`card p-3.5 ${s.active === false ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-white">
                    <span className="mr-1 font-mono text-[11px] text-violet-300">#{s.id}</span> {s.name}
                  </p>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => openEdit(s)} className="rounded-lg bg-white/5 p-1.5 text-white/60 hover:bg-white/10"><Pencil size={14} /></button>
                    <button onClick={() => delSvc(s.id)} className="rounded-lg bg-white/5 p-1.5 text-rose-300/70 hover:bg-rose-500/20"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
                  <span>{catName(s.category_id)}</span>
                  <span className="font-bold text-emerald-300">{money(s.rate, currency())}/1k</span>
                  {s.provider_id ? <span className="text-sky-300/80">cost {money(s.cost_rate || 0, currency())} + {s.margin_pct || 0}%</span> : <span className="text-white/30">manual</span>}
                  <span>{Number(s.min_qty).toLocaleString()}–{Number(s.max_qty).toLocaleString()}</span>
                  <Badge status={s.active === false ? 'closed' : 'active'}>{s.active === false ? 'hidden' : 'live'}</Badge>
                  {s.provider_id && <Badge status="processing"><Plug size={10} /> {provName(s.provider_id)}:{s.provider_service_id}</Badge>}
                </div>
                <button onClick={() => toggleSvc(s)} className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-violet-300">
                  <Power size={13} /> {s.active === false ? 'Show to users' : 'Hide from users'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'categories' && (
        <div className="mt-3 space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="card flex items-center gap-3 p-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-violet-300">
                <PlatformIcon platform={c.name} size={24} />
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-bold text-white">{c.name}</span>
                <span className="block text-[11px] text-white/40">
                  {services.filter((s) => String(s.category_id) === String(c.id)).length} services · sort {c.sort}
                </span>
              </span>
              <button onClick={() => setCatForm({ ...c })} className="rounded-lg bg-white/5 p-2 text-white/60 hover:bg-white/10"><Pencil size={15} /></button>
              <button onClick={() => delCat(c)} className="rounded-lg bg-white/5 p-2 text-rose-300/70 hover:bg-rose-500/20"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Service modal */}
      <AnimatePresence>
        {svcForm && (
          <Modal title={services.find((s) => String(s.id) === String(svcForm.id)) ? `Edit #${svcForm.id}` : 'New service'} onClose={() => setSvcForm(null)} wide>
            <form onSubmit={saveSvc} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <Field label="ID"><Input type="number" value={svcForm.id} onChange={(e) => setSvcForm({ ...svcForm, id: e.target.value })} required /></Field>
                <Field label="Category">
                  <Select value={svcForm.category_id} onChange={(e) => {
                    const c = categories.find((x) => String(x.id) === e.target.value)
                    setSvcForm({ ...svcForm, category_id: e.target.value, platform: svcForm.platform || c?.name || '' })
                  }} required>
                    <option value="">— Select —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Name"><Input value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} required /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Platform"><Input value={svcForm.platform} onChange={(e) => setSvcForm({ ...svcForm, platform: e.target.value })} required /></Field>
                <Field label="Type"><Input placeholder="Followers" value={svcForm.type} onChange={(e) => setSvcForm({ ...svcForm, type: e.target.value })} /></Field>
                <Field label="Quality"><Input placeholder="High" value={svcForm.quality} onChange={(e) => setSvcForm({ ...svcForm, quality: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Rate /1k"><Input type="number" step="0.01" value={svcForm.rate} onChange={(e) => setSvcForm({ ...svcForm, rate: e.target.value })} required /></Field>
                <Field label="Min"><Input type="number" value={svcForm.min_qty} onChange={(e) => setSvcForm({ ...svcForm, min_qty: e.target.value })} required /></Field>
                <Field label="Max"><Input type="number" value={svcForm.max_qty} onChange={(e) => setSvcForm({ ...svcForm, max_qty: e.target.value })} required /></Field>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <p className="mb-2 text-[12px] font-bold text-emerald-200">Margin control — your profit on this service</p>
                <div className="grid grid-cols-3 items-end gap-2">
                  <Field label="Cost /1k"><Input type="number" step="0.01" value={svcForm.cost_rate} onChange={(e) => setSvcForm({ ...svcForm, cost_rate: e.target.value })} /></Field>
                  <Field label="Margin %"><Input type="number" step="0.1" value={svcForm.margin_pct} onChange={(e) => setSvcForm({ ...svcForm, margin_pct: e.target.value })} /></Field>
                  <Btn type="button" variant="success" onClick={() => setSvcForm({ ...svcForm, rate: (Math.max(0, Number(svcForm.cost_rate || 0) * (1 + Number(svcForm.margin_pct || 0) / 100) * 100) / 100).toFixed(2) })} className="!px-2 text-[12px]">Apply to rate</Btn>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Avg start time"><Input placeholder="0-1 hr" value={svcForm.avg_time} onChange={(e) => setSvcForm({ ...svcForm, avg_time: e.target.value })} /></Field>
                <Field label="Refill days (0 = none)"><Input type="number" value={svcForm.refill_days} onChange={(e) => setSvcForm({ ...svcForm, refill_days: e.target.value })} /></Field>
              </div>
              <Field label="Description"><Textarea value={svcForm.description} onChange={(e) => setSvcForm({ ...svcForm, description: e.target.value })} /></Field>

              <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-sky-200"><Plug size={13} /> Provider mapping (optional — for auto-forward)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Provider">
                    <Select value={svcForm.provider_id} onChange={(e) => setSvcForm({ ...svcForm, provider_id: e.target.value })}>
                      <option value="">Manual (no auto-forward)</option>
                      {providers.filter((p) => p.status === 'active').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Provider service ID">
                    <Input placeholder="e.g. 1234" value={svcForm.provider_service_id} onChange={(e) => setSvcForm({ ...svcForm, provider_service_id: e.target.value })} disabled={!svcForm.provider_id} />
                  </Field>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={svcForm.active !== false} onChange={(e) => setSvcForm({ ...svcForm, active: e.target.checked })} className="h-4 w-4 accent-violet-500" />
                Visible to users
              </label>
              <Btn type="submit" loading={busy} className="w-full">Save Service</Btn>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Category modal */}
      <AnimatePresence>
        {catForm && (
          <Modal title={catForm.id ? 'Edit category' : 'New category'} onClose={() => setCatForm(null)}>
            <form onSubmit={saveCat} className="space-y-3.5">
              <Field label="Name"><Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required /></Field>
              <Field label="Sort order"><Input type="number" value={catForm.sort} onChange={(e) => setCatForm({ ...catForm, sort: e.target.value })} /></Field>
              <Btn type="submit" loading={busy} className="w-full">Save Category</Btn>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
