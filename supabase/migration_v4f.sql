-- v4f: Jack Bank payment gateway config (admin-only secrets, idempotent)
-- Secrets live HERE, never in `settings` (which users can read).

create table if not exists gateway_config (
  id int primary key default 1,
  enabled boolean not null default false,
  base_url text not null default 'https://nksthsgrxudptwdbytoh.supabase.co',
  anon_key text not null default '',
  api_key text not null default '',
  api_secret text not null default '',
  updated_at timestamptz not null default now(),
  constraint gateway_config_single check (id = 1)
);

alter table gateway_config enable row level security;

drop policy if exists "gw admin all" on gateway_config;
create policy "gw admin all" on gateway_config
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on gateway_config to authenticated;

insert into gateway_config (id) values (1) on conflict (id) do nothing;
