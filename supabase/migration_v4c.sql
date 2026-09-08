-- v4c: align schema with app code + missing tables + starter content (idempotent)
alter table faqs add column if not exists question text not null default '';
alter table faqs add column if not exists answer text not null default '';
alter table faqs add column if not exists category text not null default 'General';
alter table faqs add column if not exists published boolean not null default true;
alter table reviews add column if not exists admin_reply text not null default '';
alter table settings add column if not exists max_active_orders int not null default 0;

create table if not exists library (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null default '',
  category text not null default 'Guide',
  sort int not null default 99,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists events (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  device text not null default '',
  ip text not null default '',
  last_seen timestamptz not null default now(),
  unique (user_id, device)
);

alter table library enable row level security;
alter table events enable row level security;
alter table sessions enable row level security;

drop policy if exists "lib read" on library;
create policy "lib read" on library for select to authenticated using (published or public.is_admin());
drop policy if exists "lib admin write" on library;
create policy "lib admin write" on library for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ev read" on events;
create policy "ev read" on events for select to authenticated using (published or public.is_admin());
drop policy if exists "ev admin write" on events;
create policy "ev admin write" on events for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "own all" on sessions;
create policy "own all" on sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "faq read" on faqs;
create policy "faq read" on faqs for select to authenticated using (published or public.is_admin());

revoke all on library from anon, authenticated;
grant select, insert, update, delete on library to authenticated;
revoke all on events from anon, authenticated;
grant select, insert, update, delete on events to authenticated;
revoke all on sessions from anon, authenticated;
grant select, insert, update, delete on sessions to authenticated;

-- ── starter content ──
insert into coupons (code, kind, value, max_uses, min_charge, public, active, expires_at)
select 'WELCOME10', 'pct', 10, 1000, 0, true, true, now() + interval '90 days'
where not exists (select 1 from coupons where code = 'WELCOME10');
insert into coupons (code, kind, value, max_uses, min_charge, public, active)
select 'FLAT25', 'flat', 25, 500, 199, true, true
where not exists (select 1 from coupons where code = 'FLAT25');
insert into coupons (code, kind, value, max_uses, min_charge, public, active, expires_at)
select 'MEGA20', 'pct', 20, 200, 499, true, true, now() + interval '30 days'
where not exists (select 1 from coupons where code = 'MEGA20');

update settings set referral_reward = 20 where id = 1 and referral_reward = 0;

insert into faqs (question, answer, category, sort, published, q, a) select v.question, v.answer, v.category, v.sort, v.published, v.question, v.answer from (values
($$How do I place an order?$$, $$Open Services, note the service ID you like, then go to New Order, pick the category and service, paste your link and enter a quantity within the min-max limits. The exact charge is shown before you confirm.$$, 'Orders', 1, true),
($$My order is pending. What should I do?$$, $$Nothing - pending orders are forwarded to the provider automatically. Each service shows an average start time and delivery begins after that. Please do not place a second order on the same link while one is active.$$, 'Orders', 2, true),
($$Can I cancel an order and get a refund?$$, $$Yes, while it is pending, in progress or processing. Open Orders, tap Cancel, and the undelivered amount is refunded to your balance automatically.$$, 'Orders', 3, true),
($$How do I add funds?$$, $$Open Add Funds, choose a method, pay the exact amount, then submit the reference number (12-digit UTR for UPI) plus a screenshot. Admin verifies it and your balance is credited.$$, 'Payments', 4, true),
($$Where do I find the 12-digit UTR number?$$, $$In your UPI app payment history, open the transaction and look for UTR, Ref ID or Transaction ID - it is a 12-digit number. Enter it exactly as shown.$$, 'Payments', 5, true),
($$What is a refill and how do I request one?$$, $$If followers or views drop after delivery, services marked with a refill badge can be topped up. Open Orders, find a completed or partial order and tap Refill.$$, 'Refills', 6, true),
($$How does the reseller API work?$$, $$Copy your API key from API Docs, then POST it with an action (services, add, status, balance, refill, cancel) to the base URL. Use the API Playground to test every call live before writing code.$$, 'Reseller', 7, true),
($$What is drip-feed?$$, $$Drip-feed splits your quantity into smaller runs delivered minutes apart, which looks more natural. Set Runs and Interval on the New Order page for any auto-fulfilled service.$$, 'Reseller', 8, true)
) as v(question, answer, category, sort, published)
where not exists (select 1 from faqs where faqs.question = v.question);

insert into library (title, body, category, sort, published) select * from (values
($$Getting started in 5 minutes$$, $$Create your account and add funds first - UPI is fastest. Then open Services and find a service for your platform; note its ID and price per 1000.

Go to New Order, select the category and service, paste the public link and enter a quantity between the shown min and max. The exact charge is displayed before you confirm - nothing is ever charged silently.

Track everything under Orders with live progress bars and a full history timeline. If anything looks wrong, open a ticket from Help and support will sort it out.$$, 'Guide', 1, true),
($$Mass order format, explained$$, $$Mass Order places many orders in one batch. Put one order per line using this format:

service_id | link | quantity

Example:
104 | https://instagram.com/reel/abc | 5000

Find service IDs on the Services page. Each line is validated - wrong IDs, bad links and out-of-range quantities are flagged before anything is placed, and only valid lines are charged. A coupon applies to the first order of the batch, and you can save line sets as templates on your device.$$, 'Guide', 2, true),
($$Reseller API handbook$$, $$Automate the whole panel from your own app or website. Copy your API key from API Docs - it authenticates every request, no login needed.

POST JSON to the base URL with your key plus an action: services (catalog), add (place order), status, balance, refill, cancel. Every call is logged and your usage stats appear in API Docs.

Open the API Playground to build and send live requests with your own key, inspect the JSON responses and copy the equivalent curl command.$$, 'API', 3, true)
) as v(title, body, category, sort, published)
where not exists (select 1 from library where library.title = v.title);

insert into macros (title, body) select * from (values
('Checking now', 'Thanks for contacting support. We are checking this and will update you shortly.'),
('Forwarded to provider', 'Your order has been forwarded to the provider. Please allow the start time mentioned on the service.'),
('Refilled', 'We have refilled your order. Drops (if any) will recover within 24 hours.'),
('Deposit approved', 'Your deposit has been approved and balance credited. Thank you!'),
('Public link needed', 'This service needs a public link. Please make the target public and reply here.')
) as v(title, body)
where not exists (select 1 from macros where macros.title = v.title);

insert into events (title, body, starts_at, ends_at, published)
select 'Coupons are live', 'Use WELCOME10 for 10 percent off any order, FLAT25 for Rs 25 off above Rs 199. See Rewards for all active offers.', now(), now() + interval '14 days', true
where not exists (select 1 from events where title = 'Coupons are live');

insert into announcements (title, body, active)
select 'Coupons are live', 'Use WELCOME10 for 10% off, FLAT25 for Rs 25 off orders above Rs 199. All offers are listed under Rewards.', true
where not exists (select 1 from announcements where title = 'Coupons are live');
