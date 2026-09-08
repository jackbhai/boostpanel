// ═══════════════════════════════════════════════════════════════
// BoostPanel RESELLER API — Perfect Panel v2 compatible.
// Deploy with --no-verify-jwt (auth = per-user API key, like every panel).
// POST form-encoded or JSON: { key, action, ... }
// actions: services | add | status | balance | refill | cancel
// Base URL users see: {SUPABASE_URL}/functions/v1/public-api
// ═══════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SR_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STATUS_MAP: Record<string, string> = {
  pending: "Pending", in_progress: "In progress", processing: "Processing",
  completed: "Completed", partial: "Partial", canceled: "Canceled", refunded: "Refunded",
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const j = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function providerCall(p: any, action: string, extra: Record<string, any> = {}) {
  const body = new URLSearchParams({ key: p.api_key, action, ...extra });
  const r = await fetch(p.api_url.replace(/\/$/, ""), {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body, signal: AbortSignal.timeout(25000),
  });
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(SB_URL, SR_KEY);

  // parse params (form-encoded, JSON or query)
  let p: Record<string, any> = {};
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) p = await req.json();
    else if (req.method === "POST") { const f = await req.formData(); f.forEach((v, k) => (p[k] = String(v))); }
    const q = new URL(req.url).searchParams; q.forEach((v, k) => { if (!(k in p)) p[k] = v; });
  } catch { return j({ error: "Bad request" }, 400); }

  const key = String(p.key || "").trim();
  const action = String(p.action || "").trim();
  if (!key) return j({ error: "API key invalid" });
  const { data: me } = await sb.from("profiles").select("*").eq("api_key", key).single();
  if (!me) return j({ error: "API key invalid" });
  if (me.status !== "active") return j({ error: "Account is suspended" });
  const { data: cfg } = await sb.from("settings").select("*").eq("id", 1).single();

  /* ── services ── */
  if (action === "services") {
    const { data } = await sb.from("services").select("id,name,rate,min_qty,max_qty,type").eq("active", true).order("id");
    return j((data || []).map((s: any) => ({
      service: s.id, name: s.name, rate: String(s.rate), min: String(s.min_qty), max: String(s.max_qty), type: s.type || "Default",
    })));
  }

  /* ── balance ── */
  if (action === "balance") {
    return j({ balance: String(me.balance), currency: cfg?.currency || "INR" });
  }

  /* ── add ── */
  if (action === "add") {
    if (cfg?.maintenance) return j({ error: "Panel is under maintenance" });
    const svcId = Number(p.service), qty = Number(p.quantity);
    const link = String(p.link || "").trim();
    if (!svcId || !link || !qty) return j({ error: "Incorrect request: service, link and quantity required" });
    const { data: svc } = await sb.from("services").select("*, providers(*)").eq("id", svcId).single();
    if (!svc || !svc.active) return j({ error: "Service is disabled" });
    if (qty < svc.min_qty || qty > svc.max_qty) return j({ error: `Quantity must be between ${svc.min_qty} and ${svc.max_qty}` });
    const disc = Math.min(100, Math.max(0, Number(me.discount_pct || 0)));
    const charge = Math.max(0, +(((Number(svc.rate) / 1000) * qty * (100 - disc)) / 100).toFixed(4));
    if (Number(me.balance) < charge) return j({ error: "Insufficient funds" });
    await sb.from("profiles").update({ balance: Number(me.balance) - charge }).eq("id", me.id);
    const runs = svc.provider_id ? Math.min(100, Math.max(0, Number(p.runs) || 0)) : 0;
    const interval = svc.provider_id ? Math.min(1440, Math.max(0, Number(p.interval) || 0)) : 0;
    const { data: order } = await sb.from("orders").insert({
      user_id: me.id, service_id: svcId, link, quantity: qty, charge,
      status: "pending", remains: qty, start_count: 0,
      provider_id: svc.provider_id || null, runs, interval_mins: interval,
    }).select().single();
    await sb.from("transactions").insert({ user_id: me.id, type: "debit", amount: charge, method: "order", txn_ref: `ORD-${order.id}`, status: "approved", note: `API order #${order.id} — ${svc.name}` });
    if (svc.provider_id && svc.provider_service_id && svc.providers) {
      try {
        const extra: any = { service: svc.provider_service_id, link, quantity: qty };
        if (runs) { extra.runs = runs; extra.interval = interval; }
        const r = await providerCall(svc.providers, "add", extra);
        if (r?.order && !r?.error) {
          await sb.from("orders").update({ provider_order_id: String(r.order), status: "in_progress" }).eq("id", order.id);
        }
      } catch { /* stays pending for admin */ }
    }
    return j({ order: order.id });
  }

  /* ── status (single or batch of 100) ── */
  if (action === "status") {
    const shape = (o: any) => ({
      charge: String(o.charge), start_count: String(o.start_count || 0),
      status: STATUS_MAP[o.status] || o.status, remains: String(o.remains ?? o.quantity), currency: cfg?.currency || "INR",
    });
    if (p.orders) {
      const ids = String(p.orders).split(",").map((x) => Number(x.trim())).filter(Boolean).slice(0, 100);
      const { data } = await sb.from("orders").select("*").eq("user_id", me.id).in("id", ids);
      const out: Record<string, any> = {};
      (data || []).forEach((o: any) => (out[o.id] = shape(o)));
      return j(out);
    }
    const { data: o } = await sb.from("orders").select("*").eq("id", Number(p.order)).eq("user_id", me.id).single();
    if (!o) return j({ error: "Incorrect order ID" });
    return j(shape(o));
  }

  /* ── refill ── */
  if (action === "refill") {
    const ids = p.orders
      ? String(p.orders).split(",").map((x) => Number(x.trim())).filter(Boolean).slice(0, 100)
      : [Number(p.order)].filter(Boolean);
    if (!ids.length) return j({ error: "Incorrect order ID" });
    const { data: list } = await sb.from("orders").select("*").eq("user_id", me.id).in("id", ids);
    const out: any[] = [];
    for (const o of list || []) {
      const { data: rsvc } = await sb.from("services").select("refill_days").eq("id", o.service_id).single();
      if (!["completed", "partial"].includes(o.status) || !((rsvc?.refill_days || 0) > 0)) {
        out.push({ order: o.id, refill: "error: not refillable" }); continue;
      }
      if (o.provider_id && o.provider_order_id) {
        const { data: prov } = await sb.from("providers").select("*").eq("id", o.provider_id).single();
        if (prov) { try { await providerCall(prov, "refill", { id: o.provider_order_id }); } catch { /* local */ } }
      }
      await sb.from("orders").update({ status: "in_progress", remains: o.quantity }).eq("id", o.id);
      out.push({ order: o.id, refill: 1 });
    }
    return j(p.orders ? out : out[0] || { error: "Incorrect order ID" });
  }

  /* ── cancel ── */
  if (action === "cancel") {
    const ids = p.orders
      ? String(p.orders).split(",").map((x) => Number(x.trim())).filter(Boolean).slice(0, 100)
      : [Number(p.order)].filter(Boolean);
    if (!ids.length) return j({ error: "Incorrect order ID" });
    const { data: list } = await sb.from("orders").select("*").eq("user_id", me.id).in("id", ids);
    const out: any[] = [];
    for (const o of list || []) {
      if (!["pending", "in_progress", "processing", "partial"].includes(o.status)) {
        out.push({ order: o.id, cancel: "error: cannot cancel " + o.status }); continue;
      }
      if (o.provider_id && o.provider_order_id) {
        const { data: prov } = await sb.from("providers").select("*").eq("id", o.provider_id).single();
        if (prov) { try { await providerCall(prov, "cancel", { id: o.provider_order_id }); } catch { /* local */ } }
      }
      await sb.from("orders").update({ status: "canceled" }).eq("id", o.id);
      const { data: u } = await sb.from("profiles").select("balance").eq("id", me.id).single();
      await sb.from("profiles").update({ balance: Number(u?.balance || 0) + Number(o.charge) }).eq("id", me.id);
      await sb.from("transactions").insert({ user_id: me.id, type: "credit", amount: Number(o.charge), method: "refund", txn_ref: `ORD-${o.id}`, status: "approved", note: `API refund for order #${o.id}` });
      out.push({ order: o.id, cancel: 1 });
    }
    return j(p.orders ? out : out[0] || { error: "Incorrect order ID" });
  }

  return j({ error: "Unknown action. Use: services, add, status, balance, refill, cancel" });
});
