// ═══════════════════════════════════════════════════════════════
// BoostPanel `secure` — the ONLY writer of money. Every order, refund,
// topup, balance change and admin mutation runs HERE with service_role.
// Client JWTs can only READ their own data (RLS + least-privilege grants).
// Price tampering via DevTools/terminal/API is impossible: the client
// never sends a price — the server re-reads the rate from the database.
// ═══════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SR_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const LIVE = ["pending", "in_progress", "processing"];
const CANCELABLE = ["pending", "in_progress", "processing", "partial"];
const FINAL = ["completed", "partial", "canceled", "refunded"];

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
  let b: any = {};
  try { b = await req.json(); } catch { return j({ error: "Bad JSON" }, 400); }
  const op: string = b.op || "";

  // ── auth: real user behind a valid JWT ──
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer /i, "").trim();
  if (!jwt) return j({ error: "Login required" }, 401);
  const sb = createClient(SB_URL, SR_KEY);
  const { data: au } = await sb.auth.getUser(jwt);
  if (!au?.user) return j({ error: "Invalid session. Please login again." }, 401);
  const meId = au.user.id;

  const { data: me } = await sb.from("profiles").select("*").eq("id", meId).single();
  if (!me) return j({ error: "Account not found" }, 403);
  if (me.status !== "active") return j({ error: "Account is suspended. Contact support." }, 403);
  const admin = me.role === "admin";

  const log = async (action: string, target = "", meta: any = {}) => {
    await sb.from("admin_logs").insert({
      actor_id: meId, actor_email: me.email || "", action, target, meta,
    });
  };

  try {
    // ── global settings ──
    const { data: cfg } = await sb.from("settings").select("*").eq("id", 1).single();
    const minDep = Number(cfg?.min_deposit ?? 0);
    if (cfg?.maintenance && !admin) return j({ error: "Panel is under maintenance. Try again soon." }, 503);

    /* ═══════ order.create — price ALWAYS re-read server-side ═══════ */
    if (op === "order.create") {
      const svcId = Number(b.service_id), qty = Number(b.quantity);
      const runs = Math.min(100, Math.max(0, Number(b.runs) || 0));
      const interval = Math.min(1440, Math.max(0, Number(b.interval_mins) || 0));
      const link = String(b.link || "").trim();
      if (!svcId || !link || !qty || qty < 1) return j({ error: "Service, link and quantity are required." }, 400);
      if (!/^https?:\/\/.+\..+/.test(link)) return j({ error: "Enter a valid link starting with http." }, 400);

      const { data: svc } = await sb.from("services").select("*, providers(*)").eq("id", svcId).single();
      if (!svc || !svc.active) return j({ error: "This service is not available." }, 400);
      if (qty < svc.min_qty || qty > svc.max_qty) return j({ error: `Quantity must be between ${svc.min_qty} and ${svc.max_qty}.` }, 400);
      if ((runs > 0 || interval > 0) && !svc.provider_id) return j({ error: "Drip-feed is available only on API services." }, 400);

      // rate limit: max 10 orders / minute
      const { count: recent } = await sb.from("orders").select("id", { count: "exact", head: true })
        .eq("user_id", meId).gte("created_at", new Date(Date.now() - 60000).toISOString());
      if ((recent || 0) >= 30) return j({ error: "Too many orders at once. Wait a minute and retry." }, 429);
      // daily limit (admin-controlled)
      if (me.order_limit > 0) {
        const { count: today } = await sb.from("orders").select("id", { count: "exact", head: true })
          .eq("user_id", meId).gte("created_at", new Date(Date.now() - 86400000).toISOString());
        if ((today || 0) >= me.order_limit) return j({ error: `Daily order limit reached (${me.order_limit}). Contact support to raise it.` }, 429);
      }

      // server-side price: fresh rate × quantity × user discount
      const rate = Number(svc.rate);
      const disc = Math.min(100, Math.max(0, Number(me.discount_pct || 0)));
      const charge = Math.max(0, +(((rate / 1000) * qty * (100 - disc)) / 100).toFixed(4));
      if (Number(me.balance) < charge) return j({ error: "Insufficient balance. Please add funds." }, 400);

      const { data: upd } = await sb.from("profiles").update({ balance: Number(me.balance) - charge })
        .eq("id", meId).select("balance").single();
      const { data: order, error: oe } = await sb.from("orders").insert({
        user_id: meId, service_id: svcId, link, quantity: qty, charge,
        status: "pending", remains: qty, start_count: 0,
        provider_id: svc.provider_id || null,
        runs: svc.provider_id ? runs : 0, interval_mins: svc.provider_id ? interval : 0,
      }).select().single();
      if (oe) throw new Error("Order failed: " + oe.message);
      const onum = order.id;
      await sb.from("transactions").insert({
        user_id: meId, type: "debit", amount: charge, method: "order",
        txn_ref: `ORD-${onum}`, status: "approved",
        note: `Order #${onum} — ${svc.name}`,
      });

      // auto-forward to provider
      let forwarded = false, ferr = "";
      if (svc.provider_id && svc.provider_service_id && svc.providers) {
        try {
          const extra: any = { service: svc.provider_service_id, link, quantity: qty };
          if (runs) { extra.runs = runs; extra.interval = interval; }
          const r = await providerCall(svc.providers, "add", extra);
          if (r?.order && !r?.error) {
            forwarded = true;
            await sb.from("orders").update({ provider_order_id: String(r.order), status: "in_progress" }).eq("id", order.id);
            order.provider_order_id = String(r.order); order.status = "in_progress";
          } else ferr = typeof r?.error === "string" ? r.error : "Provider rejected the order";
        } catch { ferr = "Provider unreachable — order kept as pending, admin will review."; }
      }
      return j({ order, charge, balance: upd?.balance ?? null, forwarded, provider_error: ferr || undefined });
    }

    /* ═══════ order.cancel — server-side refund ═══════ */
    if (op === "order.cancel") {
      const { data: o } = await sb.from("orders").select("*").eq("id", b.order_id).single();
      if (!o || (!admin && o.user_id !== meId)) return j({ error: "Order not found." }, 404);
      if (!CANCELABLE.includes(o.status)) return j({ error: `Order is ${o.status} — cannot cancel.` }, 400);
      let msg = "cancelled";
      if (o.provider_id && o.provider_order_id) {
        const { data: prov } = await sb.from("providers").select("*").eq("id", o.provider_id).single();
        if (prov) {
          try { const r = await providerCall(prov, "cancel", { id: o.provider_order_id }); msg = r?.error ? "cancel requested (provider: " + r.error + ")" : "cancelled at provider"; } catch { msg = "cancel requested (provider unreachable)"; }
        }
      }
      await sb.from("orders").update({ status: "canceled" }).eq("id", o.id);
      const { data: u } = await sb.from("profiles").select("balance").eq("id", o.user_id).single();
      await sb.from("profiles").update({ balance: Number(u?.balance || 0) + Number(o.charge) }).eq("id", o.user_id);
      await sb.from("transactions").insert({ user_id: o.user_id, type: "credit", amount: Number(o.charge), method: "refund", txn_ref: `ORD-${o.id}`, status: "approved", note: `Refund for order #${o.id}` });
      if (admin) await log("order.cancel", "#" + o.id);
      return j({ ok: true, message: msg });
    }

    /* ═══════ order.refill — only refillable services ═══════ */
    if (op === "order.refill") {
      const { data: o } = await sb.from("orders").select("*").eq("id", b.order_id).single();
      if (!o || (!admin && o.user_id !== meId)) return j({ error: "Order not found." }, 404);
      if (!["completed", "partial"].includes(o.status)) return j({ error: "Only completed or partial orders can be refilled." }, 400);
      const { data: rsvc } = await sb.from("services").select("refill_days").eq("id", o.service_id).single();
      if (!((rsvc?.refill_days || 0) > 0)) return j({ error: "This service has no refill guarantee." }, 400);
      if (o.provider_id && o.provider_order_id) {
        const { data: prov } = await sb.from("providers").select("*").eq("id", o.provider_id).single();
        if (prov) { try { await providerCall(prov, "refill", { id: o.provider_order_id }); } catch { /* keep local */ } }
      }
      await sb.from("orders").update({ status: "in_progress", remains: o.quantity }).eq("id", o.id);
      return j({ ok: true });
    }

    /* ═══════ funds.request — deposit claim ═══════ */
    if (op === "funds.request") {
      const amt = Number(b.amount);
      const method = String(b.method || "").toLowerCase();
      const ref = String(b.txn_ref || "").trim();
      const shot = String(b.screenshot_url || "").trim();
      if (!amt || amt < minDep) return j({ error: `Minimum deposit is ${minDep}.` }, 400);
      if (method === "upi") {
        if (!cfg?.pay_upi) return j({ error: "UPI deposits are disabled right now." }, 400);
        if (!/^\d{12}$/.test(ref)) return j({ error: "Enter the 12-digit UTR number." }, 400);
      } else if (method === "card") {
        if (!cfg?.pay_card) return j({ error: "Card deposits are disabled right now." }, 400);
        if (!shot) return j({ error: "Payment screenshot is required." }, 400);
      } else if (method === "crypto") {
        if (!cfg?.pay_crypto) return j({ error: "Crypto deposits are disabled right now." }, 400);
        if (!ref) return j({ error: "Transaction hash / reference is required." }, 400);
      } else return j({ error: "Unknown payment method." }, 400);
      if (!shot) return j({ error: "Payment screenshot is required." }, 400);
      const { data: t } = await sb.from("transactions").insert({
        user_id: meId, type: "credit", amount: amt, status: "pending",
        method, txn_ref: ref || "", screenshot_url: shot,
        note: `Deposit request (${method.toUpperCase()})`,
      }).select().single();
      return j({ txn: t });
    }

    /* ═══════ funds.approve / reject (admin) ═══════ */
    if (op === "funds.approve" || op === "funds.reject") {
      if (!admin) return j({ error: "Forbidden" }, 403);
      const { data: t } = await sb.from("transactions").select("*").eq("id", b.txn_id).single();
      if (!t || t.type !== "credit" || t.status !== "pending") return j({ error: "Deposit not found or already reviewed." }, 404);
      if (op === "funds.reject") {
        await sb.from("transactions").update({ status: "rejected" }).eq("id", t.id);
        await log("funds.reject", "txn #" + t.id, { user: t.user_id, amount: t.amount });
        return j({ ok: true });
      }
      const bonus = Math.min(100, Math.max(0, Number(cfg?.deposit_bonus_pct || 0)));
      const credit = +(Number(t.amount) * (100 + bonus) / 100).toFixed(4);
      const { data: u } = await sb.from("profiles").select("balance").eq("id", t.user_id).single();
      await sb.from("profiles").update({ balance: Number(u?.balance || 0) + credit }).eq("id", t.user_id);
      await sb.from("transactions").update({ status: "approved" }).eq("id", t.id);
      await log("funds.approve", "txn #" + t.id, { user: t.user_id, amount: t.amount, credited: credit });
      return j({ ok: true, credited: credit });
    }

    /* ═══════ balance.adjust (admin) ═══════ */
    if (op === "balance.adjust") {
      if (!admin) return j({ error: "Forbidden" }, 403);
      const delta = Number(b.delta);
      if (!delta || isNaN(delta)) return j({ error: "Enter a non-zero amount." }, 400);
      const { data: u } = await sb.from("profiles").select("*").eq("id", b.user_id).single();
      if (!u) return j({ error: "User not found." }, 404);
      const nb = Number(u.balance) + delta;
      if (nb < 0) return j({ error: "Balance cannot go below zero." }, 400);
      await sb.from("profiles").update({ balance: nb }).eq("id", u.id);
      await sb.from("transactions").insert({
        user_id: u.id, type: delta >= 0 ? "credit" : "debit", amount: Math.abs(delta),
        method: "admin", status: "approved",
        note: String(b.note || "Manual adjustment by admin"),
      });
      await log("balance.adjust", u.email, { delta, balance: nb });
      return j({ ok: true, balance: nb });
    }

    /* ═══════ admin.order_create ═══════ */
    if (op === "admin.order_create") {
      if (!admin) return j({ error: "Forbidden" }, 403);
      const uid = b.user_id, svcId = Number(b.service_id), qty = Number(b.quantity);
      const link = String(b.link || "").trim();
      const { data: u } = await sb.from("profiles").select("*").eq("id", uid).single();
      if (!u) return j({ error: "User not found." }, 404);
      const { data: svc } = await sb.from("services").select("*, providers(*)").eq("id", svcId).single();
      if (!svc) return j({ error: "Service not found." }, 404);
      if (!link || !qty || qty < svc.min_qty || qty > svc.max_qty) return j({ error: `Quantity must be ${svc.min_qty}-${svc.max_qty}.` }, 400);
      const disc = Math.min(100, Math.max(0, Number(u.discount_pct || 0)));
      const charge = Math.max(0, +(((Number(svc.rate) / 1000) * qty * (100 - disc)) / 100).toFixed(4));
      if (Number(u.balance) < charge) return j({ error: `User balance too low (needs ${charge}).` }, 400);
      await sb.from("profiles").update({ balance: Number(u.balance) - charge }).eq("id", uid);
      const { data: order } = await sb.from("orders").insert({
        user_id: uid, service_id: svcId, link, quantity: qty, charge,
        status: "pending", remains: qty, start_count: 0,
        provider_id: svc.provider_id || null,
      }).select().single();
      await sb.from("transactions").insert({ user_id: uid, type: "debit", amount: charge, method: "order", txn_ref: `ORD-${order.id}`, status: "approved", note: `Manual order #${order.id} by admin` });
      let forwarded = false;
      if (svc.provider_id && svc.provider_service_id && svc.providers) {
        try {
          const r = await providerCall(svc.providers, "add", { service: svc.provider_service_id, link, quantity: qty });
          if (r?.order && !r?.error) {
            forwarded = true;
            await sb.from("orders").update({ provider_order_id: String(r.order), status: "in_progress" }).eq("id", order.id);
          }
        } catch { /* stays pending */ }
      }
      await log("order.create", "#" + order.id, { user: u.email, charge, forwarded });
      return j({ order, charge, forwarded });
    }

    /* ═══════ admin.order_set (status + auto-refund) ═══════ */
    if (op === "admin.order_set") {
      if (!admin) return j({ error: "Forbidden" }, 403);
      const { data: o } = await sb.from("orders").select("*").eq("id", b.order_id).single();
      if (!o) return j({ error: "Order not found." }, 404);
      const st = String(b.status);
      if (!FINAL.includes(st) && !LIVE.includes(st)) return j({ error: "Invalid status." }, 400);
      const patch = { status: st };
      if (st === "completed") patch.remains = 0;
      else if (b.remains !== null && b.remains !== undefined && b.remains !== "") patch.remains = Number(b.remains);
      await sb.from("orders").update(patch).eq("id", o.id);
      let refunded = 0;
      if ((st === "canceled" || st === "refunded") && !["canceled", "refunded"].includes(o.status)) {
        refunded = Number(o.charge);
        const { data: u } = await sb.from("profiles").select("balance").eq("id", o.user_id).single();
        await sb.from("profiles").update({ balance: Number(u?.balance || 0) + refunded }).eq("id", o.user_id);
        await sb.from("transactions").insert({ user_id: o.user_id, type: "credit", amount: refunded, method: "refund", txn_ref: `ORD-${o.id}`, status: "approved", note: `Refund for order #${o.id} (admin)` });
      }
      await log("order.set", "#" + o.id, { from: o.status, to: st, refunded });
      return j({ ok: true, refunded });
    }

    /* ═══════ admin.user_update ═══════ */
    if (op === "admin.user_update") {
      if (!admin) return j({ error: "Forbidden" }, 403);
      const uid = b.user_id;
      if (!uid) return j({ error: "User required." }, 400);
      const { data: u } = await sb.from("profiles").select("*").eq("id", uid).single();
      if (!u) return j({ error: "User not found." }, 404);
      const patch = {};
      if (b.role !== undefined) {
        if (!["user", "admin"].includes(b.role)) return j({ error: "Invalid role." }, 400);
        if (uid === meId && b.role !== "admin") return j({ error: "You cannot demote yourself." }, 400);
        patch.role = b.role;
      }
      if (b.status !== undefined) {
        if (!["active", "banned"].includes(b.status)) return j({ error: "Invalid status." }, 400);
        if (uid === meId && b.status !== "active") return j({ error: "You cannot ban yourself." }, 400);
        patch.status = b.status;
      }
      if (b.discount_pct !== undefined) patch.discount_pct = Math.min(100, Math.max(0, Number(b.discount_pct) || 0));
      if (b.order_limit !== undefined) patch.order_limit = Math.max(0, parseInt(b.order_limit) || 0);
      if (b.note !== undefined) patch.note = String(b.note).slice(0, 500);
      if (!Object.keys(patch).length) return j({ error: "Nothing to update." }, 400);
      await sb.from("profiles").update(patch).eq("id", uid);
      await log("user.update", u.email, patch);
      return j({ ok: true });
    }

    return j({ error: "Unknown op: " + op }, 400);
  } catch (e) {
    return j({ error: e?.message || "Server error" }, 500);
  }
});