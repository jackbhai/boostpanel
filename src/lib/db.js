import { supabase } from './supabase'
import { apiKey, calcCharge } from './utils'
import { bust, cached } from './cache'
import { clean, cleanEmail } from './security'

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
  const { data, error } = await sb().auth.signUp({ email: cleanEmail(email), password })
  if (error) throw new Error(error.message)
  if (!data.session) return { needsVerification: true }
  const profile = await ensureProfile(data.user)
  return { user: { id: data.user.id, email: data.user.email }, profile }
}

export async function signIn(email, password) {
  const { data, error } = await sb().auth.signInWithPassword({ email: cleanEmail(email), password })
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
  if (!newPw || newPw.length < 8) throw new Error('New password must be at least 8 characters')
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
  const res = await secure('balance.adjust', { user_id: userId, delta: Number(delta), note })
  return res.balance
}

/* ---------------------------- CATALOG ----------------------------- */

export async function getCatalog() {
  return cached('catalog', async () => {
    const [cats, svcs] = await Promise.all([
      row(sb().from('categories').select('*').order('sort')),
      row(sb().from('services').select('*').order('id')),
    ])
    return { categories: cats, services: svcs }
  }, 60000)
}

export async function saveCategory(cat) {
  bust('catalog')
  cat = { ...cat, name: clean(cat.name, 120) }
  if (cat.id) return row(sb().from('categories').update(cat).eq('id', cat.id).select().single())
  const { id, ...rest } = cat
  return row(sb().from('categories').insert(rest).select().single())
}

export async function deleteCategory(id) {
  bust('catalog')
  await row(sb().from('categories').delete().eq('id', id))
}

export async function saveService(svc) {
  bust('catalog')
  svc = { ...svc, name: clean(svc.name, 200), description: clean(svc.description, 4000), platform: clean(svc.platform, 80), type: clean(svc.type, 80), quality: clean(svc.quality, 80), avg_time: clean(svc.avg_time, 40) }
  const { data } = await sb().from('services').select('id').eq('id', svc.id).maybeSingle()
  if (data) return row(sb().from('services').update(svc).eq('id', svc.id).select().single())
  return row(sb().from('services').insert(svc).select().single())
}

export async function deleteService(id) {
  bust('catalog')
  await row(sb().from('services').delete().eq('id', id))
}

/* --------------------- PROVIDER BRIDGE (server) --------------------- */

export async function bridge(payload) {
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

/* Call the `secure` Edge Function — the ONLY server-side writer of money. */
async function secure(op, params = {}) {
  const { data, error } = await sb().functions.invoke('secure', { body: { op, ...params } })
  if (error) throw new Error(error.message || 'Secure request failed')
  if (data?.error) throw new Error(data.error)
  return data
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
    cost_rate: Number(s.rate) || 0,
    margin_pct: Number(markupPct || 0),
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

export async function placeOrder(userId, service, link, quantity, opts = {}) {
  const qty = Number(quantity)
  if (!link || !link.startsWith('http')) throw new Error('Please enter a valid link starting with http')
  if (!Number.isInteger(qty) || qty < service.min_qty || qty > service.max_qty) {
    throw new Error(`Quantity must be between ${service.min_qty.toLocaleString()} and ${service.max_qty.toLocaleString()}`)
  }
  // Price is computed SERVER-side from the live DB rate — never trusted from client.
  const res = await secure('order.create', {
    service_id: service.id, link, quantity: qty,
    runs: opts.runs || 0, interval_mins: opts.interval_mins || 0,
    coupon_code: opts.coupon_code || '',
  })
  return { order: res.order, forwarded: res.forwarded, charge: res.charge, provider_error: res.provider_error, discount: res.discount, loyalty_earned: res.loyalty_earned, coupon: res.coupon }
}

export async function getUserOrders(userId) {
  return row(sb().from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }))
}

export async function getAllOrders() {
  return row(sb().from('orders').select('*').order('created_at', { ascending: false }).limit(500))
}

