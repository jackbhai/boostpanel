import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Btn, Field, Input, PageHead, toast } from '../../components/ui'
import { AlertCircle, BadgeIndianRupee, Bitcoin, CheckCircle2, Copy, CreditCard, RefreshCw, Upload, X } from '../../components/icons'
import { requestTopup, uploadProof } from '../../lib/db'
import { useStore } from '../../lib/store'
import { isValidUtr, upiQrDataUrl, upiUrl } from '../../lib/upi'
import { money } from '../../lib/utils'

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000]

export default function AddFunds() {
  const { user, profile, settings, currency } = useStore()
  const [method, setMethod] = useState('UPI')
  const [amount, setAmount] = useState('')
  const [qr, setQr] = useState(null)
  const [qrFor, setQrFor] = useState(null)
  const [qrBusy, setQrBusy] = useState(false)
  const [ref, setRef] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const min = Number(settings?.min_deposit || 100)
  const methods = [
    settings?.pay_upi !== false && { id: 'UPI', icon: BadgeIndianRupee, label: 'UPI', hint: 'GPay / PhonePe' },
    settings?.pay_card && { id: 'Card', icon: CreditCard, label: 'Card', hint: 'Manual' },
    settings?.pay_crypto && { id: 'Crypto', icon: Bitcoin, label: 'Crypto', hint: 'USDT / BTC' },
    settings?.pay_bank && { id: 'Bank', icon: CreditCard, label: 'Bank', hint: 'NEFT / IMPS' },
  ].filter(Boolean)

  const activeMethod = methods.find((m) => m.id === method) ? method : methods[0]?.id

  const makeQr = async () => {
    const amt = Number(amount)
    if (!amt || amt < min) return toast(`Minimum deposit is ${money(min, currency())}`, 'error')
    if (!settings?.upi_id) return toast('Admin has not added a UPI ID yet', 'error')
    setQrBusy(true)
    try {
      const link = upiUrl({
        pa: settings.upi_id,
        pn: settings.upi_payee || settings.site_name,
        amount: amt,
        note: `${settings.site_name} topup`,
        ref: `BP${Date.now().toString().slice(-10)}`,
      })
      setQr(await upiQrDataUrl(link))
      setQrFor(amt)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setQrBusy(false)
    }
  }

  const pickFile = (f) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return toast('Please select an image', 'error')
    if (f.size > 5 * 1024 * 1024) return toast('Image must be under 5 MB', 'error')
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submit = async (e) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt < min) return toast(`Minimum deposit is ${money(min, currency())}`, 'error')
    if (activeMethod === 'UPI' && !isValidUtr(ref)) {
      return toast('Enter the 12-digit UPI Ref / UTR number', 'error')
    }
    if (activeMethod !== 'UPI' && !ref.trim()) return toast('Reference is required', 'error')
    if (!file) return toast('Please attach the payment screenshot', 'error')
    setBusy(true)
    try {
      const url = await uploadProof(file, user.id)
      await requestTopup(user.id, { amount: amt, method: activeMethod, txn_ref: ref.trim(), screenshot_url: url })
      setDone(true)
      setAmount('')
      setRef('')
      setFile(null)
      setPreview(null)
      setQr(null)
      toast('Deposit request submitted. Admin will verify shortly.')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!methods.length) {
    return (
      <div>
        <PageHead title="Add Funds" />
        <div className="card p-8 text-center">
          <AlertCircle size={36} className="mx-auto text-amber-300" />
          <p className="mt-2 font-bold text-white">Payments are disabled</p>
          <p className="mt-1 text-sm text-white/50">Please contact support. Add a ticket <Link to="/tickets" className="text-violet-300">here</Link>.</p>
        </div>
      </div>
    )
  }

  const manualInfo = activeMethod === 'Card' ? settings?.card_info : activeMethod === 'Crypto' ? settings?.crypto_info : activeMethod === 'Bank' ? settings?.bank_info : ''

  return (
    <div>
      <PageHead title="Add Funds" sub="Pay → upload proof → get balance." />

      <div className="card flex items-center justify-between border-emerald-500/25 bg-emerald-500/5 p-4">
        <p className="text-sm text-white/60">Current balance</p>
        <p className="text-xl font-extrabold text-emerald-300">{money(profile?.balance, currency())}</p>
      </div>

      {Number(settings?.deposit_bonus_pct) > 0 && (
        <div className="card mt-3 border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-[13px] font-bold text-emerald-200">
          Limited time: +{settings.deposit_bonus_pct}% bonus on every deposit{amount && Number(amount) > 0 ? ` — pay ${money(Number(amount), currency())}, get ${money(Number(amount) * (1 + Number(settings.deposit_bonus_pct) / 100), currency())}` : ''}
        </div>
      )}

      {/* 1 · Method */}
      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-white/45">1 · Payment method</p>
      <div className={`grid gap-2 ${methods.length === 1 ? 'grid-cols-1' : methods.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { setMethod(m.id); setQr(null) }}
            className={`rounded-2xl border p-3 text-center transition ${activeMethod === m.id ? 'border-violet-500/60 bg-violet-500/10' : 'card hover:border-white/20'}`}
          >
            <m.icon size={22} className={`mx-auto ${activeMethod === m.id ? 'text-violet-300' : 'text-white/50'}`} />
            <p className="mt-1.5 text-[13px] font-bold text-white">{m.label}</p>
            <p className="text-[10px] text-white/40">{m.hint}</p>
          </button>
        ))}
      </div>

      {/* 2 · Amount */}
      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-white/45">2 · Amount (min {money(min, currency())})</p>
      <div className="mb-2 flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => { setAmount(String(a)); setQr(null) }}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${String(amount) === String(a) ? 'grad-btn text-white' : 'border border-white/10 bg-white/5 text-white/60'}`}
          >
            {money(a, currency())}
          </button>
        ))}
      </div>
      <Input type="number" min={min} placeholder={`e.g. ${min}`} value={amount} onChange={(e) => { setAmount(e.target.value); setQr(null) }} />

      {/* 3 · Pay */}
      {activeMethod === 'UPI' ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/45">3 · Scan and pay (amount auto-filled)</p>
          {!settings?.upi_id ? (
            <div className="card flex items-center gap-2 border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200">
              <AlertCircle size={18} className="shrink-0" />
              Admin has not added a UPI ID yet. Please try later or open a ticket.
            </div>
          ) : !qr ? (
            <Btn variant="ghost" onClick={makeQr} loading={qrBusy} className="w-full py-3">
              <RefreshCw size={16} /> Generate Payment QR {amount ? `for ${money(Number(amount) || 0, currency())}` : ''}
            </Btn>
          ) : (
            <div className="card p-4 text-center">
              <img src={qr} alt="UPI QR" className="mx-auto w-52 rounded-xl border-4 border-white" />
              <p className="mt-3 text-2xl font-extrabold text-white">{money(qrFor, currency())}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(settings.upi_id); toast('UPI ID copied!') }}
                className="mx-auto mt-2 flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 font-mono text-[13px] text-violet-200"
              >
                {settings.upi_id} <Copy size={13} />
              </button>
              <p className="mt-1.5 text-[11px] text-white/40">Payee: {settings.upi_payee} · Scan with any UPI app</p>
              <button onClick={() => setQr(null)} className="mt-2 text-[12px] font-semibold text-white/50 underline">
                Change amount
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/45">3 · Payment details</p>
          <div className="card whitespace-pre-wrap p-4 text-[13px] leading-relaxed text-white/70">
            {manualInfo || 'Contact support for payment details.'}
          </div>
        </div>
      )}

      {/* 4 · Proof */}
      <form onSubmit={submit} className="mt-4 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-white/45">
          4 · Submit proof {activeMethod === 'UPI' ? '(12-digit UTR + screenshot)' : '(ref + screenshot)'}
        </p>
        <Field label={activeMethod === 'UPI' ? 'UPI Ref / UTR number (12 digits)' : activeMethod === 'Crypto' ? 'Transaction hash' : 'Payment reference'}>
          <Input
            inputMode={activeMethod === 'UPI' ? 'numeric' : 'text'}
            placeholder={activeMethod === 'UPI' ? 'e.g. 482910337155' : 'Paste reference here'}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            maxLength={activeMethod === 'UPI' ? 12 : 100}
            required
          />
        </Field>
        <Field label="Payment screenshot" hint="JPG/PNG up to 5 MB — must clearly show amount + UTR.">
          {!preview ? (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center transition hover:border-violet-500/50">
              <Upload size={24} className="text-violet-300" />
              <span className="text-sm font-semibold text-white/70">Tap to upload screenshot</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
          ) : (
            <div className="relative">
              <img src={preview} alt="proof" className="max-h-64 w-full rounded-xl border border-white/10 object-contain bg-black/30" />
              <button
                type="button"
                onClick={() => { setFile(null); setPreview(null) }}
                className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </Field>
        <Btn type="submit" loading={busy} className="w-full py-3">
          Submit — I Have Paid {amount ? money(Number(amount) || 0, currency()) : ''}
        </Btn>
      </form>

      {done && (
        <div className="card mt-4 border-emerald-500/25 bg-emerald-500/5 p-4 text-center">
          <CheckCircle2 size={32} className="mx-auto text-emerald-300" />
          <p className="mt-1 text-sm font-bold text-white">Request received!</p>
          <p className="mt-0.5 text-[13px] text-white/55">Admin will verify your screenshot and UTR, then approve. Track it in <Link to="/transactions" className="font-semibold text-violet-300">Transactions</Link>.</p>
        </div>
      )}
    </div>
  )
}
