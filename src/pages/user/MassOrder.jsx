import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Field, PageHead, Textarea, toast } from '../../components/ui'
import { CheckCircle2, XCircle } from '../../components/icons'
import { placeOrder } from '../../lib/db'
import { useStore } from '../../lib/store'
import { calcCharge, money } from '../../lib/utils'

export default function MassOrder() {
  const { user, profile, services, currency, refreshProfile } = useStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const navigate = useNavigate()

  const lines = useMemo(() => {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [id, link, qty] = line.split('|').map((x) => (x || '').trim())
        const svc = services.find((s) => String(s.id) === String(id))
        const qtyNum = Number(qty)
        let error = ''
        if (!svc) error = `Service #${id || '?'} not found`
        else if (!link?.startsWith('http')) error = 'Link must start with http'
        else if (!Number.isInteger(qtyNum) || qtyNum < svc.min_qty || qtyNum > svc.max_qty)
          error = `Qty must be ${svc.min_qty}–${svc.max_qty}`
        return { id, link, qty: qtyNum, svc, error, charge: svc && !error ? calcCharge(svc.rate, qtyNum) : 0 }
      })
  }, [text, services])

  const total = lines.filter((l) => !l.error).reduce((s, l) => s + l.charge, 0)
  const valid = lines.filter((l) => !l.error).length

  const submit = async () => {
    if (!lines.length) return toast('Paste at least one order line', 'error')
    if (total > Number(profile?.balance || 0)) return toast('Insufficient balance for this batch', 'error')
    setBusy(true)
    let ok = 0
    const errors = []
    for (const l of lines) {
      if (l.error) {
        errors.push(`#${l.id}: ${l.error}`)
        continue
      }
      try {
        await placeOrder(user.id, l.svc, l.link, l.qty)
        ok++
      } catch (err) {
        errors.push(`#${l.id}: ${err.message}`)
      }
    }
    await refreshProfile()
    setBusy(false)
    setResult({ ok, errors })
    if (ok) toast(`${ok} order${ok > 1 ? 's' : ''} placed!`)
  }

  return (
    <div>
      <PageHead title="Mass Order" sub="Place many orders at once — one per line." />

      <div className="card border-sky-500/25 bg-sky-500/5 p-4 text-[13px] leading-relaxed text-white/65">
        <p className="mb-1 font-bold text-white">Format: <span className="font-mono text-sky-300">service_id | link | quantity</span></p>
        <p className="font-mono text-[12px] text-white/50">
          104 | https://instagram.com/reel/abc | 5000<br />
          302 | https://tiktok.com/@x/video/1 | 10000
        </p>
        <p className="mt-1 text-[12px]">Find IDs on the <button className="font-semibold text-sky-300" onClick={() => navigate('/services')}>Services page</button>.</p>
      </div>

      <div className="mt-4">
        <Field label={`Your orders (${lines.length} lines · ${valid} valid)`}>
          <Textarea
            rows={7}
            className="font-mono !text-[13px]"
            placeholder={'104 | https://… | 5000'}
            value={text}
            onChange={(e) => { setText(e.target.value); setResult(null) }}
          />
        </Field>
      </div>

      {lines.some((l) => l.error) && (
        <div className="card mt-3 space-y-1 border-rose-500/25 bg-rose-500/5 p-3.5">
          {lines.filter((l) => l.error).slice(0, 5).map((l, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[12px] text-rose-200">
              <XCircle size={13} className="mt-0.5 shrink-0" /> Line #{l.id || '?'}: {l.error}
            </p>
          ))}
          {lines.filter((l) => l.error).length > 5 && (
            <p className="text-[12px] text-rose-200/70">…and more</p>
          )}
        </div>
      )}

      <div className="card mt-3 flex items-center justify-between p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Batch total</p>
          <p className="text-2xl font-extrabold text-white">{money(total, currency())}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Balance</p>
          <p className={`text-lg font-bold ${total <= Number(profile?.balance || 0) ? 'text-emerald-300' : 'text-rose-300'}`}>
            {money(profile?.balance, currency())}
          </p>
        </div>
      </div>

      <Btn onClick={submit} loading={busy} disabled={!valid} className="mt-4 w-full py-3">
        Place {valid} Order{valid !== 1 ? 's' : ''}
      </Btn>

      {result && (
        <div className="card mt-3 p-4 text-[13px]">
          <p className="flex items-center gap-1.5 font-bold text-emerald-300">
            <CheckCircle2 size={15} /> {result.ok} placed
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="mt-1 flex items-start gap-1.5 text-rose-200">
              <XCircle size={13} className="mt-0.5 shrink-0" /> {e}
            </p>
          ))}
          {result.ok > 0 && (
            <button onClick={() => navigate('/orders')} className="mt-3 font-semibold text-violet-300">
              View orders →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