/* refunds are computed server-side inside the `secure` edge fn */

export async function setOrderStatus(order, status, remains = null) {
  const id = typeof order === 'object' ? order.id : order
  return secure('admin.order_set', { order_id: id, status, remains })
}

export async function cancelOrder(order) {
  const id = typeof order === 'object' ? order.id : order
  return secure('order.cancel', { order_id: id })
}

export async function refillOrder(order) {
  const id = typeof order === 'object' ? order.id : order
  return secure('order.refill', { order_id: id })
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

/* createTxn removed — every ledger write goes through the `secure` edge fn */

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
  const res = await secure('funds.request', {
    amount: Math.round(amt * 100) / 100, method, txn_ref: txn_ref.trim(), screenshot_url,
  })
  return res.txn
}

export async function getUserTxns(userId) {
  return row(sb().from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }))
}

export async function getAllTxns() {
  return row(sb().from('transactions').select('*').order('created_at', { ascending: false }).limit(500))
}

export async function approveTopup(txn) {
  const id = typeof txn === 'object' ? txn.id : txn
  return secure('funds.approve', { txn_id: id })
}

export async function rejectTopup(txn) {
  const id = typeof txn === 'object' ? txn.id : txn
  return secure('funds.reject', { txn_id: id })
}

/* ----------------------------- TICKETS ----------------------------- */

export async function createTicket(userId, { subject, order_id, priority, message }) {
  const subj = clean(subject, 140), body = clean(message, 4000)
  if (!subj || !body) throw new Error('Subject and message are required')
  const ticket = await row(sb().from('tickets').insert({
    user_id: userId, subject: subj, order_id: order_id || null,
    status: 'open', priority: priority || 'medium',
  }).select().single())
  await addTicketMessage(ticket.id, userId, 'user', body)
  return ticket
}

