// ─────────────────────────────────────────────────────────────
// BoostPanel provider bridge — runs SERVER-SIDE on Supabase Edge.
// Forwards orders to Perfect-Panel-compatible provider APIs,
// syncs statuses + auto-refunds, imports service lists.
// Provider API keys NEVER leave the server.
// Deploy: npx supabase functions deploy provider-proxy --project-ref <ref>
// ─────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Call a Perfect Panel style API: POST form { key, action, ...params } */
async function providerCall(apiUrl: string, apiKey: string, action: string, params: Record<string, string> = {}) {
  const form = new URLSearchParams({ key: apiKey, action, ...params })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'BoostPanel/2.0' },
      body: form.toString(),
      signal: ctrl.signal,
    })
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`Provider returned non-JSON (HTTP ${res.status}): ${text.slice(0, 120)}`)
    }
  } finally {
    clearTimeout(timer)
  }
}

function mapStatus(s: string): string {
  const t = String(s || '').toLowerCase().replace(/[\s_-]+/g, '')
  if (['pending', 'awaiting'].includes(t)) return 'pending'
  if (['inprogress', 'processing', 'active', 'started'].includes(t)) return 'in_progress'
  if (['completed', 'complete', 'success', 'done'].includes(t)) return 'completed'
  if (t === 'partial') return 'partial'
  if (['canceled', 'cancelled'].includes(t)) return 'canceled'
  if (t === 'refunded') return 'refunded'
  return 'in_progress'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Who is calling? (their JWT is forwarded automatically by supabase-js)
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!jwt) return json({ error: 'Missing auth token' }, 401)
    const me = createClient(supabaseUrl, serviceKey)
    const { data: { user } } = await me.auth.getUser(jwt)
    if (!user) return json({ error: 'Invalid session — please log in again' }, 401)

    // Server client (bypasses RLS) for trusted reads/writes
    const db = createClient(supabaseUrl, serviceKey)
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    const needAdmin = () => {
      if (!isAdmin) throw new Error('Admin only')
    }
    const getProvider = async (id: number) => {
      const { data, error } = await db.from('providers').select('*').eq('id', id).single()
      if (error || !data) throw new Error('Provider not found')
      return data
    }

    /* ============ balance (admin) ============ */
    if (action === 'balance') {
      needAdmin()
      const p = await getProvider(Number(body.provider_id))
      const res = await providerCall(p.api_url, p.api_key, 'balance')
      if (res?.error) throw new Error(`Provider: ${res.error}`)
      const balance = Number(res.balance ?? 0)
      await db.from('providers').update({ balance, currency: res.currency || '', last_sync: new Date().toISOString() }).eq('id', p.id)
      return json({ balance, currency: res.currency || '' })
    }

    /* ============ services (admin) ============ */
    if (action === 'services') {
      needAdmin()
      const p = await getProvider(Number(body.provider_id))
      const res = await providerCall(p.api_url, p.api_key, 'services')
      if (res?.error) throw new Error(`Provider: ${res.error}`)
      if (!Array.isArray(res)) throw new Error('Provider returned an unexpected services list')
      const services = res.map((s: Record<string, string>) => ({
        service: String(s.service),
        name: String(s.name || ''),
        category: String(s.category || ''),
        type: String(s.type || ''),
        rate: Number(s.rate || 0),
        min: Number(s.min || 0),
        max: Number(s.max || 0),
        refill: Boolean(s.refill),
        cancel: Boolean(s.cancel),
      }))
      return json({ services })
    }

    /* ============ forward (owner or admin) ============ */
    if (action === 'forward') {
      const { data: order } = await db.from('orders').select('*').eq('id', Number(body.order_id)).single()
      if (!order) throw new Error('Order not found')
      if (!isAdmin && order.user_id !== user.id) throw new Error('Not your order')
      if (order.provider_order_id) return json({ provider_order: order.provider_order_id, already: true })
      const { data: svc } = await db.from('services').select('*').eq('id', order.service_id).single()
      if (!svc?.provider_id || !svc.provider_service_id) throw new Error('Service is not mapped to a provider')
      const p = await getProvider(svc.provider_id)
      if (p.status !== 'active') throw new Error(`Provider "${p.name}" is disabled`)
      const res = await providerCall(p.api_url, p.api_key, 'add', {
        service: svc.provider_service_id,
        link: order.link,
        quantity: String(order.quantity),
      })
      if (res?.error || !res?.order) throw new Error(`Provider: ${res?.error || 'no order id returned'}`)
      await db.from('orders').update({
        provider_order_id: String(res.order),
        provider_id: p.id,
        status: order.status === 'pending' ? 'processing' : order.status,
      }).eq('id', order.id)
      return json({ provider_order: String(res.order) })
    }

    /* ============ sync (owner-or-admin per order) ============ */
    if (action === 'sync') {
      const ids: number[] = (body.order_ids || []).map(Number).filter(Boolean).slice(0, 100)
      if (!ids.length) throw new Error('No order ids')
      const { data: orders } = await db.from('orders').select('*').in('id', ids)
      const results: Record<string, unknown>[] = []
      // group provider-linked orders by provider
      const byProvider = new Map<number, typeof orders>()
      for (const o of orders || []) {
        if (!isAdmin && o.user_id !== user.id) {
          results.push({ id: o.id, error: 'Not your order' })
          continue
        }
        if (!['pending', 'in_progress', 'processing'].includes(o.status)) {
          results.push({ id: o.id, status: o.status, skipped: true })
          continue
        }
        if (!o.provider_id) {
          results.push({ id: o.id, error: 'Manual service — no provider linked' })
          continue
        }
        if (!byProvider.has(o.provider_id)) byProvider.set(o.provider_id, [])
        byProvider.get(o.provider_id)!.push(o)
      }
      for (const [pid, list] of byProvider) {
        const p = await getProvider(pid)
        // auto-forward anything never sent
        for (const o of list) {
          if (!o.provider_order_id) {
            try {
              const { data: svc } = await db.from('services').select('*').eq('id', o.service_id).single()
              if (!svc?.provider_service_id) throw new Error('Service mapping missing')
              const res = await providerCall(p.api_url, p.api_key, 'add', {
                service: svc.provider_service_id, link: o.link, quantity: String(o.quantity),
              })
              if (res?.error || !res?.order) throw new Error(res?.error || 'no order id')
              o.provider_order_id = String(res.order)
              await db.from('orders').update({ provider_order_id: o.provider_order_id, status: 'processing' }).eq('id', o.id)
            } catch (e) {
              results.push({ id: o.id, error: `Forward failed: ${(e as Error).message}` })
            }
          }
        }
        const ready = list.filter((o) => o.provider_order_id && !results.find((r) => r.id === o.id))
        if (!ready.length) continue
        let statuses: Record<string, Record<string, string>> = {}
        try {
          const res = await providerCall(p.api_url, p.api_key, 'status', {
            orders: ready.map((o) => o.provider_order_id).join(','),
          })
          if (res?.error) throw new Error(res.error)
          statuses = res.charge !== undefined ? { [ready[0].provider_order_id]: res } : res
        } catch (e) {
          for (const o of ready) results.push({ id: o.id, error: (e as Error).message })
          continue
        }
        for (const o of ready) {
          const ps = statuses[o.provider_order_id] || statuses[String(o.provider_order_id)]
          if (!ps || ps.error) {
            results.push({ id: o.id, error: ps?.error ? `Provider: ${ps.error}` : 'No status returned' })
            continue
          }
          const next = mapStatus(ps.status)
          const remains = ps.remains !== undefined ? Number(ps.remains) : o.remains
          const startCount = ps.start_count !== undefined ? Number(ps.start_count) : o.start_count
          const patch: Record<string, unknown> = { status: next, remains: next === 'completed' ? 0 : remains, start_count: startCount }
          // one-time proportional auto-refund on partial/canceled
          if (['partial', 'canceled'].includes(next) && !['canceled', 'refunded'].includes(o.status)) {
            const qty = Number(o.quantity || 0)
            const refund = qty ? Math.round((Number(o.charge) * Number(patch.remains)) / qty * 100) / 100 : 0
            if (refund > 0) {
              const { data: prof } = await db.from('profiles').select('balance').eq('id', o.user_id).single()
              await db.from('profiles').update({ balance: Math.round((Number(prof?.balance || 0) + refund) * 100) / 100 }).eq('id', o.user_id)
              await db.from('transactions').insert({
                user_id: o.user_id, type: 'credit', amount: refund, method: 'refund',
                txn_ref: `ORD-${o.id}`, status: 'approved', note: `Provider auto-refund: order #${o.id} → ${next}`,
              })
              results.push({ id: o.id, status: next, remains: patch.remains, refunded: refund })
              await db.from('orders').update(patch).eq('id', o.id)
              continue
            }
          }
          await db.from('orders').update(patch).eq('id', o.id)
          results.push({ id: o.id, status: next, remains: patch.remains })
        }
      }
      const updated = results.filter((r) => !r.error && !r.skipped).length
      return json({ updated, results })
    }

    /* ============ resync (admin): re-apply stored margins on fresh provider rates ============ */
    if (action === 'resync') {
      needAdmin()
      const { data: prov } = await db.from('providers').select('*').eq('id', body.provider_id).single()
      if (!prov) throw new Error('Provider not found')
      let remote: any
      try {
        remote = await providerCall(prov.api_url, prov.api_key, 'services')
      } catch {
        throw new Error('Provider unreachable')
      }
      const list = Array.isArray(remote) ? remote : (remote?.services || [])
      const cost: Record<string, number> = {}
      list.forEach((s: any) => { cost[String(s.service ?? s.id)] = Number(s.rate ?? 0) })
      const { data: locals } = await db.from('services').select('id,provider_service_id,margin_pct').eq('provider_id', prov.id)
      let updated = 0
      const changes: any[] = []
      for (const l of locals || []) {
        const c = cost[String(l.provider_service_id)]
        if (c === undefined || !(c > 0)) continue
        const m = Math.min(10000, Math.max(-99, Number(l.margin_pct || 0)))
        const nr = Math.round(((c * (100 + m)) / 100) * 100) / 100
        await db.from('services').update({ rate: nr, cost_rate: c }).eq('id', l.id)
        updated++
        if (changes.length < 50) changes.push({ id: l.id, cost: c, rate: nr })
      }
      return json({ ok: true, provider: prov.name, checked: (locals || []).length, updated, remote_count: list.length, changes })
    }

    /* ============ refill / cancel (owner or admin) ============ */
    if (action === 'refill' || action === 'cancel') {
      const { data: order } = await db.from('orders').select('*').eq('id', Number(body.order_id)).single()
      if (!order) throw new Error('Order not found')
      if (!isAdmin && order.user_id !== user.id) throw new Error('Not your order')
      if (!order.provider_id || !order.provider_order_id) throw new Error('Order was never sent to a provider')
      const p = await getProvider(order.provider_id)
      const res = await providerCall(p.api_url, p.api_key, action, { order: order.provider_order_id })
      if (res?.error) throw new Error(`Provider: ${res.error}`)
      return json({ ok: true, provider: res })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    return json({ error: (err as Error).message || 'Bridge failed' }, 400)
  }
})
