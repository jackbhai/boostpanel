# 🚀 BoostPanel — SMM Panel (User + Admin) · LIVE

**Live site:** https://jackbhai.github.io/boostpanel/

A **mobile-first**, fully working SMM panel: **React + Vite + Supabase** (Postgres + Auth +
Storage + Edge Functions). Zero demo data — every flow is real:

- **User:** signup → add funds via **UPI QR (amount pre-filled)** → submit **12-digit UTR +
  screenshot** → admin approves → balance credits → place orders → auto-forward to provider API → live status sync.
- **Admin:** approve funds (verify screenshots), manage users/orders/services/tickets,
  connect **provider APIs**, import services with margin, full analytics.

> University project — demonstrates full-stack development: frontend, relational DB,
> auth, secure RLS, file storage, serverless functions, CI/CD.

---

## ✨ Features

### 👤 User Panel
| Page | Real functionality |
|---|---|
| Dashboard | Live balance, stats, announcements, recent orders |
| New Order | Category → service → link → qty, live price, auto-forward to provider |
| Services | Search + rates/1000, min–max, refill info |
| Mass Order | Bulk `service_id \| link \| qty` with validation |
| Orders | Status filters, progress bars, **Refill** & **Cancel (auto-refund)** incl. provider calls |
| Add Funds | **UPI QR with embedded amount** → pay → UTR + screenshot upload |
| Transactions | Full wallet ledger |
| Tickets | Chat-style support |
| API Docs | Personal API key + reseller examples |
| Profile | Password change, API key |

### 🛠️ Admin Panel (`/admin`)
| Page | Real functionality |
|---|---|
| Dashboard | Revenue/orders/users, 7-day charts, pending alerts |
| Orders | Edit status/remains (**auto-refund**), **Push to provider**, **Sync all** |
| API Providers | Add source API → **Test balance** → **Import services with % margin** |
| Users | Add/deduct balance, roles, ban/unban |
| Services | Full CRUD + provider mapping per service |
| Funds | **Verify screenshot + UTR**, approve (auto-credit) / reject |
| Tickets | Reply, close/re-open |
| Setup | Site, currency, **UPI ID + payee name**, payment toggles, announcements |

---

## 🧰 Tech Stack

React 19 + Vite · Tailwind v4 · React Router · Zustand · Recharts · Framer Motion ·
Supabase (Postgres, Auth, Storage, Edge Functions) · `qrcode` (offline UPI QR) ·
GitHub Actions → GitHub Pages.

---

## 🔑 First-Run Checklist (owner)

1. Open the live site → **Sign up** — the **first account automatically becomes admin**.
2. Log in → **Admin → Setup → Payments** → add your **UPI ID + payee name** → Save.
3. (Optional) **Admin → API** → add provider URL + key → **Test** → **Import** services.
4. Share the link — users sign up, top up via your QR, and order. You approve funds.

## 🔌 Provider API (Perfect Panel standard)

Any provider with `api/v2` supporting `balance / services / add / status / refill / cancel`
works. The `provider-proxy` Edge Function keeps provider keys **server-side only** —
they are never exposed to browsers (and the `providers` table is admin-only via RLS).

Redeploy the function after edits:
```bash
SUPABASE_ACCESS_TOKEN="<token>" npx supabase functions deploy provider-proxy --project-ref <ref>
```

## 💰 Payment Flow (exactly like real panels)

1. Admin sets UPI ID in Setup → Payments.
2. User enters amount → QR encodes `upi://pay?pa=…&pn=…&am=…&cu=INR&tn=…&tr=…` (amount pre-filled in GPay/PhonePe/Paytm/BHIM).
3. User pays, enters **12-digit UTR**, uploads **screenshot** (stored in `payment-proofs` bucket).
4. Admin opens Funds → taps screenshot to verify → **Approve** (balance auto-credits) or Reject.

## 🗄️ Database

`supabase/schema.sql` (idempotent) + `supabase/seed.sql` (catalog only, no demo data).
Secure RLS: users touch only their own rows; provider keys admin-only; role/status
changes blocked for non-admins by a trigger; first admin via `claim_first_admin()`.

## 💻 Local Dev

```bash
npm install
cp .env.example .env   # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Every push to `main` auto-deploys to GitHub Pages (keys injected from Actions secrets).

## 📁 Structure

```
src/lib/db.js          ← all business logic (orders, refunds, funds, tickets…)
src/lib/upi.js         ← UPI deep-link builder + offline QR
src/lib/store.js       ← global state (Zustand)
src/pages/user/        ← 11 user pages  ·  src/pages/admin/ ← 8 admin pages
supabase/functions/provider-proxy/ ← server-side provider bridge (Deno)
.github/workflows/deploy.yml       ← build + deploy to Pages
```

## ⚠️ Ethics Note

Built for **learning full-stack development**. Real SMM panels sell fake engagement,
which violates Instagram/YouTube/TikTok terms and can get accounts banned. Build skills
with this project — grow real accounts with real content.