export async function addTicketMessage(ticketId, senderId, senderRole, message) {
  const body = clean(message, 4000)
  if (!body) throw new Error('Message cannot be empty')
  const msg = await row(sb().from('ticket_messages').insert({
    ticket_id: ticketId, sender_id: senderId, sender_role: senderRole, message: body,
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
  const a = { ...ann, title: clean(ann.title, 140), body: clean(ann.body, 4000) }
  if (a.id) return row(sb().from('announcements').update(a).eq('id', a.id).select().single())
  return row(sb().from('announcements').insert(a).select().single())
}

export async function deleteAnnouncement(id) {
  await row(sb().from('announcements').delete().eq('id', id))
}

/* ---------------------------- SETTINGS ----------------------------- */

const DEFAULT_SETTINGS = {
  site_name: 'BoostPanel', currency: '₹', min_deposit: 100, support_email: '', notice: '',
  upi_id: '', upi_payee: 'BoostPanel', pay_upi: true, pay_card: false, pay_crypto: false,
  card_info: '', crypto_info: '', bank_info: '', signup_bonus: 0, maintenance: false, deposit_bonus_pct: 0,
  pay_bank: false, referral_reward: 0, loyalty_per_100: 0, loyalty_redeem_rate: 0,
  transfer_min: 0, transfer_fee_pct: 0, max_active_orders: 0, ticket_sla_hours: 24,
}

export async function getSettings() {
  return cached('settings', async () => {
    const { data } = await sb().from('settings').select('*').eq('id', 1).maybeSingle()
    return { ...DEFAULT_SETTINGS, ...(data || {}) }
  }, 60000)
}

export async function saveSettings(patch) {
  bust('settings')
  const p2 = { ...patch }
  for (const k of ['site_name', 'notice', 'support_email', 'upi_id', 'upi_payee', 'card_info', 'crypto_info', 'bank_info']) {
    if (typeof p2[k] === 'string') p2[k] = clean(p2[k], 2000)
  }
  return row(sb().from('settings').update(p2).eq('id', 1).select().single())
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

/* ------------------------- ADMIN CONTROLS ------------------------- */

/** Server-side manual order (admin). Charge computed from live rate. */
export async function manualOrder({ user_id, service_id, link, quantity }) {
  return secure('admin.order_create', { user_id, service_id, link, quantity })
}

/** Server-side user update: role / status / discount / limits / note. */
export async function updateUserAdmin(userId, patch) {
  return secure('admin.user_update', { user_id: userId, ...patch })
}

/** Re-apply stored margins on fresh provider rates. */
export async function resyncProvider(providerId) {
  return bridge({ action: 'resync', provider_id: providerId })
}

/** Append-only audit log (admin). */
export async function getAdminLogs(limit = 300) {
  return row(sb().from('admin_logs').select('*').order('id', { ascending: false }).limit(limit))
}

/* --------------------------- FAVORITES ---------------------------- */

export async function getFavorites(userId) {
  const rows = await row(sb().from('favorites').select('service_id').eq('user_id', userId))
  return rows.map((r) => r.service_id)
}

export async function toggleFavorite(userId, serviceId, on) {
  if (on) await row(sb().from('favorites').insert({ user_id: userId, service_id: serviceId }))
  else await row(sb().from('favorites').delete().eq('user_id', userId).eq('service_id', serviceId))
}

/* ════════════════ v4 · coupons / referrals / loyalty / notifications / reviews ════════════════ */
export const listCoupons = () => row(sb().from('coupons').select('*').order('created_at', { ascending: false }))
export const saveCoupon = (c) => {
  const payload = { code: clean(c.code, 40).toUpperCase(), kind: c.kind || 'pct', value: +c.value || 0, active: c.active !== false, public: c.public !== false, max_uses: +c.max_uses || 0, min_charge: +c.min_charge || 0, expires_at: c.expires_at || null }
  const q = c.id ? sb().from('coupons').update(payload).eq('id', c.id) : sb().from('coupons').insert(payload)
  return row(q.select().single())
}
export const deleteCoupon = (id) => row(sb().from('coupons').delete().eq('id', id))
export const toggleCoupon = (id, active) => row(sb().from('coupons').update({ active }).eq('id', id))
export const claimReferral = (code) => secure('referral.claim', { code })
export const myReferrals = (userId) => row(sb().from('referrals').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }))
export const convertLoyalty = (points) => secure('loyalty.convert', { points })
export const sendTransfer = (to_email, amount) => secure('transfer.send', { to_email: cleanEmail(to_email), amount })
export const listNotifications = (userId, limit = 100) => row(sb().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit))
export const markNotifRead = (ids) => row(sb().from('notifications').update({ read: true }).in('id', Array.isArray(ids) ? ids : [ids]))
export const markAllNotifsRead = (userId) => row(sb().from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false))
export const deleteNotif = (id) => row(sb().from('notifications').delete().eq('id', id))
export const clearReadNotifs = (userId) => row(sb().from('notifications').delete().eq('user_id', userId).eq('read', true))
export const broadcastSend = (title, body, segment) => secure('broadcast.send', { title: clean(title, 120), body: clean(body, 1000), segment })
export const broadcastHistory = () => row(sb().from('notifications').select('batch, title, body, created_at').eq('is_broadcast', true).order('created_at', { ascending: false }).limit(200))
export const createReview = (order_id, rating, text) => secure('review.create', { order_id, rating, text: clean(text, 500) })
export const myReviews = (userId) => row(sb().from('reviews').select('*').eq('user_id', userId).order('created_at', { ascending: false }))
export const listApprovedReviews = (serviceId) => row(sb().from('reviews').select('rating, text, created_at').eq('service_id', serviceId).eq('approved', true).order('created_at', { ascending: false }).limit(50))
export const reviewAggregate = () => row(sb().from('reviews').select('service_id, rating').eq('approved', true).limit(5000))
export const listReviewsAdmin = () => row(sb().from('reviews').select('*, services(name)').order('created_at', { ascending: false }).limit(300))
export const approveReview = (id, approved) => row(sb().from('reviews').update({ approved }).eq('id', id))
export const deleteReviewAdmin = (id) => row(sb().from('reviews').delete().eq('id', id))
export const replyReview = (id, text) => row(sb().from('reviews').update({ admin_reply: text }).eq('id', id))
export const rateTicket = (ticket_id, rating) => secure('ticket.rate', { ticket_id, rating })
export const flagTxn = (txn_id, flagged, note) => secure('funds.flag', { txn_id, flagged, note })
export const orderEvents = (orderId) => row(sb().from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: true }))
export const orderNoteAdmin = (orderId, text) => row(sb().from('order_events').insert({ order_id: orderId, event: 'note', detail: clean(text, 2000) }).select().single())
export const toggleServiceAdmin = (service_id, active) => secure('service.toggle', { service_id, active })
export const deleteAccountSelf = () => secure('account.delete_self', { confirm: 'DELETE' })
export const setEmailSelfClean = (email) => setEmailSelf(cleanEmail(email))
export const setEmailSelf = (email) => secure('account.set_email', { email })

