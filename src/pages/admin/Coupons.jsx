import { useEffect, useMemo, useState } from 'react'
import { Badge, Btn, EmptyState, Field, Input, PageHead, Select, toast } from '../../components/ui'
import { Copy, Percent, Power, Tag, X } from '../../components/icons'
import { deleteCoupon, listCoupons, saveCoupon, toggleCoupon } from '../../lib/db'
import { downloadCSV } from '../../lib/csv'
import { timeAgo } from '../../lib/utils'

const BLANK = { code: '', kind: 'pct', value: '', max_uses: '', min_charge: '', expires_at: '', active: true, public: true }

export default function AdminCoupons() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    try { setList(await listCoupons()) } catch { toast('Failed to load coupons', 'error') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? list.filter((c) => (c.code || '').toLowerCase().includes(s)) : list
  }, [list, q])

  const startEdit = (c) => {
    setEditing(c.id)
    setForm({
      code: c.code, kind: c.kind, value: c.value, max_uses: c.max_uses || '',
      min_charge: c.min_charge || '',
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : '', active: c.active !== false, public: c.public !== false,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async (e) => {
    e?.preventDefault()
    if (!form.code.trim() || !(Number(form.value) > 0)) return toast('Code + value are required', 'error')
    setBusy(true)
    try {
      await saveCoupon({ ...(editing ? { id: editing } : {}), ...form, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null })
      toast(editing ? 'Coupon updated' : 'Coupon created')
      setForm(BLANK); setEditing(null); load()
    } catch (err) { toast(err.message || 'Save failed', 'error') }
    setBusy(false)
  }

  const toggle = async (c) => {
    try { await toggleCoupon(c.id, !(c.active !== false)); toast(c.active !== false ? 'Coupon disabled' : 'Coupon enabled'); load() }
    catch (err) { toast(err.message, 'error') }
  }
  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return
    try { await deleteCoupon(c.id); toast('Coupon deleted'); load() } catch (err) { toast(err.message, 'error') }
  }
  const copy = (code) => { navigator.clipboard.writeText(code); toast('Code copied!') }

  const totalSaved = list.reduce((s, c) => s + Number(c.used || 0), 0)

  return (
    <div>
      <PageHead title="Coupons" sub="Discount codes applied server-side at checkout. One use per user." />
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center"><p className="text-xl font-extrabold text-white">{list.length}</p><p className="text-[11px] text-white/45">Coupons</p></div>
        <div className="card p-3 text-center"><p className="text-xl font-extrabold text-emerald-300">{list.filter((c) => c.active !== false).length}</p><p className="text-[11px] text-white/45">Active</p></div>
        <div className="card p-3 text-center"><p className="text-xl font-extrabold text-violet-300">{totalSaved}</p><p className="text-[11px] text-white/45">Redemptions</p></div>
      </div>

      <form onSubmit={save} className="card mb-3 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-white">
          <Tag size={15} className="text-violet-300" /> {editing ? `Edit ${form.code}` : 'New coupon'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} placeholder="DIWALI20" maxLength={24} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="pct">% off</option><option value="flat">Flat off</option>
              </Select>
            </Field>
            <Field label="Value"><Input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.kind === 'pct' ? '20' : '50'} /></Field>
          </div>
          <Field label="Max uses (0 = unlimited)"><Input type="number" min="0" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="0" /></Field>
          <Field label="Min order amount"><Input type="number" min="0" step="0.01" value={form.min_charge} onChange={(e) => setForm({ ...form, min_charge: e.target.value })} placeholder="0" /></Field>
          <Field label="Expires at"><Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={form.active ? 'on' : 'off'} onChange={(e) => setForm({ ...form, active: e.target.value === 'on' })}>
              <option value="on">Active</option><option value="off">Disabled</option>
            </Select>
          </Field>
          <Field label="Show in Rewards offers" hint="Off = secret code (broadcast it yourself)">
            <Select value={form.public ? 'on' : 'off'} onChange={(e) => setForm({ ...form, public: e.target.value === 'on' })}>
              <option value="on">Public</option><option value="off">Secret</option>
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <Btn type="submit" loading={busy} className="flex-1">{editing ? 'Save changes' : 'Create coupon'}</Btn>
          {editing && <Btn variant="ghost" onClick={() => { setEditing(null); setForm(BLANK) }}>Cancel</Btn>}
        </div>
      </form>

      <div className="mb-2 flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code…" className="flex-1" />
        <Btn variant="ghost" onClick={() => downloadCSV('coupons.csv', rows)} className="!px-3 !py-2 text-[12px]">CSV</Btn>
      </div>

      {loading ? <p className="py-6 text-center text-[13px] text-white/40">Loading…</p>
        : rows.length === 0 ? <EmptyState icon={<Percent size={36} />} title="No coupons" hint="Create one above — users apply it at checkout." />
        : (
          <div className="space-y-2">
            {rows.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at).getTime() < Date.now()
              const exhausted = Number(c.max_uses) > 0 && Number(c.used) >= Number(c.max_uses)
              return (
                <div key={c.id} className={`card p-3.5 ${c.active === false || expired ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copy(c.code)} className="rounded-lg bg-violet-500/15 px-2.5 py-1 font-mono text-[14px] font-extrabold tracking-wider text-violet-200">
                      {c.code}
                    </button>
                    <button onClick={() => copy(c.code)} className="text-white/35 hover:text-white"><Copy size={14} /></button>
                    {c.public !== false && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">public</span>}
                    <span className="ml-auto text-[14px] font-extrabold text-emerald-300">
                      {c.kind === 'pct' ? `${c.value}%` : `−${c.value}`} off
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-white/45">
                    <Badge status={c.active !== false && !expired && !exhausted ? 'completed' : 'closed'}>
                      {c.active === false ? 'disabled' : expired ? 'expired' : exhausted ? 'exhausted' : 'live'}
                    </Badge>
                    <span>used {c.used || 0}{Number(c.max_uses) > 0 ? `/${c.max_uses}` : ''}</span>
                    {Number(c.min_charge) > 0 && <span>· min {c.min_charge}</span>}
                    {c.expires_at && <span>· ends {timeAgo(c.expires_at)}</span>}
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <Btn variant="subtle" onClick={() => startEdit(c)} className="!px-3 !py-1.5 text-[12px]">Edit</Btn>
                    <Btn variant="subtle" onClick={() => toggle(c)} className="!px-3 !py-1.5 text-[12px]">
                      <Power size={13} />{c.active !== false ? 'Disable' : 'Enable'}
                    </Btn>
                    <Btn variant="danger" onClick={() => remove(c)} className="ml-auto !px-3 !py-1.5 text-[12px]"><X size={13} />Delete</Btn>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}
