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
  const res = await secure('balance.adjust', { user_id: userId, delta: Number(delta), note })
  return res.balance
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
  return { order: res.order, forwarded: res.forwarded, charge: res.charge, provider_error: res.provider_error }
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
  card_info: '', crypto_info: '', bank_info: '', signup_bonus: 0, maintenance: false, deposit_bonus_pct: 0,
  pay_bank: false, referral_reward: 0, loyalty_per_100: 0, loyalty_redeem_rate: 0,
  transfer_min: 0, transfer_fee_pct: 0, max_active_orders: 0, ticket_sla_hours: 24,
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
export const listCoupons = () => row('coupons', q => q.select('*').order('created_at', { ascending: false }))
export const saveCoupon = (c) => c.id
  ? row('coupons', q => q.update({ code: c.code, kind: c.kind, value: +c.value || 0, active: !!c.active, max_uses: +c.max_uses || 0, min_charge: +c.min_charge || 0, expires_at: c.expires_at || null }).eq('id', c.id).select().single())
  : row('coupons', q => q.insert({ code: (c.code || '').toUpperCase(), kind: c.kind || 'pct', value: +c.value || 0, active: c.active !== false, max_uses: +c.max_uses || 0, min_charge: +c.min_charge || 0, expires_at: c.expires_at || null }).select().single())
export const deleteCoupon = (id) => row('coupons', q => q.delete().eq('id', id))
export const toggleCoupon = (id, active) => row('coupons', q => q.update({ active }).eq('id', id))
export const claimReferral = (code) => secure('referral.claim', { code })
export const myReferrals = (userId) => row('referrals', q => q.select('*').eq('referrer_id', userId).order('created_at', { ascending: false }))
export const convertLoyalty = (points) => secure('loyalty.convert', { points })
export const sendTransfer = (to_email, amount) => secure('transfer.send', { to_email, amount })
export const listNotifications = (userId, limit = 100) => row('notifications', q => q.select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit))
export const markNotifRead = (ids) => row('notifications', q => q.update({ read: true }).in('id', Array.isArray(ids) ? ids : [ids]))
export const markAllNotifsRead = (userId) => row('notifications', q => q.update({ read: true }).eq('user_id', userId).eq('read', false))
export const deleteNotif = (id) => row('notifications', q => q.delete().eq('id', id))
export const clearReadNotifs = (userId) => row('notifications', q => q.delete().eq('user_id', userId).eq('read', true))
export const broadcastSend = (title, body, segment) => secure('broadcast.send', { title, body, segment })
export const broadcastHistory = () => row('notifications', q => q.select('batch, title, body, created_at').eq('is_broadcast', true).order('created_at', { ascending: false }).limit(200))
export const createReview = (order_id, rating, text) => secure('review.create', { order_id, rating, text })
export const myReviews = (userId) => row('reviews', q => q.select('*, services(name)').eq('user_id', userId).order('created_at', { ascending: false }))
export const listApprovedReviews = (serviceId) => row('reviews', q => q.select('rating, text, created_at, profiles!inner(email)').eq('service_id', serviceId).eq('approved', true).order('created_at', { ascending: false }).limit(50))
export const reviewAggregate = () => row('reviews', q => q.select('service_id, rating').eq('approved', true).limit(5000))
export const listReviewsAdmin = () => row('reviews', q => q.select('*, services(name)').order('created_at', { ascending: false }).limit(300))
export const approveReview = (id, approved) => row('reviews', q => q.update({ approved }).eq('id', id))
export const deleteReviewAdmin = (id) => row('reviews', q => q.delete().eq('id', id))
export const replyReview = (id, text) => row('reviews', q => q.update({ admin_reply: text }).eq('id', id))
export const rateTicket = (ticket_id, rating) => secure('ticket.rate', { ticket_id, rating })
export const flagTxn = (txn_id, flagged, note) => secure('funds.flag', { txn_id, flagged, note })
export const orderEvents = (orderId) => row('order_events', q => q.select('*').eq('order_id', orderId).order('created_at', { ascending: true }))
export const orderNoteAdmin = (orderId, text) => row('order_events', q => q.insert({ order_id: orderId, event: 'note', detail: text }).select().single())
export const toggleServiceAdmin = (service_id, active) => secure('service.toggle', { service_id, active })
export const deleteAccountSelf = () => secure('account.delete_self', { confirm: 'DELETE' })
export const setEmailSelf = (email) => secure('account.set_email', { email })

