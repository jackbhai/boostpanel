-- ══════════════════════════════════════════════════════════════
-- BoostPanel — REAL production schema (idempotent: safe to re-run)
-- Tables + secure RLS + storage bucket + auto-triggers
-- First user to sign up becomes ADMIN automatically (claim_first_admin).
-- ══════════════════════════════════════════════════════════════

-- ── Users (1 row per auth user) ──
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  balance numeric not null default 0,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'banned')),
  api_key text not null,
  created_at timestamptz not null default now()
);

-- ── Service categories ──
create table if not exists categories (
  id bigint generated always as identity primary key,
  name text not null,
  icon text not null default '',
  sort int not null default 99,
  active boolean not null default true
);

-- ── API providers (Perfect Panel standard). api_key is ADMIN-ONLY. ──
create table if not exists providers (
  id bigint generated always as identity primary key,
  name text not null,
  api_url text not null,
  api_key text not null,
  balance numeric not null default 0,
  currency text not null default '',
  status text not null default 'active' check (status in ('active', 'disabled')),
  last_sync timestamptz,
  created_at timestamptz not null default now()
);

-- ── Services ──
create table if not exists services (
  id bigint primary key,
  category_id bigint not null references categories(id) on delete cascade,
  name text not null,
  platform text not null default '',
  type text not null default '',
  rate numeric not null default 0,
  min_qty int not null default 1,
  max_qty bigint not null default 100000,
  avg_time text not null default '',
  refill_days int not null default 0,
  quality text not null default '',
  active boolean not null default true,
  description text not null default '',
  provider_id bigint references providers(id) on delete set null,
  provider_service_id text not null default ''
);

-- ── Orders ──
create table if not exists orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  service_id bigint not null,
  link text not null,
  quantity int not null,
  charge numeric not null,
  status text not null default 'pending',
  remains int not null,
  start_count int not null default 0,
  provider_id bigint references providers(id) on delete set null,
  provider_order_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Wallet ledger ──
create table if not exists transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount numeric not null,
  method text not null default '',
  txn_ref text not null default '',
  screenshot_url text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text not null default '',
  created_at timestamptz not null default now()
);

-- ── Support tickets ──
create table if not exists tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  order_id bigint,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  priority text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references tickets(id) on delete cascade,
  sender_id uuid not null,
  sender_role text not null default 'user',
  message text not null,
  created_at timestamptz not null default now()
);

-- ── Announcements + global settings (incl. UPI payments) ──
create table if not exists announcements (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id int primary key,
  site_name text not null default 'BoostPanel',
  currency text not null default '₹',
  min_deposit numeric not null default 100,
  support_email text not null default '',
  notice text not null default '',
  upi_id text not null default '',
  upi_payee text not null default 'BoostPanel',
  pay_upi boolean not null default true,
  pay_card boolean not null default false,
  pay_crypto boolean not null default false,
  card_info text not null default '',
  crypto_info text not null default ''
);

-- ══════════════ Functions ══════════════

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- First-ever admin bootstrap: succeeds only while ZERO admins exist.
create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer set search_path = public as $$
declare admin_count int;
begin
  select count(*) into admin_count from public.profiles where role = 'admin';
  if admin_count = 0 then
    update public.profiles set role = 'admin' where id = auth.uid();
    return true;
  end if;
  return false;
end $$;
grant execute on function public.claim_first_admin() to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end $$;

-- Nobody except admins may change role/status (privilege-escalation guard).
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if ((NEW.role is distinct from OLD.role) or (NEW.status is distinct from OLD.status))
     and not public.is_admin() then
    raise exception 'Only admins can change role or status';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_touch_orders on orders;
create trigger trg_touch_orders before update on orders
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_tickets on tickets;
create trigger trg_touch_tickets before update on tickets
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_guard_profile on profiles;
create trigger trg_guard_profile before update on profiles
  for each row execute function public.guard_profile_privileges();

