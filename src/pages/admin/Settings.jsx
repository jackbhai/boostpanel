import { AnimatePresence } from 'framer-motion'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Btn, Field, Input, Modal, PageHead, Textarea, toast } from '../../components/ui'
import { deleteAnnouncement, getAnnouncements, getSettings, saveAnnouncement, saveSettings } from '../../lib/db'
import { useStore } from '../../lib/store'
import { timeAgo } from '../../lib/utils'

const EMPTY = {
  site_name: '', currency: '₹', min_deposit: 100, support_email: '', notice: '',
  upi_id: '', upi_payee: '', pay_upi: true, pay_card: false, pay_crypto: false,
  card_info: '', crypto_info: '',
}

export default function AdminSettings() {
  const { refreshSettings } = useStore()
  const [form, setForm] = useState(EMPTY)
  const [anns, setAnns] = useState([])
  const [annForm, setAnnForm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSettings().then((s) => setForm({ ...EMPTY, ...s })).catch(() => {})
    getAnnouncements(false).then(setAnns).catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveSettings({ ...form, min_deposit: Number(form.min_deposit) })
      await refreshSettings()
      toast('Settings saved! ✅')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveAnn = async (e) => {
    e.preventDefault()
    try {
      await saveAnnouncement(annForm)
      setAnnForm(null)
      setAnns(await getAnnouncements(false))
      toast('Announcement saved! 📢')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const delAnn = async (id) => {
    if (!window.confirm('Delete this announcement?')) return
    await deleteAnnouncement(id)
    setAnns(await getAnnouncements(false))
    toast('Deleted')
  }

  const Toggle = ({ k, label }) => (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
      <span className="text-sm font-semibold text-white/80">{label}</span>
      <input
        type="checkbox"
        checked={!!form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
        className="h-5 w-5 accent-violet-500"
      />
    </label>
  )

  return (
    <div>
      <PageHead title="Setup" sub="Panel, payments & announcements." />

      <form onSubmit={save} className="card space-y-3.5 p-4">
        <p className="text-sm font-bold text-white">⚙️ General</p>
        <Field label="Site name">
          <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency symbol">
            <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} maxLength={3} />
          </Field>
          <Field label="Min deposit">
            <Input type="number" value={form.min_deposit} onChange={(e) => setForm({ ...form, min_deposit: e.target.value })} />
          </Field>
        </div>
        <Field label="Support email">
          <Input type="email" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} />
        </Field>
        <Field label="Global notice">
          <Input placeholder="e.g. Maintenance at midnight" value={form.notice} onChange={(e) => setForm({ ...form, notice: e.target.value })} />
        </Field>

        <p className="pt-1 text-sm font-bold text-white">💰 Payments (UPI)</p>
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 text-[12px] leading-relaxed text-white/60">
          Add your UPI ID — users will see a <b className="text-white">QR with the amount pre-filled</b>,
          pay, then submit the <b className="text-white">12-digit UTR + screenshot</b> for your approval.
        </div>
        <Field label="Your UPI ID (receiving)">
          <Input placeholder="e.g. myshop@okhdfcbank" value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} />
        </Field>
        <Field label="Payee name (shown in UPI apps)">
          <Input placeholder="e.g. BoostPanel" value={form.upi_payee} onChange={(e) => setForm({ ...form, upi_payee: e.target.value })} />
        </Field>
        <div className="space-y-2">
          <Toggle k="pay_upi" label="🟢 Enable UPI" />
          <Toggle k="pay_card" label="💳 Enable Card (manual)" />
          <Toggle k="pay_crypto" label="₿ Enable Crypto (manual)" />
        </div>
        {form.pay_card && (
          <Field label="Card payment instructions (shown to users)">
            <Textarea placeholder={"Pay to card XXXX-XXXX…\nThen submit ref ID + screenshot."} value={form.card_info} onChange={(e) => setForm({ ...form, card_info: e.target.value })} />
          </Field>
        )}
        {form.pay_crypto && (
          <Field label="Crypto payment details (shown to users)">
            <Textarea placeholder={"USDT (TRC20): TXYZ…\nThen submit tx hash + screenshot."} value={form.crypto_info} onChange={(e) => setForm({ ...form, crypto_info: e.target.value })} />
          </Field>
        )}

        <Btn type="submit" loading={busy} className="w-full">Save Settings</Btn>
      </form>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-white/45">📢 Announcements</p>
        <Btn onClick={() => setAnnForm({ title: '', body: '', active: true })} className="!px-3 !py-1.5 text-[12px]">
          <Plus size={14} /> New
        </Btn>
      </div>
      <div className="space-y-2">
        {anns.map((a) => (
          <div key={a.id} className={`card p-3.5 ${a.active ? '' : 'opacity-50'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">{a.title}</p>
                <p className="mt-0.5 text-[13px] text-white/55">{a.body}</p>
                <p className="mt-1 text-[11px] text-white/35">{a.active ? '🟢 visible' : '⚪ hidden'} · {timeAgo(a.created_at)}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => setAnnForm({ ...a })} className="rounded-lg bg-white/5 p-1.5 text-white/60"><Pencil size={14} /></button>
                <button onClick={() => delAnn(a.id)} className="rounded-lg bg-white/5 p-1.5 text-rose-300/70"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {anns.length === 0 && (
          <div className="card p-6 text-center text-sm text-white/40">No announcements yet.</div>
        )}
      </div>

      <AnimatePresence>
        {annForm && (
          <Modal title={annForm.id ? 'Edit announcement' : 'New announcement'} onClose={() => setAnnForm(null)}>
            <form onSubmit={saveAnn} className="space-y-3.5">
              <Field label="Title"><Input value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} required /></Field>
              <Field label="Body"><Textarea value={annForm.body} onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })} required /></Field>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={annForm.active !== false} onChange={(e) => setAnnForm({ ...annForm, active: e.target.checked })} className="h-4 w-4 accent-violet-500" />
                Visible to users
              </label>
              <Btn type="submit" className="w-full">Save</Btn>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
