import { supabase } from './supabase'
import { apiKey, calcCharge } from './utils'

/* =====================================================================
   BoostPanel data layer — 100% REAL Supabase backend.
   Provider API forwarding runs through the `provider-proxy` Edge Function
   (server-side, so provider keys + user balances stay secure).
   ===================================================================== */

function sb() {
  if (!supabase) throw new Error('Backend not configured. Add Supabase keys to .env')
  return supabase
}

async function row(query) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

/* ------------------------------ AUTH ------------------------------ */

async function ensureProfile(user) {
  const { data } = await sb().from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (data) return data
  const profile = await row(sb().from('profiles').insert({
    id: user.id, email: user.email, balance: 0,
    role: 'user', status: 'active', api_key: apiKey(),
  }).select().single())
  // First-ever user becomes admin automatically
  await sb().rpc('claim_first_admin').catch(() => null)
  const fresh = await sb().from('profiles').select('*').eq('id', user.id).maybeSingle()
  return fresh.data || profile
}

export async function signUp(email, password) {
  const { data, error } = await sb().auth.signUp({ email: email.trim(), password })
  if (error) throw new Error(error.message)
  if (!data.session) return { needsVerification: true }
  const profile = await ensureProfile(data.user)
  return { user: { id: data.user.id, email: data.user.email }, profile }
}

export async function signIn(email, password) {
  const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(error.message)
  const profile = await ensureProfile(data.user)
  if (profile?.status === 'banned') {
    await sb().auth.signOut()
    throw new Error('This account has been banned.')
  }
  return { user: { id: data.user.id, email: data.user.email }, profile }
}

export async function signOut() {
  await sb().auth.signOut()
}

export async function getSessionUser() {
  const { data } = await sb().auth.getSession()
  const u = data?.session?.user
  return u ? { id: u.id, email: u.email } : null
}

export async function changePassword(newPw) {
  if (!newPw || newPw.length < 6) throw new Error('New password must be at least 6 characters')
  const { error } = await sb().auth.updateUser({ password: newPw })
  if (error) throw new Error(error.message)
}

/* ---------------------------- PROFILES ---------------------------- */

export async function getProfile(userId) {
  const { data } = await sb().from('profiles').select('*').eq('id', userId).maybeSingle()
  return data
}

export async function updateProfile(userId, patch) {
  return row(sb().from('profiles').update(patch).eq('id', userId).select().single())
}

export async function regenerateApiKey(userId) {
  return updateProfile(userId, { api_key: apiKey() })
}

export async function listUsers() {
  return row(sb().from('profiles').select('*').order('created_at', { ascending: false }))
}

export async function adjustBalance(userId, delta, note = 'Manual adjustment') {
  const profile = await getProfile(userId)
  if (!profile) throw new Error('User not found')
  const next = Number(profile.balance || 0) + Number(delta)
  if (next < 0) throw new Error('Balance cannot go below zero')
  await updateProfile(userId, { balance: Math.round(next * 100) / 100 })
  await createTxn({
    user_id: userId,
    type: Number(delta) >= 0 ? 'credit' : 'debit',
    amount: Math.abs(Number(delta)),
    method: 'admin',
    status: 'approved',
    note,
  })
  return next
}

/* ---------------------------- CATALOG ----------------------------- */

export async function getCatalog() {
  const [cats, svcs] = await Promise.all([
    row(sb().from('categories').select('*').order('sort')),
    row(sb().from('services').select('*').order('id')),
  ])
  return { categories: cats, services: svcs }
}

export async function saveCategory(cat) {
  if (cat.id) return row(sb().from('categories').update(cat).eq('id', cat.id).select().single())
  const { id, ...rest } = cat
  return row(sb().from('categories').insert(rest).select().single())
}

export async function deleteCategory(id) {
  await row(sb().from('categories').delete().eq('id', id))
}

export async function saveService(svc) {
  const { data } = await sb().from('services').select('id').eq('id', svc.id).maybeSingle()
  if (data) return row(sb().from('services').update(svc).eq('id', svc.id).select().single())
  return row(sb().from('services').insert(svc).select().single())
}

export async function deleteService(id) {
  await row(sb().from('services').delete().eq('id', id))
}

/* --------------------- PROVIDER BRIDGE (server) --------------------- */

async function bridge(payload) {
  try {
    const { data, error } = await sb().functions.invoke('provider-proxy', { body: payload })
    if (error) throw new Error(error.message || 'Bridge request failed')
    if (data?.error) throw new Error(data.error)
    return data
  } catch (err) {
    const msg = String(err.message || err)
    if (/failed to send|fetch|network|not found|404/i.test(msg)) {
      throw new Error('Provider bridge is not deployed yet. Deploy supabase/functions/provider-proxy (see README).')
    }
    throw err
  }
}

