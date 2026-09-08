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

  // ── abuse shield: per-user sliding-window rate limits ──
  const RL: Record<string, [number, number]> = {
    "order.create": [60, 30], "funds.request": [60, 8], "transfer.send": [60, 10],
    "broadcast.send": [60, 3], "balance.adjust": [60, 20], "admin.order_create": [60, 20],
    "admin.order_set": [60, 60], "referral.claim": [60, 10], "loyalty.convert": [60, 10],
    "account.delete_self": [300, 3], "review.create": [60, 20], "ticket.rate": [60, 20],
  };
  // S: server-side input hygiene (mirrors client clean())
  const S = (v: any, max = 2000) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/<\s*script/gi, "<blocked").replace(/javascript\s*:/gi, "blocked:").trim().slice(0, max);
  {
    const [win, max] = RL[op] || [60, 120];
    const since = new Date(Date.now() - win * 1000).toISOString();
    await sb.from("rate_hits").insert({ user_id: meId, op });
    const { count } = await sb.from("rate_hits").select("id", { count: "exact", head: true })
      .eq("user_id", meId).eq("op", op).gte("ts", since);
    if (Math.random() < 0.03) await sb.from("rate_hits").delete().lt("ts", new Date(Date.now() - 3600000).toISOString());
    if ((count || 0) > max) return j({ error: "Too many requests. Slow down a moment." }, 429);
  }

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
      const link = S(b.link, 1000);
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

      // server-side price: fresh rate x quantity x user discount x coupon
      const rate = Number(svc.rate);
      const disc = Math.min(100, Math.max(0, Number(me.discount_pct || 0)));
      let charge = Math.max(0, +(((rate / 1000) * qty * (100 - disc)) / 100).toFixed(4));
      let couponCode = "", couponOff = 0, couponId: number | null = null;
      const couponIn = S(b.coupon_code, 40).toUpperCase();
      if (couponIn) {
        const { data: cp } = await sb.from("coupons").select("*").eq("code", couponIn).single();
        if (!cp || !cp.active) return j({ error: "Coupon is invalid or disabled." }, 400);
        if (cp.expires_at && new Date(cp.expires_at).getTime() < Date.now()) return j({ error: "Coupon is expired." }, 400);
        if (Number(cp.max_uses) > 0 && Number(cp.used) >= Number(cp.max_uses)) return j({ error: "Coupon usage limit reached." }, 400);
        if (Number(cp.min_charge) > 0 && charge < Number(cp.min_charge)) return j({ error: `This coupon needs a minimum order of ${cp.min_charge}.` }, 400);
        const { data: already } = await sb.from("coupon_uses").select("id").eq("coupon_id", cp.id).eq("user_id", meId).maybeSingle();
        if (already) return j({ error: "You have already used this coupon." }, 400);
        couponOff = cp.kind === "pct" ? +(charge * Number(cp.value) / 100).toFixed(4) : Math.min(charge, Number(cp.value));
        couponCode = cp.code; couponId = cp.id;
        charge = Math.max(0, +(charge - couponOff).toFixed(4));
      }
      if (Number(me.balance) < charge) return j({ error: "Insufficient balance. Please add funds." }, 400);
      const maxActive = Number(cfg?.max_active_orders || 0);
      if (maxActive > 0) {
        const { count: activeCount } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("user_id", meId).in("status", ["pending", "in_progress", "processing"]);
        if ((activeCount || 0) >= maxActive) return j({ error: `You already have ${maxActive} active orders. Wait for delivery before ordering more.` }, 400);
      }

      const { data: upd } = await sb.from("profiles").update({ balance: Number(me.balance) - charge })
        .eq("id", meId).select("balance").single();
      const { data: order, error: oe } = await sb.from("orders").insert({
        user_id: meId, service_id: svcId, link, quantity: qty, charge,
        coupon_code: couponCode, discount_amt: couponOff,
        status: "pending", remains: qty, start_count: 0,
        provider_id: svc.provider_id || null,
        runs: svc.provider_id ? runs : 0, interval_mins: svc.provider_id ? interval : 0,
      }).select().single();
      if (oe) throw new Error("Order failed: " + oe.message);
      const onum = order.id;
      await sb.from("transactions").insert({
        user_id: meId, type: "debit", amount: charge, method: "order",
        txn_ref: `ORD-${onum}`, status: "approved",
        note: `Order #${onum} — ${svc.name}${couponCode ? ` (coupon ${couponCode} −${couponOff})` : ""}`,
      });
      if (couponId) {
        await sb.from("coupon_uses").insert({ coupon_id: couponId, user_id: meId, order_id: onum, amount: couponOff });
        const { data: cc } = await sb.from("coupons").select("used").eq("id", couponId).single();
        await sb.from("coupons").update({ used: Number(cc?.used || 0) + 1 }).eq("id", couponId);
      }
      let loyaltyEarned = 0;
      const lp100 = Number(cfg?.loyalty_per_100 || 0);
      if (lp100 > 0 && charge > 0) {
        loyaltyEarned = Math.floor((charge * lp100) / 100);
        if (loyaltyEarned > 0) await sb.from("profiles").update({ loyalty_points: Number(me.loyalty_points || 0) + loyaltyEarned }).eq("id", meId);
      }
      await sb.from("order_events").insert({ order_id: onum, event: "created", detail: `${svc.name} x ${qty}` });

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
            await sb.from("order_events").insert({ order_id: order.id, event: "forwarded", detail: `Provider order ${r.order}` });
          } else ferr = typeof r?.error === "string" ? r.error : "Provider rejected the order";
        } catch { ferr = "Provider unreachable — order kept as pending, admin will review."; }
      }
      return j({ order, charge, balance: upd?.balance ?? null, forwarded, provider_error: ferr || undefined, coupon: couponCode || undefined, discount: couponOff || undefined, loyalty_earned: loyaltyEarned || undefined });
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
      await sb.from("order_events").insert({ order_id: o.id, event: "canceled", detail: msg });
      await sb.from("notifications").insert({ user_id: o.user_id, title: `Order #${o.id} canceled`, body: `Refunded ${o.charge}. ${msg}` });
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
      await sb.from("order_events").insert({ order_id: o.id, event: "refill", detail: "Refill requested" });
      return j({ ok: true });
    }

    /* ═══════ funds.request — deposit claim ═══════ */
    if (op === "funds.request") {
      const amt = Number(b.amount);
      const method = String(b.method || "").toLowerCase();
      const ref = S(b.txn_ref, 160);
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
      } else if (method === "bank") {
        if (!cfg?.pay_bank) return j({ error: "Bank deposits are disabled right now." }, 400);
        if (!ref) return j({ error: "Bank reference / UTR is required." }, 400);
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
        await sb.from("notifications").insert({ user_id: t.user_id, title: "Deposit rejected", body: `Your deposit of ${t.amount} was rejected. Contact support.` });
        await log("funds.reject", "txn #" + t.id, { user: t.user_id, amount: t.amount });
        return j({ ok: true });
      }
      const bonus = Math.min(100, Math.max(0, Number(cfg?.deposit_bonus_pct || 0)));
      const credit = +(Number(t.amount) * (100 + bonus) / 100).toFixed(4);
      const { data: u } = await sb.from("profiles").select("balance").eq("id", t.user_id).single();
      await sb.from("profiles").update({ balance: Number(u?.balance || 0) + credit }).eq("id", t.user_id);
      await sb.from("transactions").update({ status: "approved" }).eq("id", t.id);
      await sb.from("notifications").insert({ user_id: t.user_id, title: "Deposit approved", body: `+${credit} added to your balance.` });
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
      const link = S(b.link, 1000);
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
      await sb.from("order_events").insert({ order_id: o.id, event: `status -> ${st}`, detail: refunded ? `Refunded ${refunded}` : "" });
      if (st === "completed") await sb.from("notifications").insert({ user_id: o.user_id, title: `Order #${o.id} completed`, body: "Your order finished. You can rate the service." });
      if (refunded > 0) await sb.from("notifications").insert({ user_id: o.user_id, title: `Order #${o.id} ${st}`, body: `Refunded ${refunded}.` });
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
      if (b.note !== undefined) patch.note = S(b.note, 500);
      if (b.tags !== undefined) patch.tags = S(b.tags, 200);
      if (!Object.keys(patch).length) return j({ error: "Nothing to update." }, 400);
      await sb.from("profiles").update(patch).eq("id", uid);
      await log("user.update", u.email, patch);
      return j({ ok: true });
    }

    /* ======= referral.claim ======= */
    if (op === "referral.claim") {
      const code = S(b.code, 40).toUpperCase();
      if (!code) return j({ error: "Enter a referral code." }, 400);
      if (me.referred_by) return j({ error: "You already used a referral code." }, 400);
      const { data: ref } = await sb.from("profiles").select("id,balance").eq("referral_code", code).single();
      if (!ref) return j({ error: "Invalid referral code." }, 400);
      if (ref.id === meId) return j({ error: "You cannot refer yourself." }, 400);
      const reward = Math.max(0, Number(cfg?.referral_reward || 0));
      await sb.from("profiles").update({ referred_by: ref.id }).eq("id", meId);
      await sb.from("referrals").insert({ referrer_id: ref.id, referred_id: meId, reward, status: "paid" });
      if (reward > 0) {
        await sb.from("profiles").update({ balance: Number(ref.balance || 0) + reward }).eq("id", ref.id);
        await sb.from("transactions").insert({ user_id: ref.id, type: "credit", amount: reward, method: "referral", status: "approved", note: `Referral reward (${me.email || "new user"})` });
        await sb.from("notifications").insert({ user_id: ref.id, title: "Referral reward earned", body: `+${reward} for inviting ${me.email || "a friend"}.` });
      }
      await log("referral.claim", me.email || meId, { by: ref.id, reward });
      return j({ ok: true, reward });
    }

    /* ======= loyalty.convert ======= */
    if (op === "loyalty.convert") {
      const pts = Math.floor(Number(b.points) || 0);
      const rate = Number(cfg?.loyalty_redeem_rate || 0);
      if (!pts || pts <= 0) return j({ error: "Enter points to convert." }, 400);
      if (!(rate > 0)) return j({ error: "Loyalty redemption is disabled." }, 400);
      if (pts > Number(me.loyalty_points || 0)) return j({ error: "Not enough loyalty points." }, 400);
      const credit = +(pts * rate).toFixed(4);
      await sb.from("profiles").update({ loyalty_points: Number(me.loyalty_points || 0) - pts, balance: Number(me.balance || 0) + credit }).eq("id", meId);
      await sb.from("transactions").insert({ user_id: meId, type: "credit", amount: credit, method: "loyalty", status: "approved", note: `Converted ${pts} loyalty points` });
      return j({ ok: true, credited: credit });
    }

    /* ======= transfer.send ======= */
    if (op === "transfer.send") {
      const toEmail = S(b.to_email, 160).toLowerCase();
      const amt = +Number(b.amount || 0).toFixed(4);
      const minT = Number(cfg?.transfer_min || 0);
      const feePct = Math.min(50, Math.max(0, Number(cfg?.transfer_fee_pct || 0)));
      if (!toEmail || !amt || amt <= 0) return j({ error: "Recipient email and amount are required." }, 400);
      if (amt < minT) return j({ error: `Minimum transfer is ${minT}.` }, 400);
      const { data: to } = await sb.from("profiles").select("id,status,balance").ilike("email", toEmail).single();
      if (!to) return j({ error: "Recipient not found." }, 404);
      if (to.id === meId) return j({ error: "You cannot transfer to yourself." }, 400);
      if (to.status !== "active") return j({ error: "Recipient account is not active." }, 400);
      const fee = +(amt * feePct / 100).toFixed(4);
      if (Number(me.balance) < amt + fee) return j({ error: "Insufficient balance (amount + fee)." }, 400);
      await sb.from("profiles").update({ balance: Number(me.balance) - amt - fee }).eq("id", meId);
      await sb.from("profiles").update({ balance: Number(to.balance || 0) + amt }).eq("id", to.id);
      await sb.from("transactions").insert({ user_id: meId, type: "debit", amount: amt + fee, method: "transfer", status: "approved", note: `Sent to ${toEmail}${fee ? ` (fee ${fee})` : ""}` });
      await sb.from("transactions").insert({ user_id: to.id, type: "credit", amount: amt, method: "transfer", status: "approved", note: `Received from ${me.email || "user"}` });
      await sb.from("notifications").insert({ user_id: to.id, title: "Balance received", body: `+${amt} from ${me.email || "user"}.` });
      return j({ ok: true, sent: amt, fee });
    }

    /* ======= service.toggle (admin + back-online alerts) ======= */
    if (op === "service.toggle") {
      if (!admin) return j({ error: "Forbidden" }, 403);
      const sid = Number(b.service_id);
      const active = !(b.active === false || b.active === "false");
      const { data: svc } = await sb.from("services").select("id,name,active").eq("id", sid).single();
      if (!svc) return j({ error: "Service not found." }, 404);
      await sb.from("services").update({ active }).eq("id", sid);
      let notified = 0;
      if (active && !svc.active) {
        const { data: subs } = await sb.from("service_alerts").select("id,user_id").eq("service_id", sid).eq("kind", "back_online").eq("active", true);
        for (const s of subs || []) {
          await sb.from("notifications").insert({ user_id: s.user_id, title: "Service is back online", body: `${svc.name} is available again.` });
          await sb.from("service_alerts").update({ triggered_at: new Date().toISOString() }).eq("id", s.id);
          notified++;
        }
      }
      await log("service.toggle", `#${sid} -> ${active ? "live" : "hidden"}`, { notified });
      return j({ ok: true, active, notified });
    }

    /* ======= broadcast.send (admin) ======= */
    if (op === "broadcast.send") {
      if (!admin) return j({ error: "Forbidden" }, 403);
      const title = S(b.title, 120);
      const body = S(b.body, 1000);
      const segment = String(b.segment || "all");
      if (!title || !body) return j({ error: "Title and message are required." }, 400);
      let qq = sb.from("profiles").select("id").eq("status", "active");
      if (segment === "new") qq = qq.gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
      if (segment === "vip") qq = qq.ilike("tags", "%vip%");
      const { data: users } = await qq.limit(2000);
      const batch = `bc-${Date.now()}`;
      let sent = 0;
      for (const u of users || []) {
        await sb.from("notifications").insert({ user_id: u.id, title, body, is_broadcast: true, batch });
        sent++;
      }
      await log("broadcast.send", batch, { segment, sent });
      return j({ ok: true, sent });
    }

    /* ======= account.delete_self / account.set_email ======= */
    if (op === "account.delete_self") {
      if (String(b.confirm || "") !== "DELETE") return j({ error: "Type DELETE to confirm." }, 400);
      await log("account.delete", me.email || meId, {});
      const { error } = await sb.auth.admin.deleteUser(meId);
      if (error) return j({ error: "Could not delete account." }, 500);
      return j({ ok: true });
    }
    if (op === "account.set_email") {
      const email = S(b.email, 160).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return j({ error: "Enter a valid email." }, 400);
      const { data: taken } = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
      if (taken && taken.id !== meId) return j({ error: "Email is already in use." }, 400);
      const { error } = await sb.auth.admin.updateUserById(meId, { email });
      if (error) return j({ error: "Could not change email." }, 500);
      await sb.from("profiles").update({ email }).eq("id", meId);
      return j({ ok: true, email });
    }

    /* ======= review.create (completed orders only) ======= */
    if (op === "review.create") {
      const oid = Number(b.order_id);
      const rating = Math.min(5, Math.max(1, Number(b.rating) || 0));
      const text = S(b.text, 500);
      if (!oid || !rating) return j({ error: "Order and rating are required." }, 400);
      const { data: o } = await sb.from("orders").select("id,user_id,service_id,status").eq("id", oid).single();
      if (!o || o.user_id !== meId) return j({ error: "Order not found." }, 404);
      if (o.status !== "completed") return j({ error: "Only completed orders can be reviewed." }, 400);
      const { data: dup } = await sb.from("reviews").select("id").eq("order_id", oid).maybeSingle();
      if (dup) return j({ error: "You already reviewed this order." }, 400);
      await sb.from("reviews").insert({ service_id: o.service_id, user_id: meId, order_id: oid, rating, text, approved: false });
      return j({ ok: true });
    }

    /* ======= ticket.rate ======= */
    if (op === "ticket.rate") {
      const tid = Number(b.ticket_id);
      const rating = Math.min(5, Math.max(1, Number(b.rating) || 0));
      if (!tid || !rating) return j({ error: "Ticket and rating are required." }, 400);
      const { data: t } = await sb.from("tickets").select("id,user_id,status,satisfaction").eq("id", tid).single();
      if (!t || t.user_id !== meId) return j({ error: "Ticket not found." }, 404);
      if (t.status !== "closed") return j({ error: "You can rate after the ticket is closed." }, 400);
      if (t.satisfaction) return j({ error: "Already rated." }, 400);
      await sb.from("tickets").update({ satisfaction: rating }).eq("id", tid);
      return j({ ok: true });
    }

    /* ======= funds.flag (admin) ======= */
    if (op === "funds.flag") {
      if (!admin) return j({ error: "Forbidden" }, 403);
      const tid = Number(b.txn_id);
      const flagged = !!b.flagged;
      const { data: t } = await sb.from("transactions").select("id").eq("id", tid).single();
      if (!t) return j({ error: "Transaction not found." }, 404);
      await sb.from("transactions").update({ flagged, flag_note: String(b.note || "").slice(0, 300) }).eq("id", tid);
      await log(flagged ? "funds.flag" : "funds.unflag", "txn #" + tid, {});
      return j({ ok: true });
    }

    return j({ error: "Unknown op: " + op }, 400);
  } catch (e) {
    return j({ error: e?.message || "Server error" }, 500);
  }
});