/* ════════════════ v4 · content (faqs / macros / library / events) ════════════════ */
export const listFaqs = () => row(sb().from('faqs').select('*').order('sort', { ascending: true }))
export const listFaqsPublic = () => row(sb().from('faqs').select('*').eq('published', true).order('sort', { ascending: true }))
export const saveFaq = (f) => {
  const payload = { question: clean(f.question, 500), answer: clean(f.answer, 6000), q: clean(f.question, 500), a: clean(f.answer, 6000), category: f.category || 'General', published: !!f.published, sort: +f.sort || 0 }
  const q = f.id ? sb().from('faqs').update(payload).eq('id', f.id) : sb().from('faqs').insert(payload)
  return row(q.select().single())
}
export const deleteFaq = (id) => row(sb().from('faqs').delete().eq('id', id))
export const listMacros = () => row(sb().from('macros').select('*').order('title'))
export const saveMacro = (m) => {
  const q = m.id ? sb().from('macros').update({ title: clean(m.title, 120), body: clean(m.body, 2000) }).eq('id', m.id) : sb().from('macros').insert({ title: clean(m.title, 120), body: clean(m.body, 2000) })
  return row(q.select().single())
}
export const deleteMacro = (id) => row(sb().from('macros').delete().eq('id', id))
export const listLibraryAdmin = () => row(sb().from('library').select('*').order('sort'))
export const listLibraryPublic = () => row(sb().from('library').select('*').eq('published', true).order('sort'))
export const saveLibrary = (l) => {
  const payload = { title: clean(l.title, 160), body: clean(l.body, 12000), category: l.category || 'Guide', published: !!l.published, sort: +l.sort || 0 }
  const q = l.id ? sb().from('library').update(payload).eq('id', l.id) : sb().from('library').insert(payload)
  return row(q.select().single())
}
export const deleteLibrary = (id) => row(sb().from('library').delete().eq('id', id))
export const listEventsAdmin = () => row(sb().from('events').select('*').order('starts_at'))
export const listEventsPublic = () => row(sb().from('events').select('*').eq('published', true).order('starts_at'))
export const saveEvent = (e) => {
  const payload = { title: clean(e.title, 160), body: clean(e.body, 6000) || '', starts_at: e.starts_at || null, ends_at: e.ends_at || null, published: !!e.published }
  const q = e.id ? sb().from('events').update(payload).eq('id', e.id) : sb().from('events').insert(payload)
  return row(q.select().single())
}
export const deleteEvent = (id) => row(sb().from('events').delete().eq('id', id))