/* ---------------------------- PROVIDERS ---------------------------- */

export async function listProviders() {
  return row(sb().from('providers').select('*').order('created_at'))
}

export async function saveProvider(p) {
  const clean = {
    name: p.name?.trim(),
    api_url: p.api_url?.trim().replace(/\/$/, ''),
    api_key: p.api_key?.trim(),
    status: p.status || 'active',
  }
  if (!clean.name || !clean.api_url || !clean.api_key) throw new Error('Name, API URL and API key are required')
  if (p.id) return row(sb().from('providers').update(clean).eq('id', p.id).select().single())
  return row(sb().from('providers').insert(clean).select().single())
}

export async function deleteProvider(id) {
  await row(sb().from('providers').delete().eq('id', id))
}

/** Test credentials + sync remote balance. */
export async function testProvider(providerId) {
  const res = await bridge({ action: 'balance', provider_id: providerId })
  await sb().from('providers').update({
    balance: res.balance ?? 0, currency: res.currency ?? '', last_sync: new Date().toISOString(),
  }).eq('id', providerId)
  return res
}

export async function fetchProviderServices(providerId) {
  const res = await bridge({ action: 'services', provider_id: providerId })
  return res.services || []
}

/** Import provider services as local services with % markup. */
export async function importProviderServices(provider, items, markupPct, categoryId, platformName) {
  if (!items.length) throw new Error('Select at least one service')
  const existing = await row(sb().from('services').select('id').order('id', { ascending: false }).limit(1))
  let nextId = (existing[0]?.id || 100) + 1
  // round up to a clean range for imports
  if (nextId < 1000) nextId = 1000
  const markup = 1 + Number(markupPct || 0) / 100
  const rows = items.map((s) => ({
    id: nextId++,
    category_id: Number(categoryId),
    name: s.name,
    platform: platformName,
    type: s.type || '',
    rate: Math.max(0.01, Math.round(Number(s.rate) * markup * 100) / 100),
    min_qty: Number(s.min) || 1,
    max_qty: Number(s.max) || 100000,
    avg_time: '—',
    refill_days: s.refill ? 30 : 0,
    quality: '',
    active: true,
    description: `Imported from ${provider.name}. Auto-forwarded to provider on order.`,
    provider_id: provider.id,
    provider_service_id: String(s.service),
  }))
  await row(sb().from('services').insert(rows))
  return rows.length
}

/* ----------------------------- ORDERS ----------------------------- */

export async function placeOrder(userId, service, link, quantity) {
  const qty = Number(quantity)
  if (!link || !link.startsWith('http')) throw new Error('Please enter a valid link starting with http')
  if (!Number.isInteger(qty) || qty < service.min_qty || qty > service.max_qty) {
    throw new Error(`Quantity must be between ${service.min_qty.toLocaleString()} and ${service.max_qty.toLocaleString()}`)
  }
  const charge = Math.round(calcCharge(service.rate, qty) * 100) / 100
  const profile = await getProfile(userId)
  if (!profile || profile.status === 'banned') throw new Error('Account is not active')
  if (Number(profile.balance) < charge) throw new Error('Insufficient balance. Please add funds.')

  await updateProfile(userId, { balance: Math.round((Number(profile.balance) - charge) * 100) / 100 })
  const order = await row(sb().from('orders').insert({
    user_id: userId, service_id: service.id, link, quantity: qty,
    charge, status: 'pending', remains: qty, start_count: 0,
    provider_id: service.provider_id || null,
  }).select().single())

  await createTxn({
    user_id: userId, type: 'debit', amount: charge, method: 'order',
    txn_ref: `ORD-${order.id}`, status: 'approved', note: `${service.name} × ${qty.toLocaleString()}`,
  })

  // Auto-forward to provider (server-side). Failure keeps order pending for retry.
  let forwarded = false
  if (service.provider_id && service.provider_service_id) {
    try {
      await bridge({ action: 'forward', order_id: order.id })
      forwarded = true
    } catch (err) {
      console.warn('Provider forward failed (order kept pending):', err.message)
    }
  }
  return { order, forwarded }
}

export async function getUserOrders(userId) {
  return row(sb().from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }))
}

export async function getAllOrders() {
  return row(sb().from('orders').select('*').order('created_at', { ascending: false }).limit(500))
}

