/* Payment bill: preview modal + PNG download + mobile share. */
import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Btn, Modal, toast } from './ui'
import { Download, Receipt, Share } from './icons'
import { billFilename, downloadBill, renderBill, shareBill } from '../lib/bill'
import { useStore } from '../lib/store'
import { sfx } from '../lib/sound'
import { money } from '../lib/utils'

export function BillModal({ txn, credited, onClose }) {
  const { profile, settings, currency } = useStore()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    try {
      const c = renderBill({
        site: settings?.site_name || 'BoostPanel',
        support: settings?.support_email || '',
        email: profile?.email || '',
        txn: { ...txn, amountFmt: money(txn.amount, currency()) },
        credited: credited != null ? money(credited, currency()) : null,
      })
      canvasRef.current = c
      setUrl(c.toDataURL('image/png'))
    } catch {
      toast('Could not render bill', 'error')
      onClose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dl = async () => {
    if (!canvasRef.current) return
    setBusy('dl')
    try {
      await downloadBill(canvasRef.current, billFilename(txn))
      sfx('success')
      toast('Bill downloaded!')
    } catch (err) {
      toast(err.message, 'error')
    }
    setBusy(null)
  }

  const share = async () => {
    if (!canvasRef.current) return
    setBusy('sh')
    try {
      const r = await shareBill(canvasRef.current, billFilename(txn), 'Payment receipt')
      sfx('success')
      toast(r === 'shared' ? 'Bill shared!' : 'Bill downloaded!')
    } catch (err) {
      if (String(err?.name) !== 'AbortError') toast(err.message, 'error')
    }
    setBusy(null)
  }

  return (
    <Modal title="Payment bill" onClose={onClose}>
      {url ? (
        <img src={url} alt="Payment bill" className="w-full rounded-xl border border-white/10" />
      ) : (
        <p className="py-8 text-center text-sm text-white/40">Rendering…</p>
      )}
      <div className="mt-3 flex gap-2">
        <Btn variant="ghost" onClick={dl} loading={busy === 'dl'} className="flex-1">
          <Download size={15} /> Download
        </Btn>
        <Btn onClick={share} loading={busy === 'sh'} className="flex-1">
          <Share size={15} /> Share
        </Btn>
      </div>
    </Modal>
  )
}

/** Small "Bill" opener — renders only for Jack Bank payments. */
export function BillButton({ txn, credited, className = '' }) {
  const [open, setOpen] = useState(false)
  if (!txn || txn.method !== 'jackbank') return null
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-white/60 hover:text-white ${className}`}
      >
        <Receipt size={12} /> Bill
      </button>
      <AnimatePresence>
        {open && <BillModal txn={txn} credited={credited} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
