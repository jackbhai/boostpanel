-- ══════════════════════════════════════════════════════════════
-- BoostPanel — seed: service catalog + default settings (NO demo data)
-- Run AFTER schema.sql. Safe to re-run (upserts).
-- ══════════════════════════════════════════════════════════════

insert into categories (id, name, icon, sort, active) overriding system value values
  (1, 'Instagram',  '📸', 1, true),
  (2, 'YouTube',    '▶️', 2, true),
  (3, 'TikTok',     '🎵', 3, true),
  (4, 'Telegram',   '✈️', 4, true),
  (5, 'Facebook',   '👍', 5, true),
  (6, 'X (Twitter)','𝕏', 6, true),
  (7, 'Spotify',    '🎧', 7, true)
on conflict (id) do update set name = excluded.name, icon = excluded.icon, sort = excluded.sort;

insert into services (id, category_id, name, platform, type, rate, min_qty, max_qty, avg_time, refill_days, quality, active, description) values
  (101, 1, 'Instagram Followers | Real Mix | 30d Refill', 'Instagram', 'Followers', 149, 100, 200000, '0-1 hr', 30, 'High', true, 'Real-looking mix followers with 30-day auto refill. Profile must stay public.'),
  (102, 1, 'Instagram Followers | Economy | No Refill', 'Instagram', 'Followers', 59, 100, 100000, '0-6 hrs', 0, 'Economy', true, 'Cheapest followers. Drop possible, no refill. Good for testing only.'),
  (103, 1, 'Instagram Likes | Instant | 30d Refill', 'Instagram', 'Likes', 39, 50, 100000, '0-30 min', 30, 'High', true, 'Instant start likes for posts & reels. Link must be a post URL.'),
  (104, 1, 'Instagram Reels Views | Superfast', 'Instagram', 'Views', 9, 100, 10000000, '0-15 min', 0, 'High', true, 'Very fast reel views. Paste full reel link.'),
  (105, 1, 'Instagram Comments | Custom Text', 'Instagram', 'Comments', 499, 10, 5000, '0-12 hrs', 0, 'Premium', true, 'One comment per line in link field.'),
  (201, 2, 'YouTube Subscribers | 30d Refill', 'YouTube', 'Subscribers', 899, 50, 50000, '0-24 hrs', 30, 'High', true, 'Channel link required. Slow natural speed.'),
  (202, 2, 'YouTube Views | High Retention', 'YouTube', 'Views', 249, 500, 2000000, '0-6 hrs', 0, 'Premium', true, 'High-retention views. Video must be public & embed allowed.'),
  (203, 2, 'YouTube Likes | Instant', 'YouTube', 'Likes', 79, 50, 100000, '0-1 hr', 30, 'High', true, 'Instant likes for any public video.'),
  (204, 2, 'YouTube Watch Hours | 4000h Pack', 'YouTube', 'Watch Time', 4999, 100, 4000, '1-7 days', 0, 'Premium', true, 'Long-form watch hours for monetization requirement. Drip-feed only.'),
  (301, 3, 'TikTok Followers | 30d Refill', 'TikTok', 'Followers', 129, 100, 500000, '0-1 hr', 30, 'High', true, 'Fast TikTok followers. Account must be public.'),
  (302, 3, 'TikTok Video Views | Cheapest', 'TikTok', 'Views', 4, 100, 10000000, '0-10 min', 0, 'Economy', true, 'Cheapest views in the panel. Instant start.'),
  (303, 3, 'TikTok Likes | Instant', 'TikTok', 'Likes', 29, 50, 500000, '0-30 min', 30, 'High', true, 'Instant likes for TikTok videos.'),
  (304, 3, 'TikTok Shares + Saves Combo', 'TikTok', 'Shares', 19, 100, 100000, '0-1 hr', 0, 'High', true, 'Signals boost: shares + saves mixed delivery.'),
  (401, 4, 'Telegram Channel Members | 30d Refill', 'Telegram', 'Members', 199, 100, 200000, '0-2 hrs', 30, 'High', true, 'Public channel/group link required (t.me/...).'),
  (402, 4, 'Telegram Post Views | Last 20 Posts', 'Telegram', 'Views', 12, 100, 1000000, '0-30 min', 0, 'High', true, 'Views spread across your last 20 posts.'),
  (403, 4, 'Telegram Reactions Mixed', 'Telegram', 'Reactions', 25, 50, 100000, '0-1 hr', 0, 'High', true, 'Positive emoji reactions on latest post.'),
  (501, 5, 'Facebook Page Likes + Follows', 'Facebook', 'Likes', 179, 100, 100000, '0-6 hrs', 30, 'High', true, 'Instant likes on public posts.'),
  (502, 5, 'Facebook Post Likes | Instant', 'Facebook', 'Likes', 69, 50, 50000, '0-1 hr', 0, 'High', true, 'Instant likes on public posts.'),
  (503, 5, 'Facebook Video Views', 'Facebook', 'Views', 35, 500, 5000000, '0-2 hrs', 0, 'High', true, 'Video/Reel views, worldwide mix.'),
  (601, 6, 'X Followers | 30d Refill', 'X', 'Followers', 249, 100, 100000, '0-6 hrs', 30, 'High', true, 'Profile link (x.com/username).'),
  (602, 6, 'X Likes + Reposts Combo', 'X', 'Likes', 99, 50, 50000, '0-2 hrs', 0, 'High', true, 'Mixed likes and reposts on tweet link.'),
  (603, 6, 'X Tweet Views | Fast', 'X', 'Views', 15, 500, 10000000, '0-30 min', 0, 'High', true, 'Fast impression boost for tweets.'),
  (701, 7, 'Spotify Plays | Premium Accounts', 'Spotify', 'Plays', 149, 1000, 1000000, '0-12 hrs', 0, 'Premium', true, 'Track/album link. Gradual delivery.'),
  (702, 7, 'Spotify Followers | Artist/Profile', 'Spotify', 'Followers', 199, 100, 100000, '0-12 hrs', 30, 'High', true, 'Artist or playlist followers.')
on conflict (id) do update set
  name = excluded.name, rate = excluded.rate, min_qty = excluded.min_qty,
  max_qty = excluded.max_qty, active = excluded.active;

insert into settings (id, site_name, currency, min_deposit, support_email, notice,
  upi_id, upi_payee, pay_upi, pay_card, pay_crypto, card_info, crypto_info) values
  (1, 'BoostPanel', '₹', 100, '', '',
   '', 'BoostPanel', true, false, false, '', '')
on conflict (id) do nothing;