async function refundOrder(order, note) {
  const qty = Number(order.quantity || 0)
  const remains = Number(order.remains ?? qty)
  if (!qty) return 0
  const refund = Math.round((Number(order.charge) * remains) / qty * 100) / 100
  if (refund <= 0) return 0
  const profile = await getProfile(order.user_id)
  await updateProfile(order.user_id, { balance: Math.round((Number(profile.balance) + refund) * 100) / 100 })
  await createTxn({
    user_id: order.user_id, type: 'credit', amount: refund, method: 'refund',
    txn_ref: `ORD-${order.id}`, status: 'approved', note,
  })
  return refund
}

export async function setOrderStatus(order, status, remains = null) {
  const patch = { status }
  if (status === 'completed') patch.remains = 0
  else if (remains !== null) patch.remains = Number(remains)
  if (['canceled', 'refunded', 'partial'].includes(status) && !['canceled', 'refunded'].includes(order.status)) {
    await refundOrder({ ...order, ...patch }, `Auto-refund: order #${order.id} → ${status}`)
  }
  return row(sb().from('orders').update(patch).eq('id', order.id).select().single())
}

export async function cancelOrder(order) {
  if (!['pending', 'in_progress', 'processing'].includes(order.status)) {
    throw new Error('Only pending / in-progress orders can be canceled')
  }
  if (order.provider_order_id) {
    try { await bridge({ action: 'cancel', order_id: order.id }) } catch (e) { console.warn(e.message) }
  }
  return setOrderStatus(order, 'canceled')
}

export async function refillOrder(order) {
  if (!['completed', 'partial'].includes(order.status)) throw new Error('Only completed orders can be refilled')
  if (order.provider_order_id) {
    await bridge({ action: 'refill', order_id: order.id })
  }
  return row(sb().from('orders').update({ status: 'in_progress', remains: order.quantity }).eq('id', order.id).select().single())
}

/** Sync one order with provider (auto-forwards first if never sent). */
export async function syncOrder(orderId) {
  return bridge({ action: 'sync', order_ids: [orderId] })
}

/** Sync all live provider-linked orders (server does status + refunds). */
export async function syncAllProviderOrders() {
  const orders = await getAllOrders()
  const ids = orders
    .filter((o) => o.provider_id && ['pending', 'in_progress', 'processing'].includes(o.status))
    .map((o) => o.id)
  if (!ids.length) return { updated: 0, results: [] }
  return bridge({ action: 'sync', order_ids: ids })
}

/* --------------------------- TRANSACTIONS -------------------------- */

export async function createTxn(txn) {
  return row(sb().from('transactions').insert(txn).select().single())
}

