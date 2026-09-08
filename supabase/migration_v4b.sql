-- ══════════════════════════════════════════════════════════════
-- BoostPanel v4b — RLS + least-privilege grants for v4 tables (idempotent)
-- Money writes stay server-side (Edge service_role bypasses RLS).
-- ══════════════════════════════════════════════════════════════

alter table coupons enable row level security;
alter table coupon_uses enable row level security;
alter table notifications enable row level security;
alter table referrals enable row level security;
alter table reviews enable row level security;
alter table faqs enable row level security;
alter table macros enable row level security;
alter table saved_links enable row level security;
alter table order_templates enable row level security;
alter table service_alerts enable row level security;
alter table order_events enable row level security;
alter table order_notes enable row level security;
alter table ticket_notes enable row level security;
alter table api_logs enable row level security;
alter table provider_balance_logs enable row level security;

-- ── coupons: public list for users, full control for admins ──
drop policy if exists "coupon read" on coupons;
create policy "coupon read" on coupons for select to authenticated
  using (public.is_admin() or (public and active));
drop policy if exists "coupon admin write" on coupons;
create policy "coupon admin write" on coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── coupon_uses: own read (redemption is server-side) ──
drop policy if exists "uses read" on coupon_uses;
create policy "uses read" on coupon_uses for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- ── notifications: own read/update/delete ──
drop policy if exists "notif read" on notifications;
create policy "notif read" on notifications for select to authenticated
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "notif update" on notifications;
create policy "notif update" on notifications for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
drop policy if exists "notif delete" on notifications;
create policy "notif delete" on notifications for delete to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- ── referrals: referrer reads own ──
drop policy if exists "ref read" on referrals;
create policy "ref read" on referrals for select to authenticated
  using (auth.uid() = referrer_id or public.is_admin());

-- ── reviews: approved public, own visible, admin moderates ──
drop policy if exists "rev read" on reviews;
create policy "rev read" on reviews for select to authenticated
  using (approved or auth.uid() = user_id or public.is_admin());
drop policy if exists "rev admin write" on reviews;
create policy "rev admin write" on reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── faqs / macros ──
drop policy if exists "faq read" on faqs;
create policy "faq read" on faqs for select to authenticated
  using (active or public.is_admin());
drop policy if exists "faq admin write" on faqs;
create policy "faq admin write" on faqs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "macro admin" on macros;
create policy "macro admin" on macros for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── user library: own everything ──
drop policy if exists "own all" on saved_links;
create policy "own all" on saved_links for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own all" on order_templates;
create policy "own all" on order_templates for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own all" on service_alerts;
create policy "own all" on service_alerts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── order timeline: owner + admin ──
drop policy if exists "events read" on order_events;
create policy "events read" on order_events for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.orders o
    where o.id = order_events.order_id and o.user_id = auth.uid()
  ));

-- ── internal notes: admin only ──
drop policy if exists "admin all" on order_notes;
create policy "admin all" on order_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all" on ticket_notes;
create policy "admin all" on ticket_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── logs: own read, admin read-all (writes are server-side) ──
drop policy if exists "apilog read" on api_logs;
create policy "apilog read" on api_logs for select to authenticated
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "pblog admin" on provider_balance_logs;
create policy "pblog admin" on provider_balance_logs for select to authenticated
  using (public.is_admin());

-- ── grants (least privilege; RLS enforces the rest) ──
revoke all on coupons from anon, authenticated;
grant select, insert, update, delete on coupons to authenticated;
revoke all on coupon_uses from anon, authenticated;
grant select on coupon_uses to authenticated;
revoke all on notifications from anon, authenticated;
grant select, update, delete on notifications to authenticated;
revoke all on referrals from anon, authenticated;
grant select on referrals to authenticated;
revoke all on reviews from anon, authenticated;
grant select, insert, update, delete on reviews to authenticated;
revoke all on faqs from anon, authenticated;
grant select, insert, update, delete on faqs to authenticated;
revoke all on macros from anon, authenticated;
grant select, insert, update, delete on macros to authenticated;
revoke all on saved_links from anon, authenticated;
grant select, insert, update, delete on saved_links to authenticated;
revoke all on order_templates from anon, authenticated;
grant select, insert, update, delete on order_templates to authenticated;
revoke all on service_alerts from anon, authenticated;
grant select, insert, update, delete on service_alerts to authenticated;
revoke all on order_events from anon, authenticated;
grant select on order_events to authenticated;
revoke all on order_notes from anon, authenticated;
grant select, insert, update, delete on order_notes to authenticated;
revoke all on ticket_notes from anon, authenticated;
grant select, insert, update, delete on ticket_notes to authenticated;
revoke all on api_logs from anon, authenticated;
grant select on api_logs to authenticated;
revoke all on provider_balance_logs from anon, authenticated;
grant select on provider_balance_logs to authenticated;

-- profiles: allow own accent change (role/status still trigger-guarded)
grant update (api_key, accent) on profiles to authenticated;
