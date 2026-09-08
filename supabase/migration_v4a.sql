-- ══════════════════════════════════════════════════════════════
-- BoostPanel v4a — growth + depth: tables & columns (idempotent)
-- coupons · referrals · loyalty · notifications · reviews · faq/macros
-- library (links/templates/alerts) · events/notes · api/provider logs
-- ══════════════════════════════════════════════════════════════

-- ── profiles: referral / loyalty / accent / tags ──
alter table profiles add column if not exists referral_code text;
alter table profiles add column if not exists referred_by uuid references profiles(id) on delete set null;
alter table profiles add column if not exists loyalty_points numeric not null default 0;
alter table profiles add column if not exists accent text not null default 'violet';
alter table profiles add column if not exists tags text not null default '';
create unique index if not exists profiles_referral_code_uidx on profiles(referral_code);
create or replace function public.set_referral_code()
returns trigger language plpgsql as $$
begin
  if NEW.referral_code is null or NEW.referral_code = '' then
    NEW.referral_code := 'BP-' || upper(substr(md5(NEW.id::text || clock_timestamp()::text), 1, 6));
  end if;
  return NEW;
end $$;
drop trigger if exists trg_refcode on profiles;
create trigger trg_refcode before insert on profiles
  for each row execute function public.set_referral_code();
update profiles set referral_code = 'BP-' || upper(substr(md5(id::text), 1, 6)) where referral_code is null;

-- ── settings: growth / transfer / bank / content / support ──
alter table settings add column if not exists referral_reward numeric not null default 0;
alter table settings add column if not exists loyalty_per_100 numeric not null default 1;
alter table settings add column if not exists loyalty_redeem_rate numeric not null default 0.01;
alter table settings add column if not exists transfer_min numeric not null default 10;
alter table settings add column if not exists transfer_fee_pct numeric not null default 0;
alter table settings add column if not exists pay_bank boolean not null default false;
alter table settings add column if not exists bank_info text not null default '';
alter table settings add column if not exists maintenance_msg text not null default '';
alter table settings add column if not exists terms_text text not null default '';
alter table settings add column if not exists privacy_text text not null default '';
alter table settings add column if not exists support_telegram text not null default '';
alter table settings add column if not exists ticket_sla_hours int not null default 24;

-- ── orders / txns / tickets / messages ──
alter table orders add column if not exists coupon_code text not null default '';
alter table orders add column if not exists discount_amt numeric not null default 0;
alter table transactions add column if not exists flagged boolean not null default false;
alter table transactions add column if not exists flag_note text not null default '';
alter table tickets add column if not exists assigned_to text not null default '';
alter table tickets add column if not exists satisfaction int;
alter table ticket_messages add column if not exists attachment_url text not null default '';

-- ── services: ordering + tags ──
alter table services add column if not exists sort int not null default 99;
alter table services add column if not exists tags text not null default '';
update services s set sort = sub.rn from
  (select id, row_number() over (order by id) as rn from services) sub
  where s.id = sub.id and s.sort = 99;

-- ── announcements scheduling / provider latency ──
alter table announcements add column if not exists starts_at timestamptz;
alter table announcements add column if not exists ends_at timestamptz;
alter table providers add column if not exists last_latency_ms int not null default 0;

-- ── coupons ──
create table if not exists coupons (
  id bigint generated always as identity primary key,
  code text not null unique,
  kind text not null default 'pct' check (kind in ('pct', 'flat')),
  value numeric not null default 0,
  max_uses int not null default 0,
  used int not null default 0,
  min_charge numeric not null default 0,
  public boolean not null default false,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists coupon_uses (
  id bigint generated always as identity primary key,
  coupon_id bigint not null references coupons(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  order_id bigint references orders(id) on delete set null,
  amount numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (coupon_id, user_id)
);

-- ── notifications (+ broadcast batches) ──
create table if not exists notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  read boolean not null default false,
  is_broadcast boolean not null default false,
  batch text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists notif_user_idx on notifications(user_id, created_at desc);

-- ── referrals ──
create table if not exists referrals (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid not null unique references profiles(id) on delete cascade,
  reward numeric not null default 0,
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

-- ── service reviews (moderated) ──
create table if not exists reviews (
  id bigint generated always as identity primary key,
  service_id bigint not null,
  user_id uuid not null references profiles(id) on delete cascade,
  order_id bigint unique references orders(id) on delete set null,
  rating int not null check (rating >= 1 and rating <= 5),
  text text not null default '',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── content: faqs + admin macros ──
create table if not exists faqs (
  id bigint generated always as identity primary key,
  q text not null,
  a text not null default '',
  sort int not null default 99,
  active boolean not null default true
);
create table if not exists macros (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

-- ── user library ──
create table if not exists saved_links (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  link text not null,
  created_at timestamptz not null default now()
);
create table if not exists order_templates (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists service_alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  service_id bigint not null,
  kind text not null default 'back_online' check (kind in ('back_online', 'price_below')),
  threshold numeric not null default 0,
  active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, service_id, kind)
);

-- ── ops: order timeline + internal notes ──
create table if not exists order_events (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  event text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists oevents_order_idx on order_events(order_id, id);
create table if not exists order_notes (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  admin_email text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists ticket_notes (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references tickets(id) on delete cascade,
  admin_email text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- ── observability: reseller api + provider balance logs ──
create table if not exists api_logs (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete set null,
  action text not null default '',
  ok boolean not null default true,
  ms int,
  created_at timestamptz not null default now()
);
create index if not exists apilogs_user_idx on api_logs(user_id, created_at desc);
create table if not exists provider_balance_logs (
  id bigint generated always as identity primary key,
  provider_id bigint not null references providers(id) on delete cascade,
  balance numeric not null default 0,
  currency text not null default '',
  created_at timestamptz not null default now()
);