/* ════════════════ v4 · content (faqs / macros / library / events) ════════════════ */
export const listFaqs = () => row('faqs', q => q.select('*').order('sort', { ascending: true }))
export const listFaqsPublic = () => row('faqs', q => q.select('*').eq('published', true).order('sort', { ascending: true }))
export const saveFaq = (f) => f.id
  ? row('faqs', q => q.update({ question: f.question, answer: f.answer, category: f.category || 'General', published: !!f.published, sort: +f.sort || 0 }).eq('id', f.id).select().single())
  : row('faqs', q => q.insert({ question: f.question, answer: f.answer, category: f.category || 'General', published: f.published !== false, sort: +f.sort || 0 }).select().single())
export const deleteFaq = (id) => row('faqs', q => q.delete().eq('id', id))
export const listMacros = () => row('macros', q => q.select('*').order('title'))
export const saveMacro = (m) => m.id
  ? row('macros', q => q.update({ title: m.title, body: m.body }).eq('id', m.id).select().single())
  : row('macros', q => q.insert({ title: m.title, body: m.body }).select().single())
export const deleteMacro = (id) => row('macros', q => q.delete().eq('id', id))
export const listLibraryAdmin = () => row('library', q => q.select('*').order('sort'))
export const listLibraryPublic = () => row('library', q => q.select('*').eq('published', true).order('sort'))
export const saveLibrary = (l) => l.id
  ? row('library', q => q.update({ title: l.title, body: l.body, category: l.category || 'Guide', published: !!l.published, sort: +l.sort || 0 }).eq('id', l.id).select().single())
  : row('library', q => q.insert({ title: l.title, body: l.body, category: l.category || 'Guide', published: l.published !== false, sort: +l.sort || 0 }).select().single())
export const deleteLibrary = (id) => row('library', q => q.delete().eq('id', id))
export const listEventsAdmin = () => row('events', q => q.select('*').order('starts_at'))
export const listEventsPublic = () => row('events', q => q.select('*').eq('published', true).order('starts_at'))
export const saveEvent = (e) => e.id
  ? row('events', q => q.update({ title: e.title, body: e.body || '', starts_at: e.starts_at || null, ends_at: e.ends_at || null, published: !!e.published }).eq('id', e.id).select().single())
  : row('events', q => q.insert({ title: e.title, body: e.body || '', starts_at: e.starts_at || null, ends_at: e.ends_at || null, published: e.published !== false }).select().single())
export const deleteEvent = (id) => row('events', q => q.delete().eq('id', id))

/* ════════════════ v4 · alerts / sessions / api insight / risk ════════════════ */
export const myAlerts = (userId) => row('service_alerts', q => q.select('*, services(name, rate)').eq('user_id', userId).order('created_at', { ascending: false }))
export const addAlert = (user_id, service_id, kind, threshold) => row('service_alerts', q => q.insert({ user_id, service_id, kind, threshold: +threshold || 0 }).select().single())
export const deleteAlert = (id) => row('service_alerts', q => q.delete().eq('id', id))
export const mySessions = (userId) => row('sessions', q => q.select('*').eq('user_id', userId).order('last_seen', { ascending: false }).limit(20))
export const touchSession = (user_id, device) => row('sessions', q => q.upsert({ user_id, device: (device || 'Web').slice(0, 120), last_seen: new Date().toISOString(), ip: '' }, { onConflict: 'user_id,device' }).select().single())
export const killSession = (id) => row('sessions', q => q.delete().eq('id', id))
export const apiLogsAdmin = (limit = 300) => row('api_logs', q => q.select('*').order('created_at', { ascending: false }).limit(limit))
export const myApiLogs = (userId, limit = 100) => row('api_logs', q => q.select('action, ok, ms, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit))
export const balanceLogs = (providerId) => row('provider_balance_logs', q => q.select('*').eq('provider_id', providerId).order('created_at', { ascending: false }).limit(60))
export const flaggedTxns = () => row('transactions', q => q.select('*').eq('flagged', true).order('created_at', { ascending: false }).limit(200))
export const searchOrdersAdmin = (term) => row('orders', q => q.select('*').or(`link.ilike.%${term}%`).order('created_at', { ascending: false }).limit(50))
export const searchUsersAdmin = (term) => row('profiles', q => q.select('id, email, balance, role, status, created_at').or(`email.ilike.%${term}%,id.eq.${term}`).limit(20))
