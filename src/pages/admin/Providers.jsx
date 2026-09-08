import { AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Btn, EmptyState, Field, Input, Modal, PageHead, SearchInput, Select, Skeleton, toast } from '../../components/ui'
import { Download, LinkIcon, Pencil, Plug, Plus, Power, Trash2, Wallet, Wifi } from '../../components/icons'
import { deleteProvider, fetchProviderServices, importProviderServices, listProviders, saveProvider, testProvider } from '../../lib/db'
import { useStore } from '../../lib/store'
import { money, timeAgo } from '../../lib/utils'

export default function AdminProviders() {
  const { categories, services, currency, refreshCatalog } = useStore()
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(null)
  const [imp, setImp] = useState(null) // { provider, list, checked:Set, q, markup, categoryId, loading }

  const load = () => {
    setLoading(true)
    listProviders().then(setProviders).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const mappedCount = (pid) => services.filter((s) => String(s.provider_id) === String(pid)).length

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveProvider(form)
      toast('Provider saved!')
      setForm(null)
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const del = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? Mapped services will become manual (kept).`)) return
    try {
      await deleteProvider(p.id)
      toast('Provider deleted')
      refreshCatalog()
      load()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const toggle = async (p) => {
    try {
      await saveProvider({ ...p, status: p.status === 'active' ? 'disabled' : 'active' })
      load()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const test = async (p) => {
    setTesting(p.id)
    try {
      const res = await testProvider(p.id)
      toast(`Connected! Balance: ${res.balance} ${res.currency || ''}`)
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setTesting(null)
    }
  }

  /* ---------- import flow ---------- */

  const openImport = async (p) => {
    setImp({ provider: p, list: [], checked: new Set(), q: '', markup: 30, categoryId: categories[0]?.id || '', loading: true })
    try {
      const list = await fetchProviderServices(p.id)
      setImp((v) => ({ ...v, list, loading: false }))
      if (!list.length) toast('Provider returned 0 services', 'error')
    } catch (err) {
      setImp(null)
      toast(err.message, 'error')
    }
  }

  const impVisible = useMemo(() => {
    if (!imp) return []
    return imp.list.filter((s) => !imp.q || `${s.service} ${s.name} ${s.category}`.toLowerCase().includes(imp.q.toLowerCase()))
  }, [imp])

  const toggleCheck = (id) => {
    setImp((v) => {
      const c = new Set(v.checked)
      if (c.has(id)) c.delete(id)
      else c.add(id)
      return { ...v, checked: c }
    })
  }

  const doImport = async () => {
    const items = imp.list.filter((s) => imp.checked.has(String(s.service)))
    if (!imp.categoryId) return toast('Choose a target category', 'error')
    setBusy(true)
    try {
      const cat = categories.find((c) => String(c.id) === String(imp.categoryId))
      const n = await importProviderServices(imp.provider, items, imp.markup, imp.categoryId, cat?.name || '')
      toast(`Imported ${n} services with ${imp.markup}% margin!`)
      setImp(null)
      refreshCatalog()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHead
        title="API Providers"
        sub="Connect source APIs — orders auto-forward."
        right={<Btn onClick={() => setForm({ name: '', api_url: '', api_key: '', status: 'active' })} className="!px-3.5 !py-2 text-[13px]"><Plus size={15} /> Add</Btn>}
      />

      <div className="card flex items-start gap-2 border-sky-500/25 bg-sky-500/5 p-3.5 text-[12px] leading-relaxed text-white/60">
        <Plug size={16} className="mt-0.5 shrink-0 text-sky-300" />
        <p><b className="text-white/85">How it works:</b> add your provider's API URL + key →
        Test → Import services with your margin → user orders forward <b className="text-white/85">automatically</b>,
        status syncs back. Standard Perfect Panel API (action=add/status/services…).</p>
      </div>

      <div className="mt-3 space-y-2.5">
        {loading && <Skeleton lines={2} />}
        {!loading && providers.length === 0 && (
          <EmptyState icon={<Plug size={40} />} title="No providers yet" hint="Add your first source API to automate fulfillment." action={<Btn onClick={() => setForm({ name: '', api_url: '', api_key: '', status: 'active' })}>Add Provider</Btn>} />
        )}
        {providers.map((p) => (
          <div key={p.id} className={`card p-3.5 ${p.status !== 'active' ? 'opacity-55' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-bold text-white">{p.name}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-white/40">{p.api_url}</p>
              </div>
              <Badge status={p.status === 'active' ? 'active' : 'closed'}>{p.status}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/50">
              <span className="flex items-center gap-1"><Wallet size={13} /> {money(p.balance, p.currency ? `${p.currency} ` : currency())}</span>
              <span className="flex items-center gap-1"><LinkIcon size={13} /> {mappedCount(p.id)} mapped</span>
              {p.last_sync && <span>synced {timeAgo(p.last_sync)}</span>}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              <button onClick={() => test(p)} disabled={testing === p.id} className="flex items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2 text-[12px] font-bold text-emerald-300 disabled:opacity-50">
                <Wifi size={13} /> {testing === p.id ? '…' : 'Test'}
              </button>
              <button onClick={() => openImport(p)} className="flex items-center justify-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 py-2 text-[12px] font-bold text-sky-300">
                <Download size={13} /> Import
              </button>
              <button onClick={() => setForm({ ...p })} className="flex items-center justify-center gap-1 rounded-lg bg-white/5 py-2 text-[12px] font-bold text-white/70">
                <Pencil size={13} /> Edit
              </button>
              <button onClick={() => del(p)} className="flex items-center justify-center gap-1 rounded-lg bg-white/5 py-2 text-[12px] font-bold text-rose-300/80">
                <Trash2 size={13} />
              </button>
            </div>
            <button onClick={() => toggle(p)} className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-violet-300">
              <Power size={13} /> {p.status === 'active' ? 'Disable auto-forward' : 'Enable auto-forward'}
            </button>
          </div>
        ))}
      </div>

      {/* Add/Edit modal */}
      <AnimatePresence>
        {form && (
          <Modal title={form.id ? 'Edit provider' : 'Add provider'} onClose={() => setForm(null)}>
            <form onSubmit={save} className="space-y-3.5">
              <Field label="Name"><Input placeholder="e.g. MainSource" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
              <Field label="API URL" hint="Usually ends with /api/v2">
                <Input placeholder="https://provider.com/api/v2" value={form.api_url} onChange={(e) => setForm({ ...form, api_url: e.target.value })} required />
              </Field>
              <Field label="API key" hint="Stored securely — only admins can see this page.">
                <Input type="password" placeholder="Paste provider API key" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} required={!form.id} />
              </Field>
              <Btn type="submit" loading={busy} className="w-full">Save Provider</Btn>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Import modal */}
      <AnimatePresence>
        {imp && (
          <Modal title={`Import from ${imp.provider.name}`} onClose={() => setImp(null)} wide>
            {imp.loading ? (
              <Skeleton lines={3} />
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Your margin %">
                    <Input type="number" value={imp.markup} onChange={(e) => setImp({ ...imp, markup: e.target.value })} />
                  </Field>
                  <Field label="Put into category">
                    <Select value={imp.categoryId} onChange={(e) => setImp({ ...imp, categoryId: e.target.value })}>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </Field>
                </div>
                <div className="mt-3"><SearchInput value={imp.q} onChange={(q) => setImp({ ...imp, q })} placeholder={`Search ${imp.list.length} services…`} /></div>
                <div className="mt-2 flex items-center justify-between text-[12px]">
                  <span className="text-white/50">{imp.checked.size} selected</span>
                  <button
                    type="button"
                    onClick={() => setImp({ ...imp, checked: new Set(impVisible.map((s) => String(s.service))) })}
                    className="font-semibold text-violet-300"
                  >
                    Select visible ({impVisible.length})
                  </button>
                </div>
                <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                  {impVisible.slice(0, 200).map((s) => (
                    <label key={s.service} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] p-2.5 hover:border-white/15">
                      <input
                        type="checkbox"
                        checked={imp.checked.has(String(s.service))}
                        onChange={() => toggleCheck(String(s.service))}
                        className="mt-0.5 h-4 w-4 accent-violet-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-white/85">
                          <span className="mr-1 font-mono text-[11px] text-violet-300">#{s.service}</span>{s.name}
                        </span>
                        <span className="block text-[11px] text-white/40">
                          {s.category || ''} · ${Number(s.rate).toFixed(2)}/1k → <b className="text-emerald-300">{money(Number(s.rate) * (1 + Number(imp.markup || 0) / 100), currency())}</b>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <Btn onClick={doImport} loading={busy} disabled={!imp.checked.size} className="mt-3 w-full">
                  Import {imp.checked.size} Services
                </Btn>
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
