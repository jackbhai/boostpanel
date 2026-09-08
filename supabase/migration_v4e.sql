-- v4e: realtime publication + server rate-limit store + user security log (idempotent)

-- 1) Realtime: instant tickets / orders / notifs / funds / catalog / announcements
do $$
declare t text;
begin
  foreach t in array array['ticket_messages','tickets','orders','notifications','transactions','services','announcements','profiles'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 2) Rate-limit hits (service_role only — RLS enabled, zero policies = locked)
create table if not exists rate_hits (
  id bigserial primary key,
  user_id uuid not null,
  op text not null default '',
  ts timestamptz not null default now()
);
alter table rate_hits enable row level security;
create index if not exists rate_hits_lookup on rate_hits (user_id, op, ts desc);

-- 3) Security events: logins, new devices, 2FA changes, password changes
create table if not exists security_events (
  id bigserial primary key,
  user_id uuid not null,
  kind text not null default 'login',
  detail text not null default '',
  created_at timestamptz not null default now()
);
alter table security_events enable row level security;
drop policy if exists "sec own read" on security_events;
create policy "sec own read" on security_events
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "sec own write" on security_events;
create policy "sec own write" on security_events
  for insert to authenticated with check (auth.uid() = user_id);
grant select, insert on security_events to authenticated;
create index if not exists sec_lookup on security_events (user_id, created_at desc);
