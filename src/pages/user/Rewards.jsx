import { useEffect, useMemo, useState } from 'react'
import { Badge, Btn, EmptyState, Field, Input, PageHead, toast } from '../../components/ui'
import { Check, Copy, Send, Star, Tag, Users, Wallet } from '../../components/icons'
import { claimReferral, convertLoyalty, myReferrals, sendTransfer } from '../../lib/db'
import { money, timeAgo } from '../../lib/utils'
import { useStore } from '../../lib/store'

export default function Rewards() {
  const { user, profile, settings, currency, refreshProfile } = useStore()
  const [refs, setRefs] = useState([])
  const [code, setCode] = useState('')
  const [pts, setPts] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (user) myReferrals(user.id).then(setRefs).catch(() => {})
  }, [user])

  const feePct = Number(settings?.transfer_fee_pct || 0)
  const fee = useMemo(() => +((Number(amount) || 0) * feePct / 100).toFixed(4), [amount, feePct])
  const totalEarned = refs.reduce((s, r) => s + Number(r.reward || 0), 0)
  const refLink = `${window.location.origin}${import.meta.env.BASE_URL || '/'}signup?ref=${profile?.referral_code || ''}`

  const share = async () => {
    const text = `Join ${settings?.site_name || 'BoostPanel'} with my code ${profile?.referral_code} and we both earn rewards! ${refLink}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Refer & earn', text }) } catch { /* dismissed */ }
    } else {
      navigator.clipboard.writeText(text)
      toast('Invite text copied!')
    }
  }

  const claim = async () => {
    if (!code.trim()) return toast('Enter a referral code', 'error')
    setBusy('claim')
    try {
      const r = await claimReferral(code.trim())
      toast(r.reward > 0 ? `Code applied! Your friend earned ${money(r.reward, currency())}` : 'Code applied!')
      setCode('')
      refreshProfile?.()
    } catch (err) { toast(err.message, 'error') }
    setBusy(null)
  }

  const convert = async () => {
    const n = Math.floor(Number(pts) || 0)
    if (!n || n <= 0) return toast('Enter points to convert', 'error')
    setBusy('conv')
    try {
      const r = await convertLoyalty(n)
      toast(`+${money(r.credited, currency())} added to balance!`)
      setPts('')
      refreshProfile?.()
    } catch (err) { toast(err.message, 'error') }
    setBusy(null)
  }

  const transfer = async () => {
    if (!toEmail.trim() || !(Number(amount) > 0)) return toast('Email + amount required', 'error')
    if (!window.confirm(`Send ${money(Number(amount), currency())} to ${toEmail.trim()}${fee ? ` (+${money(fee, currency())} fee)` : ''}?`)) return
    setBusy('tx')
    try {
      const r = await sendTransfer(toEmail.trim(), Number(amount))
      toast(`Sent ${money(r.sent, currency())}${r.fee ? ` (fee ${money(r.fee, currency())})` : ''}`)
      setToEmail(''); setAmount('')
      refreshProfile?.()
    } catch (err) { toast(err.message, 'error') }
    setBusy(null)
  }

  const rate = Number(settings?.loyalty_redeem_rate || 0)
  const maxPts = Number(profile?.loyalty_points || 0)

  return (
    <div>
      <PageHead title="Rewards" sub="Refer friends, earn loyalty points, send balance." />

      <div className="card mb-3 border-violet-500/30 bg-gradient-to-br from-violet-600/15 to-fuchsia-600/10 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-white"><Users size={15} className="text-violet-300" /> Your referral code</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex-1 rounded-xl border border-dashed border-violet-400/40 bg-black/40 px-4 py-2.5 text-center font-mono text-xl font-extrabold tracking-[0.25em] text-white">
            {profile?.referral_code || '…'}
          </span>
        </div>
        <div className="mt-2 flex gap-2">
          <Btn variant="subtle" onClick={() => { navigator.clipboard.writeText(profile?.referral_code || ''); toast('Code copied!') }} className="flex-1 !py-2 text-[13px]"><Copy size={14} />Copy code</Btn>
          <Btn onClick={share} className="flex-1 !py-2 text-[13px]"><Send size={14} />Invite</Btn>
        </div>
        <p className="mt-2 text-center text-[12px] text-white/50">
          You earn <b className="text-emerald-300">{money(Number(settings?.referral_reward || 0), currency())}</b> for every friend who joins with your code.
        </p>
      </div>

      {!profile?.referred_by ? (
        <div className="card mb-3 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-white"><Tag size={15} className="text-amber-300" /> Have a code? Apply it</p>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="FRIEND'S CODE" className="flex-1 font-mono tracking-widest" maxLength={12} />
            <Btn onClick={claim} loading={busy === 'claim'}>Apply</Btn>
          </div>
        </div>
      ) : (
        <div className="card mb-3 flex items-center gap-2 border-emerald-500/25 p-4 text-[13px] text-emerald-200">
          <Check size={16} /> You joined with a referral code. Thanks for coming via a friend!
        </div>
      )}

      <div className="card mb-3 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-white"><Star size={15} className="text-amber-300" /> Loyalty points</p>
        <div className="mt-2 flex items-end justify-between">
          <p className="text-3xl font-extrabold text-white">{maxPts}<span className="ml-1 text-[13px] font-semibold text-white/40">pts</span></p>
          {rate > 0 && <p className="text-[12px] text-white/50">1 pt = {money(rate, currency())}</p>}
        </div>
        <p className="mt-1 text-[12px] text-white/45">
          Earn {settings?.loyalty_per_100 || 0} pts per {money(100, currency())} spent on orders.
        </p>
        {rate > 0 && maxPts > 0 && (
          <div className="mt-2.5 flex gap-2">
            <Input type="number" min="1" max={maxPts} value={pts} onChange={(e) => setPts(e.target.value)} placeholder={`Max ${maxPts}`} className="flex-1" />
            <Btn variant="success" onClick={convert} loading={busy === 'conv'}>
              Convert{Number(pts) > 0 ? ` → ${money(Number(pts) * rate, currency())}` : ''}
            </Btn>
          </div>
        )}
        {rate <= 0 && <p className="mt-2 text-[12px] text-amber-200/70">Redemption is currently disabled by admin.</p>}
      </div>

      <div className="card mb-3 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-white"><Wallet size={15} className="text-sky-300" /> Send balance to a friend</p>
        <div className="grid gap-2">
          <Field label="Friend's email"><Input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="friend@example.com" /></Field>
          <Field label={`Amount (min ${money(Number(settings?.transfer_min || 0), currency())}${feePct ? ` · ${feePct}% fee` : ' · no fee'})`}>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
        </div>
        {Number(amount) > 0 && (
          <p className="mt-1.5 text-[12px] text-white/50">
            They get {money(Number(amount), currency())} · you pay {money(Number(amount) + fee, currency())}{fee ? ` (incl. ${money(fee, currency())} fee)` : ''}
          </p>
        )}
        <Btn onClick={transfer} loading={busy === 'tx'} className="mt-2.5 w-full">Send balance</Btn>
      </div>

      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-white/45">
        Your referrals ({refs.length}) · earned {money(totalEarned, currency())}
      </p>
      {refs.length === 0 ? (
        <EmptyState icon={<Users size={36} />} title="No referrals yet" hint="Share your code — rewards land here instantly." />
      ) : (
        <div className="space-y-1.5">
          {refs.map((r) => (
            <div key={r.id} className="card flex items-center gap-2 p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 font-bold text-violet-200">
                {(r.referred_id || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1 text-[12.5px] text-white/60">{timeAgo(r.created_at)}</span>
              <Badge status="completed">+{money(r.reward, currency())}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
