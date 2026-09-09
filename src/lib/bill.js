/* ═══════════════════════════════════════════════════════════════
   Payment bill generator — draws a crisp receipt PNG on canvas.
   Pure shapes + text, zero external assets (works offline, no fonts to load).
   ═══════════════════════════════════════════════════════════════ */

const W = 900
const PAD = 56

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fit(ctx, text, maxW, base, weight = 600, family = 'system-ui, sans-serif') {
  let size = base
  ctx.font = `${weight} ${size}px ${family}`
  const s = String(text ?? '')
  while (size > 12 && ctx.measureText(s).width > maxW) {
    size -= 2
    ctx.font = `${weight} ${size}px ${family}`
  }
  return s
}

function stampFor(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'approved' || s === 'paid') return { text: 'PAID', color: '#34d399' }
  if (s === 'pending') return { text: 'PENDING', color: '#fbbf24' }
  return { text: 'FAILED', color: '#fb7185' }
}

/**
 * Render a payment receipt. All money strings must be pre-formatted.
 * Returns the <canvas>.
 */
export function renderBill({
  site = 'BoostPanel',
  support = '',
  email = '',
  txn = {},
  credited = null,
  domain = 'jackbhai.github.io/boostpanel',
}) {
  const stamp = stampFor(txn.status)
  const rows = [
    ['Receipt no', `BILL-${txn.id || '—'}`],
    ['Date', txn.created_at ? new Date(txn.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'],
    ['Billed to', email || '—'],
    ['Method', 'Jack Bank · Instant'],
    ['Gateway order', txn.txn_ref || '—'],
    ['Txn ID', txn.id ? `#${txn.id}` : '—'],
    ['Amount paid', txn.amountFmt || String(txn.amount ?? '—')],
  ]
  const H = 1010 + rows.length * 0 // fixed generous height
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')

  /* backdrop */
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)
  const cardX = 28
  const cardW = W - 56
  ctx.fillStyle = '#0B0B0D'
  rr(ctx, cardX, 28, cardW, H - 56, 36)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.stroke()

  /* header gradient strip */
  const g = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0)
  g.addColorStop(0, '#8b5cf6')
  g.addColorStop(1, '#d946ef')
  ctx.fillStyle = g
  rr(ctx, cardX, 28, cardW, 14, 7)
  ctx.fill()

  let y = 130
  /* logo mark */
  ctx.fillStyle = g
  rr(ctx, PAD, y - 52, 76, 76, 20)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 44px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('B', PAD + 22, y - 12)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  fit(ctx, site, 420, 46, 800)
  ctx.fillText(site, PAD + 100, y - 28)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '600 24px system-ui, sans-serif'
  ctx.fillText('PAYMENT RECEIPT', PAD + 100, y + 12)

  /* stamp */
  ctx.save()
  ctx.translate(W - PAD - 130, y - 10)
  ctx.rotate(-0.18)
  ctx.strokeStyle = stamp.color
  ctx.lineWidth = 4
  ctx.font = '800 34px system-ui, sans-serif'
  const tw = ctx.measureText(stamp.text).width
  rr(ctx, -tw / 2 - 26, -32, tw + 52, 64, 10)
  ctx.stroke()
  ctx.fillStyle = stamp.color
  ctx.textAlign = 'center'
  ctx.fillText(stamp.text, 0, 2)
  ctx.restore()
  ctx.textAlign = 'left'

  /* divider */
  y += 78
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 8])
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  ctx.setLineDash([])

  /* rows */
  y += 46
  for (const [k, v] of rows) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '600 23px system-ui, sans-serif'
    ctx.fillText(k, PAD, y)
    ctx.fillStyle = '#ffffff'
    const label = fit(ctx, v, W - PAD * 2 - 300, 25, 700)
    const vw = ctx.measureText(label).width
    ctx.fillText(label, W - PAD - vw, y)
    y += 52
  }

  /* total band */
  y += 14
  ctx.fillStyle = 'rgba(52,211,153,0.08)'
  rr(ctx, PAD, y - 34, W - PAD * 2, 104, 18)
  ctx.fill()
  ctx.strokeStyle = 'rgba(52,211,153,0.3)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#a7f3d0'
  ctx.font = '700 24px system-ui, sans-serif'
  ctx.fillText(credited != null ? 'Total credited (incl. bonus)' : 'Status', PAD + 26, y + 16)
  ctx.fillStyle = stamp.color
  const total = fit(ctx, credited != null ? credited : stamp.text, 380, 40, 800)
  const totalW = ctx.measureText(total).width
  ctx.fillText(total, W - PAD - 26 - totalW, y + 18)

  /* footer */
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '500 21px system-ui, sans-serif'
  ctx.textAlign = 'center'
  const fy = H - 120
  if (support) ctx.fillText(`Support: ${support}`, W / 2, fy)
  ctx.fillText(domain, W / 2, fy + 34)
  ctx.font = '500 19px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText('This is a computer-generated receipt.', W / 2, fy + 66)
  ctx.textAlign = 'left'

  return c
}

export function billFilename(txn) {
  return `BoostPanel-bill-${txn?.id || 'receipt'}.png`
}

function canvasBlob(canvas) {
  return new Promise((res) => canvas.toBlob(res, 'image/png'))
}

export async function downloadBill(canvas, filename) {
  const blob = await canvasBlob(canvas)
  if (!blob) throw new Error('Could not generate image')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Returns 'shared' | 'downloaded'. */
export async function shareBill(canvas, filename, title = 'Payment receipt') {
  const blob = await canvasBlob(canvas)
  if (!blob) throw new Error('Could not generate image')
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title })
    return 'shared'
  }
  await downloadBill(canvas, filename)
  return 'downloaded'
}