/** Upload payment screenshot → returns public URL. */
export async function uploadProof(file, userId) {
  if (!file) throw new Error('Please attach a payment screenshot')
  if (!file.type.startsWith('image/')) throw new Error('Screenshot must be an image file')
  if (file.size > 5 * 1024 * 1024) throw new Error('Screenshot must be under 5 MB')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `proofs/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await sb().storage.from('payment-proofs').upload(path, file, { cacheControl: '3600' })
  if (error) throw new Error(error.message)
  return sb().storage.from('payment-proofs').getPublicUrl(path).data.publicUrl
}

export async function requestTopup(userId, { amount, method, txn_ref, screenshot_url }) {
  const amt = Number(amount)
  if (!amt || amt <= 0) throw new Error('Enter a valid amount')
  if (!txn_ref?.trim()) throw new Error('UTR / Ref ID is required')
  if (!screenshot_url) throw new Error('Payment screenshot is required')
  return createTxn({
    user_id: userId, type: 'credit', amount: Math.round(amt * 100) / 100,
    method, txn_ref: txn_ref.trim(), screenshot_url, status: 'pending', note: '',
  })
}

export async function getUserTxns(userId) {
  return row(sb().from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }))
}

export async function getAllTxns() {
  return row(sb().from('transactions').select('*').order('created_at', { ascending: false }).limit(500))
}

export async function approveTopup(txn) {
  if (txn.status !== 'pending') throw new Error('Only pending requests can be approved')
  const profile = await getProfile(txn.user_id)
  await updateProfile(txn.user_id, { balance: Math.round((Number(profile.balance) + Number(txn.amount)) * 100) / 100 })
  return row(sb().from('transactions').update({ status: 'approved' }).eq('id', txn.id).select().single())
}

export async function rejectTopup(txn) {
  if (txn.status !== 'pending') throw new Error('Only pending requests can be rejected')
  return row(sb().from('transactions').update({ status: 'rejected' }).eq('id', txn.id).select().single())
}

/* ----------------------------- TICKETS ----------------------------- */

export async function createTicket(userId, { subject, order_id, priority, message }) {
  if (!subject?.trim() || !message?.trim()) throw new Error('Subject and message are required')
  const ticket = await row(sb().from('tickets').insert({
    user_id: userId, subject: subject.trim(), order_id: order_id || null,
    status: 'open', priority: priority || 'medium',
  }).select().single())
  await addTicketMessage(ticket.id, userId, 'user', message.trim())
  return ticket
}

export async function addTicketMessage(ticketId, senderId, senderRole, message) {
  if (!message?.trim()) throw new Error('Message cannot be empty')
  const msg = await row(sb().from('ticket_messages').insert({
    ticket_id: ticketId, sender_id: senderId, sender_role: senderRole, message: message.trim(),
  }).select().single())
  await sb().from('tickets').update({ status: senderRole === 'admin' ? 'answered' : 'open' }).eq('id', ticketId)
  return msg
}

export async function getUserTickets(userId) {
  return row(sb().from('tickets').select('*').eq('user_id', userId).order('updated_at', { ascending: false }))
}

export async function getAllTickets() {
  return row(sb().from('tickets').select('*').order('updated_at', { ascending: false }).limit(300))
}

export async function getTicketWithMessages(ticketId) {
  const ticket = await row(sb().from('tickets').select('*').eq('id', ticketId).single())
  const messages = await row(sb().from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at'))
  return { ticket, messages }
}

export async function setTicketStatus(ticketId, status) {
  return row(sb().from('tickets').update({ status }).eq('id', ticketId).select().single())
}

/* ------------------------- ANNOUNCEMENTS --------------------------- */

export async function getAnnouncements(activeOnly = true) {
  const q = sb().from('announcements').select('*').order('created_at', { ascending: false })
  if (activeOnly) q.eq('active', true)
  return row(q)
}

export async function saveAnnouncement(ann) {
  if (ann.id) return row(sb().from('announcements').update(ann).eq('id', ann.id).select().single())
  return row(sb().from('announcements').insert(ann).select().single())
}

export async function deleteAnnouncement(id) {
  await row(sb().from('announcements').delete().eq('id', id))
}

/* ---------------------------- SETTINGS ----------------------------- */

const DEFAULT_SETTINGS = {
  site_name: 'BoostPanel', currency: '₹', min_deposit: 100, support_email: '', notice: '',
  upi_id: '', upi_payee: 'BoostPanel', pay_upi: true, pay_card: false, pay_crypto: false,
  card_info: '', crypto_info: '',
}

export async function getSettings() {
  const { data } = await sb().from('settings').select('*').eq('id', 1).maybeSingle()
  return { ...DEFAULT_SETTINGS, ...(data || {}) }
}

export async function saveSettings(patch) {
  return row(sb().from('settings').update(patch).eq('id', 1).select().single())
}

/* ------------------------------ STATS ------------------------------ */

export async function getUserStats(userId) {
  const orders = await getUserOrders(userId)
  const live = orders.filter((o) => !['canceled', 'refunded'].includes(o.status))
  return {
    totalOrders: orders.length,
    activeOrders: orders.filter((o) => ['pending', 'in_progress', 'processing'].includes(o.status)).length,
    completedOrders: orders.filter((o) => o.status === 'completed').length,
    totalSpent: Math.round(live.reduce((s, o) => s + Number(o.charge || 0), 0) * 100) / 100,
  }
}

export async function getAdminStats() {
  const [orders, txns, users, tickets] = await Promise.all([getAllOrders(), getAllTxns(), listUsers(), getAllTickets()])
  const revenue = orders
    .filter((o) => !['canceled', 'refunded'].includes(o.status))
    .reduce((s, o) => s + Number(o.charge || 0), 0)
  const days = [...Array(7)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d
  })
  const series = days.map((d) => {
    const k = d.toISOString().slice(0, 10)
    const dayOrders = orders.filter((o) => String(o.created_at).slice(0, 10) === k)
    return {
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      orders: dayOrders.length,
      revenue: Math.round(dayOrders.filter((o) => !['canceled', 'refunded'].includes(o.status)).reduce((s, o) => s + Number(o.charge || 0), 0)),
    }
  })
  return {
    users: users.length,
    orders: orders.length,
    revenue: Math.round(revenue * 100) / 100,
    pendingFunds: txns.filter((t) => t.status === 'pending' && t.type === 'credit').length,
    openTickets: tickets.filter((t) => t.status === 'open').length,
    series,
  }
}
