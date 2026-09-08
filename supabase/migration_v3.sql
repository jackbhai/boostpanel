-- ══════════════════════════════════════════════════════════════
-- BoostPanel v3 — deep features + END-TO-END security
-- • New: user discount/limits/notes, service margin+cost, drip columns,
--   signup bonus, maintenance mode, deposit bonus, favorites, audit logs
-- • Security: ALL money mutations move server-side (Edge). Direct client
--   writes on orders/transactions/balance are REVOKED. Least-privilege grants.
-- Idempotent — safe to re-run.
-- ══════════════════════════════════════════════════════════════

-- ── new columns ──
alter table profiles add column if not exists discount_pct numeric not null default 0;
alter table profiles add column if not exists order_limit int not null default 0;
alter table profiles add column if not exists note text not null default '';
alter table services add column if not exists margin_pct numeric not null default 0;
alter table services add column if not exists cost_rate numeric not null default 0;
alter table orders add column if not exists runs int not null default 0;
alter table orders add column if not exists interval_mins int not null default 0;
alter table settings add column if not exists signup_bonus numeric not null default 0;
alter table settings add column if not exists maintenance boolean not null default false;
alter table settings add column if not exists deposit_bonus_pct numeric not null default 0;

-- ── favorites ──
create table if not exists favorites (
  user_id uuid not null references profiles(id) on delete cascade,
  service_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, service_id)
);

-- ── audit log (admin actions, written ONLY by Edge Functions) ──
create table if not exists admin_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text not null default '',
  action text not null,
  target text not null default '',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ── tamper-proof signup: force safe values + bonus ──
create or replace function public.lock_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare b numeric;
begin
  select coalesce(signup_bonus, 0) into b from public.settings where id = 1;
  NEW.balance := coalesce(b, 0);
  NEW.role := 'user';
  NEW.status := 'active';
  return NEW;
end $$;
drop trigger if exists trg_lock_profile on profiles;
create trigger trg_lock_profile before insert on profiles
  for each row execute function public.lock_new_profile();

-- ── RLS for new tables ──
alter table favorites enable row level security;
alter table admin_logs enable row level security;

drop policy if exists "own all" on favorites;
create policy "own all" on favorites for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin read" on admin_logs;
create policy "admin read" on admin_logs for select to authenticated
  using (public.is_admin());

-- ── tighten: client can NO LONGER write orders / transactions ──
drop policy if exists "own insert" on orders;
drop policy if exists "own update" on orders;
drop policy if exists "admin insert" on orders;
create policy "admin insert" on orders for insert to authenticated
  with check (public.is_admin());
drop policy if exists "admin update" on orders;
create policy "admin update" on orders for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "own insert" on transactions;

-- ── least-privilege GRANTS (policies alone are not enough) ──
revoke all on profiles from anon, authenticated;
grant select, insert on profiles to authenticated;
grant update (api_key) on profiles to authenticated;

revoke all on orders from anon, authenticated;
grant select on orders to authenticated;

revoke all on transactions from anon, authenticated;
grant select on transactions to authenticated;

revoke all on tickets from anon, authenticated;
grant select, insert, update on tickets to authenticated;
revoke all on ticket_messages from anon, authenticated;
grant select, insert on ticket_messages to authenticated;

revoke all on categories from anon, authenticated;
grant select, insert, update, delete on categories to authenticated;
revoke all on services from anon, authenticated;
grant select, insert, update, delete on services to authenticated;
revoke all on providers from anon, authenticated;
grant select, insert, update, delete on providers to authenticated;
revoke all on announcements from anon, authenticated;
grant select, insert, update, delete on announcements to authenticated;
revoke all on settings from anon, authenticated;
grant select, update on settings to authenticated;

revoke all on favorites from anon, authenticated;
grant all on favorites to authenticated;
revoke all on admin_logs from anon, authenticated;
grant select on admin_logs to authenticated;

-- ── tidy: category icon keys ──
update categories set icon = case name
  when 'Instagram' then 'instagram' when 'YouTube' then 'youtube'
  when 'TikTok' then 'tiktok' when 'Telegram' then 'telegram'
  when 'Facebook' then 'facebook' when 'X (Twitter)' then 'x'
  when 'Spotify' then 'spotify' else icon end;
