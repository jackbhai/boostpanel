/** Service catalog — mirrored in supabase/seed.sql (same ids). Rates = ₹ per 1000. */

export const CATEGORIES = [
  { id: 1, name: 'Instagram', icon: 'instagram', sort: 1, active: true },
  { id: 2, name: 'YouTube', icon: 'youtube', sort: 2, active: true },
  { id: 3, name: 'TikTok', icon: 'tiktok', sort: 3, active: true },
  { id: 4, name: 'Telegram', icon: 'telegram', sort: 4, active: true },
  { id: 5, name: 'Facebook', icon: 'facebook', sort: 5, active: true },
  { id: 6, name: 'X (Twitter)', icon: 'x', sort: 6, active: true },
  { id: 7, name: 'Spotify', icon: 'spotify', sort: 7, active: true },
]

export const SERVICES = [
  // Instagram
  { id: 101, category_id: 1, name: 'Instagram Followers | Real Mix | 30d Refill', platform: 'Instagram', type: 'Followers', rate: 149, min_qty: 100, max_qty: 200000, avg_time: '0-1 hr', refill_days: 30, quality: 'High', active: true, description: 'Real-looking mix followers with 30-day auto refill. Profile must stay public.' },
  { id: 102, category_id: 1, name: 'Instagram Followers | Economy | No Refill', platform: 'Instagram', type: 'Followers', rate: 59, min_qty: 100, max_qty: 100000, avg_time: '0-6 hrs', refill_days: 0, quality: 'Economy', active: true, description: 'Cheapest followers. Drop possible, no refill. Good for testing only.' },
  { id: 103, category_id: 1, name: 'Instagram Likes | Instant | 30d Refill', platform: 'Instagram', type: 'Likes', rate: 39, min_qty: 50, max_qty: 100000, avg_time: '0-30 min', refill_days: 30, quality: 'High', active: true, description: 'Instant start likes for posts & reels. Link must be a post URL.' },
  { id: 104, category_id: 1, name: 'Instagram Reels Views | Superfast', platform: 'Instagram', type: 'Views', rate: 9, min_qty: 100, max_qty: 10000000, avg_time: '0-15 min', refill_days: 0, quality: 'High', active: true, description: 'Very fast reel views. Paste full reel link.' },
  { id: 105, category_id: 1, name: 'Instagram Comments | Custom Text', platform: 'Instagram', type: 'Comments', rate: 499, min_qty: 10, max_qty: 5000, avg_time: '0-12 hrs', refill_days: 0, quality: 'Premium', active: true, description: 'Write comments in quantity box format — one comment per line in link field.' },
  // YouTube
  { id: 201, category_id: 2, name: 'YouTube Subscribers | 30d Refill', platform: 'YouTube', type: 'Subscribers', rate: 899, min_qty: 50, max_qty: 50000, avg_time: '0-24 hrs', refill_days: 30, quality: 'High', active: true, description: 'Channel link required. Slow natural speed, safe for monetized channels is NOT guaranteed.' },
  { id: 202, category_id: 2, name: 'YouTube Views | High Retention', platform: 'YouTube', type: 'Views', rate: 249, min_qty: 500, max_qty: 2000000, avg_time: '0-6 hrs', refill_days: 0, quality: 'Premium', active: true, description: 'High-retention views for watch-time growth. Video must be public & embed allowed.' },
  { id: 203, category_id: 2, name: 'YouTube Likes | Instant', platform: 'YouTube', type: 'Likes', rate: 79, min_qty: 50, max_qty: 100000, avg_time: '0-1 hr', refill_days: 30, quality: 'High', active: true, description: 'Instant likes for any public video.' },
  { id: 204, category_id: 2, name: 'YouTube Watch Hours | 4000h Pack', platform: 'YouTube', type: 'Watch Time', rate: 4999, min_qty: 100, max_qty: 4000, avg_time: '1-7 days', refill_days: 0, quality: 'Premium', active: true, description: 'Long-form video watch hours for monetization requirement. Drip-feed only.' },
  // TikTok
  { id: 301, category_id: 3, name: 'TikTok Followers | 30d Refill', platform: 'TikTok', type: 'Followers', rate: 129, min_qty: 100, max_qty: 500000, avg_time: '0-1 hr', refill_days: 30, quality: 'High', active: true, description: 'Fast TikTok followers. Account must be public.' },
  { id: 302, category_id: 3, name: 'TikTok Video Views | Cheapest', platform: 'TikTok', type: 'Views', rate: 4, min_qty: 100, max_qty: 10000000, avg_time: '0-10 min', refill_days: 0, quality: 'Economy', active: true, description: 'Cheapest views in the panel. Instant start.' },
  { id: 303, category_id: 3, name: 'TikTok Likes | Instant', platform: 'TikTok', type: 'Likes', rate: 29, min_qty: 50, max_qty: 500000, avg_time: '0-30 min', refill_days: 30, quality: 'High', active: true, description: 'Instant likes for TikTok videos.' },
  { id: 304, category_id: 3, name: 'TikTok Shares + Saves Combo', platform: 'TikTok', type: 'Shares', rate: 19, min_qty: 100, max_qty: 100000, avg_time: '0-1 hr', refill_days: 0, quality: 'High', active: true, description: 'Signals boost: shares + saves mixed delivery.' },
  // Telegram
  { id: 401, category_id: 4, name: 'Telegram Channel Members | 30d Refill', platform: 'Telegram', type: 'Members', rate: 199, min_qty: 100, max_qty: 200000, avg_time: '0-2 hrs', refill_days: 30, quality: 'High', active: true, description: 'Public channel/group link required (t.me/...).' },
  { id: 402, category_id: 4, name: 'Telegram Post Views | Last 20 Posts', platform: 'Telegram', type: 'Views', rate: 12, min_qty: 100, max_qty: 1000000, avg_time: '0-30 min', refill_days: 0, quality: 'High', active: true, description: 'Views spread across your last 20 posts.' },
  { id: 403, category_id: 4, name: 'Telegram Reactions 👍❤️🔥 Mixed', platform: 'Telegram', type: 'Reactions', rate: 25, min_qty: 50, max_qty: 100000, avg_time: '0-1 hr', refill_days: 0, quality: 'High', active: true, description: 'Positive emoji reactions on latest post.' },
  // Facebook
  { id: 501, category_id: 5, name: 'Facebook Page Likes + Follows', platform: 'Facebook', type: 'Likes', rate: 179, min_qty: 100, max_qty: 100000, avg_time: '0-6 hrs', refill_days: 30, quality: 'High', active: true, description: 'Page must be public with visible like button.' },
  { id: 502, category_id: 5, name: 'Facebook Post Likes | Instant', platform: 'Facebook', type: 'Likes', rate: 69, min_qty: 50, max_qty: 50000, avg_time: '0-1 hr', refill_days: 0, quality: 'High', active: true, description: 'Instant likes on public posts.' },
  { id: 503, category_id: 5, name: 'Facebook Video Views', platform: 'Facebook', type: 'Views', rate: 35, min_qty: 500, max_qty: 5000000, avg_time: '0-2 hrs', refill_days: 0, quality: 'High', active: true, description: 'Video/Reel views, worldwide mix.' },
  // X
  { id: 601, category_id: 6, name: 'X Followers | 30d Refill', platform: 'X', type: 'Followers', rate: 249, min_qty: 100, max_qty: 100000, avg_time: '0-6 hrs', refill_days: 30, quality: 'High', active: true, description: 'Profile link (x.com/username).' },
  { id: 602, category_id: 6, name: 'X Likes + Reposts Combo', platform: 'X', type: 'Likes', rate: 99, min_qty: 50, max_qty: 50000, avg_time: '0-2 hrs', refill_days: 0, quality: 'High', active: true, description: 'Mixed likes and reposts on tweet link.' },
  { id: 603, category_id: 6, name: 'X Tweet Views | Fast', platform: 'X', type: 'Views', rate: 15, min_qty: 500, max_qty: 10000000, avg_time: '0-30 min', refill_days: 0, quality: 'High', active: true, description: 'Fast impression boost for tweets.' },
  // Spotify
  { id: 701, category_id: 7, name: 'Spotify Plays | Premium Accounts', platform: 'Spotify', type: 'Plays', rate: 149, min_qty: 1000, max_qty: 1000000, avg_time: '0-12 hrs', refill_days: 0, quality: 'Premium', active: true, description: 'Track/album link. Gradual delivery.' },
  { id: 702, category_id: 7, name: 'Spotify Followers | Artist/Profile', platform: 'Spotify', type: 'Followers', rate: 199, min_qty: 100, max_qty: 100000, avg_time: '0-12 hrs', refill_days: 30, quality: 'High', active: true, description: 'Artist or playlist followers.' },
]

export const PLATFORM_COLOR = {
  Instagram: 'from-pink-500 to-amber-400',
  YouTube: 'from-red-500 to-rose-600',
  TikTok: 'from-slate-100 to-slate-400',
  Telegram: 'from-sky-400 to-blue-600',
  Facebook: 'from-blue-500 to-indigo-600',
  X: 'from-zinc-200 to-zinc-500',
  Spotify: 'from-green-400 to-emerald-600',
}
