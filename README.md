# 🚀 BoostPanel — SMM Panel (User + Admin)

A **mobile-first** Social Media Marketing (SMM) panel built with **React + Vite + Supabase**.
Includes a full **User Panel** (order services, add funds, track orders, tickets) and an
**Admin Panel** (users, services, orders, funds approval, tickets, settings, analytics).

> University project — demonstrates full-stack web development: frontend, database,
> authentication, wallet logic, role-based access, and API design.

---

## ✨ Features

### 👤 User Panel
| Page | What it does |
|---|---|
| Dashboard | Balance hero, stats, quick actions, announcements, recent orders |
| New Order | Category → service → link → quantity, live price calculator, balance check |
| Services | Searchable catalog with rates/1000, min–max, refill info |
| Mass Order | Bulk ordering via `service_id \| link \| quantity` lines with validation |
| Orders | Filter by status, progress bars, **Refill** & **Cancel (auto-refund)** buttons |
| Add Funds | UPI / Card / Crypto top-up requests with UTR reference |
| Transactions | Full wallet ledger — credits, debits, pending/approved status |
| Tickets | Support system with chat-style replies |
| API Docs | Personal API key + reseller integration examples |
| Profile | Balance, API key, change password |

### 🛠️ Admin Panel (`/admin`)
| Page | What it does |
|---|---|
| Dashboard | Revenue/orders/users stats, 7-day **charts**, pending alerts |
| Orders | Search + filter, update status & remains (**auto-refund math**) |
| Users | Search, add/deduct balance, make admin, ban/unban |
| Services | Full CRUD for categories + services, hide/show services |
| Funds | Approve ✅ / Reject ❌ top-ups (balance auto-credits on approve) |
| Tickets | Reply to users, close/re-open tickets |
| Setup | Site name, currency, min deposit, announcements |

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 (dark mobile-first theme) |
| Routing | React Router (protected + role-based routes) |
| State | Zustand (session, profile, catalog) |
| Backend | **Supabase** (Postgres + Auth) — with automatic **Demo Mode** fallback (browser storage) when keys are missing |
| Charts | Recharts |
| Animation / Icons | Framer Motion, Lucide |

---

## ⚡ Quick Start (Demo Mode — 2 minutes, no account needed)

```bash
cd smm-panel
npm install
npm run dev
```

Open http://localhost:5173 — the app runs in **Demo Mode** (data stays in the browser).
Use the one-click demo logins on the login page:

| Role | Email | Password |
|---|---|---|
| User | `user@demo.io` | `user123` |
| Admin | `admin@demo.io` | `admin123` |

---

## 🗄️ Supabase Setup (Real Database — ~10 minutes, FREE)

1. Go to **https://supabase.com** → sign up → **New Project** (free tier is enough).
2. In Supabase dashboard → **SQL Editor** → paste & run **`supabase/schema.sql`**, then **`supabase/seed.sql`**.
3. **Project Settings → API** → copy the **Project URL** and **anon public key**.
4. In this project:
   ```bash
   cp .env.example .env
   ```
   Paste your keys into `.env`:
   ```
   VITE_SUPABASE_URL=https://xyzcompany.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
5. **Authentication → Providers → Email** → turn **OFF** "Confirm email" (so classroom signups work instantly).
6. Restart the dev server (`npm run dev`). The Demo banner disappears — you're on the live DB.
7. Sign up in the app, then make yourself admin (SQL Editor):
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```

---

## 📁 Project Structure

```
src/
├── lib/
│   ├── db.js          ← ★ ALL business logic (works with BOTH backends)
│   ├── demoDb.js      ← demo database (localStorage) — same API as Supabase layer
│   ├── supabase.js    ← client + auto Demo-Mode detection
│   ├── store.js       ← global state (Zustand): user, profile, catalog
│   └── utils.js       ← money format, charge calc, time-ago, badges
├── data/catalog.js    ← service catalog (mirrors seed.sql)
├── components/
│   ├── ui.jsx         ← buttons, inputs, modals, toasts, badges
│   └── layout.jsx     ← mobile layouts, bottom nav, auth guards
├── pages/
│   ├── auth.jsx       ← login / signup
│   ├── user/          ← 11 user pages
│   └── admin/         ← 7 admin pages
└── App.jsx            ← all routes
supabase/
├── schema.sql         ← tables + RLS policies
└── seed.sql           ← categories, 24 services, settings
```

### How the code works (for viva / presentation)
1. **Dual-backend design** — `lib/db.js` exposes one API (`placeOrder`, `approveTopup`…).
   If Supabase keys exist it queries Postgres, otherwise it uses `demoDb.js` (localStorage).
   Pages never know which backend is active — great separation of concerns.
2. **Order flow** — `placeOrder()` validates min/max → calculates `rate × qty / 1000` →
   checks balance → deducts → inserts order + a debit ledger row.
3. **Refunds** — cancel/partial computes `charge × remains ÷ quantity`, credits the wallet,
   and writes a `refund` ledger entry (money is never lost or created silently).
4. **Route guards** — `RequireAuth` blocks logged-out users; `RequireAdmin` blocks
   non-admins from `/admin/*` (frontend guard + `role` column in DB).
5. **Trade-off to mention** — RLS policies are intentionally permissive for the classroom
   demo; a production panel would scope every query to `auth.uid()` + an admin check.

---

## 🎓 Viva Questions (with short answers)

1. **What is an SMM panel?** — A dashboard to browse, order and track social-media
   marketing services (followers, likes, views…) with wallet payments and reseller APIs.
2. **Why React + Vite?** — Component-based UI + instant dev server and fast production builds.
3. **Why Supabase?** — Free hosted Postgres + built-in authentication; no backend server to manage.
4. **How is the balance kept correct?** — Every balance change writes a row in `transactions`
   (ledger), so funds can always be audited; refunds are proportional to undelivered quantity.
5. **How do user/admin roles work?** — `profiles.role` column; `RequireAdmin` route guard
   + admin-only pages and actions.
6. **What is RLS?** — Row Level Security: Postgres rules that decide which rows each
   user may read/write.
7. **What would you add next?** — Real payment gateway (Razorpay), provider API
   auto-sync, drip-feed scheduling, stricter RLS, unit tests.

---

## 🌐 Deploy (free)

- **Vercel / Netlify**: import this folder → build command `npm run build` → output `dist` →
  add the two `VITE_` env vars → deploy. No server needed (Supabase hosts the data).

---

## ⚠️ Ethics Note (for the classroom)

This project is for **learning full-stack development**. Real SMM panels sell fake
engagement, which violates the terms of Instagram, YouTube, TikTok and others, and can
get accounts shadow-banned or deleted. Fake metrics also mislead real audiences and
advertisers. **Build skills with this demo — grow real accounts with real content.**
