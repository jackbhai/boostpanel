import QRCode from 'qrcode'

/**
 * Build an NPCI-compliant UPI deep link, e.g.
 * upi://pay?pa=shop@okhdfc&pn=BoostPanel&am=500.00&cu=INR&tn=...&tr=...
 * Scanned by GPay / PhonePe / Paytm / BHIM — amount comes pre-filled.
 */
export function upiUrl({ pa, pn, amount, note, ref }) {
  if (!pa) throw new Error('Admin has not added a UPI ID yet')
  const params = new URLSearchParams({
    pa: pa.trim(),
    pn: (pn || 'BoostPanel').trim(),
    am: Number(amount).toFixed(2),
    cu: 'INR',
  })
  if (note) params.set('tn', note)
  if (ref) params.set('tr', ref)
  // NPCI parsers are strict: use %20 (not +) for spaces
  return `upi://pay?${params.toString().replaceAll('+', '%20')}`
}

/** Render the UPI link as a QR data-URL (works fully offline). */
export async function upiQrDataUrl(upiLink, size = 512) {
  return QRCode.toDataURL(upiLink, {
    width: size,
    margin: 2,
    color: { dark: '#0b0f1a', light: '#ffffff' },
  })
}

/** UPI UTR / Ref ID = exactly 12 digits on real panels. */
export function isValidUtr(ref) {
  return /^\d{12}$/.test(String(ref || '').trim())
}