-- ══════════════ RLS (real, secure) ══════════════

alter table profiles enable row level security;
alter table categories enable row level security;
alter table providers enable row level security;
alter table services enable row level security;
alter table orders enable row level security;
alter table transactions enable row level security;
alter table tickets enable row level security;
alter table ticket_messages enable row level security;
alter table announcements enable row level security;
alter table settings enable row level security;

-- profiles
drop policy if exists "own read" on profiles;
create policy "own read" on profiles for select to authenticated
  using (auth.uid() = id or public.is_admin());
drop policy if exists "signup insert" on profiles;
create policy "signup insert" on profiles for insert to authenticated
  with check (auth.uid() = id);
drop policy if exists "own update" on profiles;
create policy "own update" on profiles for update to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- categories
drop policy if exists "catalog read" on categories;
create policy "catalog read" on categories for select to authenticated using (true);
drop policy if exists "admin insert" on categories;
create policy "admin insert" on categories for insert to authenticated with check (public.is_admin());
drop policy if exists "admin update" on categories;
create policy "admin update" on categories for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete" on categories;
create policy "admin delete" on categories for delete to authenticated using (public.is_admin());

-- providers (admin only — contains secret API keys)
drop policy if exists "admin select" on providers;
create policy "admin select" on providers for select to authenticated using (public.is_admin());
drop policy if exists "admin insert" on providers;
create policy "admin insert" on providers for insert to authenticated with check (public.is_admin());
drop policy if exists "admin update" on providers;
create policy "admin update" on providers for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete" on providers;
create policy "admin delete" on providers for delete to authenticated using (public.is_admin());

-- services
drop policy if exists "catalog read" on services;
create policy "catalog read" on services for select to authenticated using (true);
drop policy if exists "admin insert" on services;
create policy "admin insert" on services for insert to authenticated with check (public.is_admin());
drop policy if exists "admin update" on services;
create policy "admin update" on services for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete" on services;
create policy "admin delete" on services for delete to authenticated using (public.is_admin());

-- orders
drop policy if exists "own read" on orders;
create policy "own read" on orders for select to authenticated
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "own insert" on orders;
create policy "own insert" on orders for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "own update" on orders;
create policy "own update" on orders for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- transactions
drop policy if exists "own read" on transactions;
create policy "own read" on transactions for select to authenticated
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "own insert" on transactions;
create policy "own insert" on transactions for insert to authenticated
  with check (auth.uid() = user_id or public.is_admin());
drop policy if exists "admin update" on transactions;
create policy "admin update" on transactions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- tickets
drop policy if exists "own read" on tickets;
create policy "own read" on tickets for select to authenticated
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "own insert" on tickets;
create policy "own insert" on tickets for insert to authenticated
  with check (auth.uid() = user_id or public.is_admin());
drop policy if exists "own update" on tickets;
create policy "own update" on tickets for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- ticket_messages
drop policy if exists "thread read" on ticket_messages;
create policy "thread read" on ticket_messages for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid()
  ));
drop policy if exists "own insert" on ticket_messages;
create policy "own insert" on ticket_messages for insert to authenticated
  with check (auth.uid() = sender_id);

-- announcements
drop policy if exists "read all" on announcements;
create policy "read all" on announcements for select to authenticated using (true);
drop policy if exists "admin insert" on announcements;
create policy "admin insert" on announcements for insert to authenticated with check (public.is_admin());
drop policy if exists "admin update" on announcements;
create policy "admin update" on announcements for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete" on announcements;
create policy "admin delete" on announcements for delete to authenticated using (public.is_admin());

-- settings
drop policy if exists "read all" on settings;
create policy "read all" on settings for select to authenticated using (true);
drop policy if exists "admin update" on settings;
create policy "admin update" on settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ══════════════ Storage: payment screenshots ══════════════
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do update set public = true;

drop policy if exists "auth upload proofs" on storage.objects;
create policy "auth upload proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs');