/* ════════════════ v4 · alerts / sessions / api insight / risk ════════════════ */
export const myAlerts = (userId) => row(sb().from('service_alerts').select('*, services(name, rate)').eq('user_id', userId).order('created_at', { ascending: false }))
export const addAlert = (user_id, service_id, kind, threshold) => row(sb().from('service_alerts').insert({ user_id, service_id, kind, threshold: +threshold || 0 }).select().single())
export const deleteAlert = (id) => row(sb().from('service_alerts').delete().eq('id', id))
export const mySessions = (userId) => row(sb().from('sessions').select('*').eq('user_id', userId).order('last_seen', { ascending: false }).limit(20))
export const touchSession = (user_id, device) => row(sb().from('sessions').upsert({ user_id, device: (device || 'Web').slice(0, 120), last_seen: new Date().toISOString(), ip: '' }, { onConflict: 'user_id,device' }).select().single())
export const killSession = (id) => row(sb().from('sessions').delete().eq('id', id))
export const apiLogsAdmin = (limit = 300) => row(sb().from('api_logs').select('*').order('created_at', { ascending: false }).limit(limit))
export const myApiLogs = (userId, limit = 100) => row(sb().from('api_logs').select('action, ok, ms, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit))
export const balanceLogs = (providerId) => row(sb().from('provider_balance_logs').select('*').eq('provider_id', providerId).order('created_at', { ascending: false }).limit(60))
export const flaggedTxns = () => row(sb().from('transactions').select('*').eq('flagged', true).order('created_at', { ascending: false }).limit(200))
export const searchOrdersAdmin = (term) => row(sb().from('orders').select('*').or(`link.ilike.%${term}%`).order('created_at', { ascending: false }).limit(50))
export const searchUsersAdmin = (term) => row(sb().from('profiles').select('id, email, balance, role, status, created_at').or(`email.ilike.%${term}%,id.eq.${term}`).limit(20))

/* ════════════════ v5 · TOTP two-factor auth (Supabase MFA) ════════════════ */
export async function mfaFactors() {
  const { data, error } = await sb().auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  return data?.totp || data?.all || []
}
export async function mfaEnroll() {
  const { data, error } = await sb().auth.mfa.enroll({ factorType: 'totp', friendlyName: 'BoostPanel' })
  if (error) throw new Error(error.message)
  return data
}
export async function mfaVerifyEnroll(factorId, code) {
  const { error } = await sb().auth.mfa.challengeAndVerify({ factorId, code: String(code).trim() })
  if (error) throw new Error(error.message || 'Invalid code')
}
export async function mfaUnenroll(factorId) {
  const { error } = await sb().auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}
export async function mfaAal() {
  const { data, error } = await sb().auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw new Error(error.message)
  return data
}
/** Verify TOTP code during login (aal1 → aal2 step-up). */
export async function mfaVerifyLogin(code) {
  const factors = await mfaFactors()
  const f = factors.find((x) => x.status === 'verified') || factors[0]
  if (!f) throw new Error('No 2FA method enrolled')
  const { error } = await sb().auth.mfa.challengeAndVerify({ factorId: f.id, code: String(code).trim() })
  if (error) throw new Error(error.message || 'Invalid 2FA code')
}

/* ════════════════ v5 · security event log + key rotation ════════════════ */
export const logSecEvent = (userId, kind, detail = '') => row(sb().from('security_events').insert({ user_id: userId, kind, detail: String(detail).slice(0, 300) }))
export const listSecEvents = (userId, limit = 15) => row(sb().from('security_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit))
export const rotateApiKey = (userId) => regenerateApiKey(userId)

/* ════════════════ v5 · Jack Bank gateway ════════════════ */
export const gatewayStatus = () => secure('gateway.status', {})
export const gatewayTest = (keys = {}) => secure('gateway.test', keys)
export const gatewayCreate = (amount) => secure('gateway.create', { amount })
export const gatewayCheck = (txn_id) => secure('gateway.check', { txn_id })
export const getGatewayConfig = () => row(sb().from('gateway_config').select('*').eq('id', 1).maybeSingle())
export const saveGatewayConfig = (patch) => row(sb().from('gateway_config').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1).select().single())
