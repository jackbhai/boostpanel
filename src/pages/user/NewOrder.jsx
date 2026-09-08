import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Field, Input, PageHead, Select, toast } from '../../components/ui'
import { AlertCircle, BadgeCheck, Clock, Info, Percent, Plug, RefreshCcw, Wallet } from '../../components/icons'
import { placeOrder } from '../../lib/db'
import { useStore } from '../../lib/store'
import { calcCharge, money } from '../../lib/utils'

export default function NewOrder() {
  const { user, profile, categories, services, currency, refreshProfile } = useStore()
  const [catId, setCatId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [link, setLink] = useState('')
  const [qty, setQty] = useState('')
  const [runs, setRuns] = useState('')
  const [intervalMins, setIntervalMins] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const activeCats = useMemo(() => categories.filter((c) => c.active !== false), [categories])
  const catServices = useMemo(
    () => services.filter((s) => String(s.category_id) === String(catId) && s.active !== false),
    [services, catId],
  )
  const service = useMemo(() => services.find((s) => String(s.id) === String(serviceId)), [services, serviceId])
  const disc = Math.min(100, Math.max(0, Number(profile?.discount_pct || 0)))
  const charge = service && qty ? Math.round(calcCharge(service.rate, Number(qty) || 0) * (100 - disc)) / 100 : 0
  const qtyNum = Number(qty) || 0
  const qtyValid = service && Number.isInteger(qtyNum) && qtyNum >= service.min_qty && qtyNum <= service.max_qty
  const affordable = charge <= Number(profile?.balance || 0)

  const submit = async (e) => {
    e.preventDefault()
    if (!service) return toast('Please select a service', 'error')
    setBusy(true)
    try {
      const { order, forwarded, provider_error } = await placeOrder(user.id, service, link.trim(), qtyNum, { runs: Number(runs) || 0, interval_mins: Number(intervalMins) || 0 })
      await refreshProfile()
      toast(forwarded
        ? `Order #${order.id} placed and sent to provider`
        : provider_error
          ? `Order #${order.id} placed. ${provider_error}`
          : `Order #${order.id} placed. ${money(order.charge, currency())} deducted.`)
      navigate('/orders')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHead title="New Order" sub="Pick a service, paste your link, done." />

      <form onSubmit={submit} className="space-y-4">
        <Field label="1 · Category">
          <Select value={catId} onChange={(e) => { setCatId(e.target.value); setServiceId('') }} required>
            <option value="">— Select platform —</option>
            {activeCats.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="2 · Service">
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required disabled={!catId}>
            <option value="">{catId ? '— Select service —' : 'Select a category first'}</option>
            {catServices.map((s) => (
              <option key={s.id} value={s.id}>#{s.id} — {s.name}</option>
            ))}
          </Select>
        </Field>

        {service && (
          <div className="card space-y-2.5 border-violet-500/25 bg-violet-500/5 p-4">
            <p className="text-sm font-semibold text-white">{service.name}</p>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <span className="flex items-center gap-1.5 text-white/60">
                <Wallet size={13} className="text-emerald-300" /> {money(service.rate, currency())} <span className="text-white/35">/ 1000</span>
              </span>
              <span className="flex items-center gap-1.5 text-white/60">
                <Clock size={13} className="text-sky-300" /> Start {service.avg_time || '—'}
              </span>
              <span className="flex items-center gap-1.5 text-white/60">
                <BadgeCheck size={13} className="text-violet-300" /> Min {Number(service.min_qty).toLocaleString()} · Max {Number(service.max_qty).toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5 text-white/60">
                <RefreshCcw size={13} className="text-amber-300" />
                {service.refill_days > 0 ? `${service.refill_days}-day refill` : 'No refill'}
              </span>
            </div>
            {service.description && (
              <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-white/45">
                <Info size={13} className="mt-0.5 shrink-0" /> {service.description}
              </p>
            )}
            {service.provider_id ? (
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-sky-300">
                <Plug size={13} /> Auto-fulfilled via connected API
              </p>
            ) : null}
          </div>
        )}

        <Field label="3 · Link" hint="The public profile / post / video URL for this service.">
          <Input placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} required />
        </Field>

        <Field
          label="4 · Quantity"
          hint={service ? `Min ${Number(service.min_qty).toLocaleString()} — Max ${Number(service.max_qty).toLocaleString()}` : 'Select a service to see limits'}
        >
          <Input
            type="number" inputMode="numeric" placeholder="e.g. 1000"
            value={qty} onChange={(e) => setQty(e.target.value)} required min={1}
          />
        </Field>

        {service?.provider_id ? (
          <div className="card space-y-3 p-4">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-white"><Clock size={14} className="text-sky-300" /> Drip-feed <span className="font-normal text-white/40">(optional — gradual delivery)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Runs (portions)">
                <Input type="number" min="0" max="100" placeholder="e.g. 10" value={runs} onChange={(e) => setRuns(e.target.value)} />
              </Field>
              <Field label="Interval (minutes)">
                <Input type="number" min="0" max="1440" placeholder="e.g. 60" value={intervalMins} onChange={(e) => setIntervalMins(e.target.value)} />
              </Field>
            </div>
            {Number(runs) > 0 && <p className="text-[12px] text-white/45">Quantity will be split into {runs} runs, {intervalMins || 0} min apart.</p>}
          </div>
        ) : null}

        {/* Live bill */}
        <div className="card flex items-center justify-between p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Total charge</p>
            <p className={`text-2xl font-extrabold ${qtyValid ? 'text-white' : 'text-white/30'}`}>
              {money(qtyValid ? charge : 0, currency())}
            </p>
            {disc > 0 && <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-300"><Percent size={11} /> {disc}% account discount applied</p>}
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Your balance</p>
            <p className={`text-lg font-bold ${affordable ? 'text-emerald-300' : 'text-rose-300'}`}>
              {money(profile?.balance, currency())}
            </p>
          </div>
        </div>

        {!affordable && qtyValid && (
          <button
            type="button" onClick={() => navigate('/funds')}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-200"
          >
            <AlertCircle size={15} /> Low balance — tap to add funds
          </button>
        )}

        <Btn type="submit" loading={busy} disabled={!qtyValid || !link} className="w-full py-3 text-[15px]">
          Place Order · {money(qtyValid ? charge : 0, currency())}
        </Btn>
      </form>
    </div>
  )
}
