import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Btn, Field, Input, Modal, PageHead, Textarea, toast } from '../../components/ui'
import { Megaphone, Pencil, Plus, Settings as SettingsIcon, Trash2, Wallet } from '../../components/icons'
import { deleteAnnouncement, getAnnouncements, getSettings, saveAnnouncement, saveSettings } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { timeAgo } from '../../lib/utils'

const EMPTY = {
  site_name: '', currency: '₹', min_deposit: 100, support_email: '', notice: '',
  upi_id: '', upi_payee: '', pay_upi: true, pay_card: false, pay_crypto: false,
  card_info: '', crypto_info: '', bank_info: '', signup_bonus: 0, deposit_bonus_pct: 0, maintenance: false,
  pay_bank: false, referral_reward: 0, loyalty_per_100: 0, loyalty_redeem_rate: 0,
  transfer_min: 0, transfer_fee_pct: 0, max_active_orders: 0, ticket_sla_hours: 24,
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
      await saveSettings({
        ...form,
        min_deposit: Number(form.min_deposit), signup_bonus: Number(form.signup_bonus) || 0,
        deposit_bonus_pct: Number(form.deposit_bonus_pct) || 0, referral_reward: Number(form.referral_reward) || 0,
        loyalty_per_100: Number(form.loyalty_per_100) || 0, loyalty_redeem_rate: Number(form.loyalty_redeem_rate) || 0,
        transfer_min: Number(form.transfer_min) || 0, transfer_fee_pct: Number(form.transfer_fee_pct) || 0,
        max_active_orders: Number(form.max_active_orders) || 0, ticket_sla_hours: Number(form.ticket_sla_hours) || 24,
      })
      await refreshSettings()
      toast('Settings saved!')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveAnn = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        title: annForm.title, body: annForm.body, active: annForm.active !== false,
        starts_at: annForm.starts_at ? new Date(annForm.starts_at).toISOString() : null,
        ends_at: annForm.ends_at ? new Date(annForm.ends_at).toISOString() : null,
      }
      if (annForm.id) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', annForm.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('announcements').insert(payload)
        if (error) throw error
      }
      setAnnForm(null)
      setAnns(await getAnnouncements(false))
      toast('Announcement saved!')
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
      <span className="text-sm font-semibold text-white/100">{label}</span>
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
        <p className="flex items-center gap-1.5 text-sm font-bold text-white"><SettingsIcon size={15} /> General</p>
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

        <p className="flex items-center gap-1.5 pt-1 text-sm font-bold text-white"><SettingsIcon size={15} /> Growth & Safety</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Signup bonus (free credit)">
            <Input type="number" min="0" value={form.signup_bonus} onChange={(e) => setForm({ ...form, signup_bonus: e.target.value })} />
          </Field>
          <Field label="Deposit bonus %">
            <Input type="number" min="0" max="100" value={form.deposit_bonus_pct} onChange={(e) => setForm({ ...form, deposit_bonus_pct: e.target.value })} />
          </Field>
        </div>
        <Toggle k="maintenance" label="Maintenance mode (only admins can use panel)" />

        <p className="flex items-center gap-1.5 pt-1 text-sm font-bold text-white"><Wallet size={15} /> Payments (UPI)</p>
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
          <Toggle k="pay_upi" label="Enable UPI" />
          <Toggle k="pay_card" label="Enable Card (manual)" />
          <Toggle k="pay_crypto" label="Enable Crypto (manual)" />
          <Toggle k="pay_bank" label="Enable Bank transfer (manual)" />
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
        {form.pay_bank && (
          <Field label="Bank details (shown to users)">
            <Textarea placeholder={"A/C: 50100234567890 · IFSC: HDFC0001234 · Name: BoostPanel\nThen submit UTR + screenshot."} value={form.bank_info} onChange={(e) => setForm({ ...form, bank_info: e.target.value })} />
          </Field>
        )}

        <p className="flex items-center gap-1.5 pt-1 text-sm font-bold text-white"><SettingsIcon size={15} /> Rewards, transfers & limits</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Referral reward (credit)"><Input type="number" min="0" step="0.01" value={form.referral_reward} onChange={(e) => setForm({ ...form, referral_reward: e.target.value })} /></Field>
          <Field label="Support SLA (hours)"><Input type="number" min="1" value={form.ticket_sla_hours} onChange={(e) => setForm({ ...form, ticket_sla_hours: e.target.value })} /></Field>
          <Field label="Loyalty pts / 100 spent"><Input type="number" min="0" step="0.01" value={form.loyalty_per_100} onChange={(e) => setForm({ ...form, loyalty_per_100: e.target.value })} /></Field>
          <Field label="Loyalty redeem (1pt =)"><Input type="number" min="0" step="0.0001" value={form.loyalty_redeem_rate} onChange={(e) => setForm({ ...form, loyalty_redeem_rate: e.target.value })} /></Field>
          <Field label="Min transfer"><Input type="number" min="0" step="0.01" value={form.transfer_min} onChange={(e) => setForm({ ...form, transfer_min: e.target.value })} /></Field>
          <Field label="Transfer fee %"><Input type="number" min="0" max="50" step="0.1" value={form.transfer_fee_pct} onChange={(e) => setForm({ ...form, transfer_fee_pct: e.target.value })} /></Field>
        </div>
        <Field label="Max active orders / user (0 = unlimited)" hint="Enforced on the server at checkout."><Input type="number" min="0" value={form.max_active_orders} onChange={(e) => setForm({ ...form, max_active_orders: e.target.value })} /></Field>

        <Btn type="submit" loading={busy} className="w-full">Save Settings</Btn>
      </form>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/45"><Megaphone size={13} /> Announcements</p>
        <Btn onClick={() => setAnnForm({ title: '', body: '', active: true, starts_at: '', ends_at: '' })} className="!px-3 !py-1.5 text-[12px]">
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
                <p className="mt-1 text-[11px] text-white/35">{a.active ? 'Visible' : 'Hidden'} · {timeAgo(a.created_at)}{(a.starts_at || a.ends_at) ? ` · ${(() => { const n = Date.now(); const s = a.starts_at ? new Date(a.starts_at).getTime() : 0; const en = a.ends_at ? new Date(a.ends_at).getTime() : Infinity; return n < s ? 'scheduled' : n > en ? 'expired' : 'live now' })()}` : ''}</p>
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
              <div className="grid grid-cols-2 gap-2">
                <Field label="Show from (optional)"><Input type="datetime-local" value={annForm.starts_at ? String(annForm.starts_at).slice(0, 16) : ''} onChange={(e) => setAnnForm({ ...annForm, starts_at: e.target.value })} /></Field>
                <Field label="Hide after (optional)"><Input type="datetime-local" value={annForm.ends_at ? String(annForm.ends_at).slice(0, 16) : ''} onChange={(e) => setAnnForm({ ...annForm, ends_at: e.target.value })} /></Field>
              </div>
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
