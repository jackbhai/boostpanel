/* ─────────────────────────────────────────────────────────────
   BoostPanel custom icon set — 100% hand-drawn original vectors.
   24×24 grid, round caps, currentColor. Drop-in API: <Icon size={20}
   className="..." strokeWidth={2} />
   ───────────────────────────────────────────────────────────── */

function I({ size = 24, strokeWidth = 2, fill = 'none', children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

/* ------------------------- navigation ------------------------- */

export const Home = (p) => (
  <I {...p}><path d="M4 11l8-7 8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></I>
)
export const Search = (p) => (
  <I {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></I>
)
export const Menu = (p) => (
  <I {...p}><path d="M4 7h16M4 12h16M4 17h16" /></I>
)
export const ArrowLeft = (p) => (
  <I {...p}><path d="M20 12H5" /><path d="M10 7l-5 5 5 5" /></I>
)
export const ArrowRight = (p) => (
  <I {...p}><path d="M4 12h15" /><path d="M14 7l5 5-5 5" /></I>
)
export const ArrowUpRight = (p) => (
  <I {...p}><path d="M6 18L18 6" /><path d="M8 6h10v10" /></I>
)
export const ArrowDownLeft = (p) => (
  <I {...p}><path d="M18 6L6 18" /><path d="M16 18H6V8" /></I>
)
export const ChevronRight = (p) => (
  <I {...p}><path d="M9 5l7 7-7 7" /></I>
)
export const ExternalLink = (p) => (
  <I {...p}><path d="M14 4h6v6" /><path d="M20 4L11 13" /><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></I>
)

/* ------------------------- actions ------------------------- */

export const Plus = (p) => (
  <I {...p}><path d="M12 5v14M5 12h14" /></I>
)
export const X = (p) => (
  <I {...p}><path d="M6 6l12 12M18 6L6 18" /></I>
)
export const Check = (p) => (
  <I {...p}><path d="M4 12.5l5 5L20 6.5" /></I>
)
export const Copy = (p) => (
  <I {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></I>
)
export const Pencil = (p) => (
  <I {...p}><path d="M4 20l1-4L16.5 4.5a1.5 1.5 0 0 1 2 2L7 18l-3 2z" /><path d="M14.5 6.5l3 3" /></I>
)
export const Trash2 = (p) => (
  <I {...p}><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /><path d="M10 11v6M14 11v6" /></I>
)
export const Send = (p) => (
  <I {...p}><path d="M21 3L3 10.5l7 2 2 7L21 3z" /><path d="M10 12.5L21 3" /></I>
)
export const Download = (p) => (
  <I {...p}><path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></I>
)
export const Upload = (p) => (
  <I {...p}><path d="M12 15V4" /><path d="M7 8l5-5 5 5" /><path d="M4 20h16" /></I>
)
export const RefreshCw = (p) => (
  <I {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></I>
)
export const RefreshCcw = (p) => (
  <I {...p}><path d="M3 12a9 9 0 1 0 2.64-6.36" /><path d="M3 3v6h6" /></I>
)
export const LogOut = (p) => (
  <I {...p}><path d="M14 3h6v18h-6" /><path d="M3 12h12" /><path d="M11 8l4 4-4 4" /></I>
)
export const Eye = (p) => (
  <I {...p}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></I>
)
export const Lock = (p) => (
  <I {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></I>
)
export const Power = (p) => (
  <I {...p}><path d="M12 3v8" /><path d="M6.3 6.3a8 8 0 1 0 11.4 0" /></I>
)

/* ------------------------- status ------------------------- */

export const CheckCircle2 = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></I>
)
export const CheckCircle = CheckCircle2
export const AlertCircle = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5h.01" /></I>
)
export const XCircle = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></I>
)
export const Info = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5h.01" /></I>
)
export const BadgeCheck = (p) => (
  <I {...p}><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4.5" /></I>
)
export const Shield = (p) => (
  <I {...p}><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /></I>
)

/* ------------------------- objects ------------------------- */

export const LayoutGrid = (p) => (
  <I {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></I>
)
export const Grid = LayoutGrid
export const ShoppingCart = (p) => (
  <I {...p}><path d="M3 4h2l2.4 12.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6" /><circle cx="10" cy="20.5" r="1.3" /><circle cx="18" cy="20.5" r="1.3" /></I>
)
export const Cart = ShoppingCart
export const ClipboardList = (p) => (
  <I {...p}><rect x="5" y="4.5" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5" /><path d="M9 10h6M9 14h6M9 18h4" /></I>
)
export const Clipboard = ClipboardList
export const Box = (p) => (
  <I {...p}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M4 7.5l8 4.5 8-4.5" /><path d="M12 12v9" /></I>
)
export const Layers = (p) => (
  <I {...p}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></I>
)
export const Ticket = (p) => (
  <I {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" /><path d="M14 6v12" strokeDasharray="2 2.5" /></I>
)
export const Receipt = (p) => (
  <I {...p}><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5L10 21l-2-1.5L6 21V3z" /><path d="M9 8h6M9 12h6" /></I>
)
export const Wallet = (p) => (
  <I {...p}><path d="M19 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" /><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1" /><path d="M17 14h.01" /></I>
)
export const CreditCard = (p) => (
  <I {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><path d="M2.5 10h19" /><path d="M6 15h4" /></I>
)
export const QrCode = (p) => (
  <I {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><path d="M14 14h2.5v2.5H14z" /><path d="M19.5 14v6.5H14" /></I>
)
export const Plug = (p) => (
  <I {...p}><path d="M9 7V3M15 7V3" /><path d="M7 7h10v4a5 5 0 0 1-10 0V7z" /><path d="M12 16v5" /></I>
)
export const Settings = (p) => (
  <I {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.2 5.2l2 2M16.8 16.8l2 2M18.8 5.2l-2 2M7.2 16.8l-2 2" /></I>
)
export const Bell = (p) => (
  <I {...p}><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15L6 16z" /><path d="M10 21a2.2 2.2 0 0 0 4 0" /></I>
)
export const Clock = (p) => (
  <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></I>
)
export const Calendar = (p) => (
  <I {...p}><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></I>
)
export const Camera = (p) => (
  <I {...p}><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="14" r="3.5" /></I>
)
export const Globe = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18" /></I>
)
export const Wifi = (p) => (
  <I {...p}><path d="M2.5 9a15 15 0 0 1 19 0" /><path d="M5.5 12.5a10 10 0 0 1 13 0" /><path d="M8.5 16a5 5 0 0 1 7 0" /><path d="M12 19.2h.01" /></I>
)
export const Zap = (p) => (
  <I {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" /></I>
)
export const Rocket = (p) => (
  <I {...p}><path d="M12 2c2.8 1.8 4 5.5 4 9l-4 3-4-3c0-3.5 1.2-7.2 4-9z" /><circle cx="12" cy="9" r="1.6" /><path d="M8.2 13.5L5.5 18l2.8-1M15.8 13.5l2.7 4.5-2.8-1" /><path d="M12 17v4" /></I>
)
export const Star = (p) => (
  <I {...p}><path d="M12 3l2.7 5.6 6.1.8-4.5 4.1 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" /></I>
)
export const Sparkles = (p) => (
  <I {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /><path d="M19 15l.9 2.1 2.1.9-2.1.9-0.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" /></I>
)
export const TrendingUp = (p) => (
  <I {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></I>
)
export const Tag = (p) => (
  <I {...p}><path d="M3 12V3h9l9 9-9 9-9-9z" /><circle cx="8" cy="8" r="1.3" /></I>
)
export const LinkIcon = (p) => (
  <I {...p}><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5" /><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1.5-1.5" /></I>
)
export const Percent = (p) => (
  <I {...p}><path d="M19 5L5 19" /><circle cx="7.5" cy="7.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /></I>
)
export const Music = (p) => (
  <I {...p}><path d="M9 18V6l10-2v11" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="15" r="2.5" /></I>
)
export const MessageCircle = (p) => (
  <I {...p}><path d="M12 3c5.5 0 10 4 10 9s-4.5 9-10 9c-1.5 0-3-.3-4.2-.7L3 21l1-3.5C2.7 15.7 2 14 2 12c0-5 4.5-9 10-9z" /></I>
)
export const LifeBuoy = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M5.7 5.7l3 3M15.3 15.3l3 3M18.3 5.7l-3 3M8.7 15.3l-3 3" /></I>
)
export const Megaphone = (p) => (
  <I {...p}><path d="M5 9v6l11 4V5L5 9z" /><path d="M9 15.5V20" /></I>
)

/* ------------------------- people ------------------------- */

export const User = (p) => (
  <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></I>
)
export const Users = (p) => (
  <I {...p}><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16.2 14.2c2.7.5 4.8 2.8 4.8 5.8" /></I>
)

/* ------------------------- money ------------------------- */

export const Rupee = (p) => (
  <I {...p}><path d="M6 4h12" /><path d="M6 8h12" /><path d="M6 4c7 0 10 .8 10 5s-3 5-8 5l8 6" /></I>
)
export const BadgeIndianRupee = Rupee
export const Bitcoin = (p) => (
  <I {...p}><path d="M9 3.5V20" /><path d="M6 7.5h8a3.5 3.5 0 0 1 0 7H6z" /><path d="M6 14.5h9a3.5 3.5 0 0 1 0 7H6" /></I>
)

/* ------------------------- platforms (original line-art) ------------------------- */

export const Instagram = (p) => (
  <I {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.2 6.8h.01" /></I>
)
export const Youtube = (p) => (
  <I {...p}><rect x="2.5" y="6" width="19" height="12" rx="4" /><path d="M10.5 9.8l4.5 2.2-4.5 2.2V9.8z" /></I>
)
export const Tiktok = (p) => (
  <I {...p}><circle cx="9" cy="18" r="3.2" /><path d="M12.2 18V4l8-1.5V13" /><circle cx="16.8" cy="13" r="3.2" /></I>
)
export const Telegram = (p) => (
  <I {...p}><path d="M20.5 3.5L3 10.8l6.8 2.3 2.6 7.4 4-4.6 4.1-12.4z" /><path d="M9.8 13.1l10.7-9.6" /></I>
)
export const Facebook = (p) => (
  <I {...p}><path d="M14 8.5h2.5V5H14a3.5 3.5 0 0 0-3.5 3.5v2.5H8V14.5h2.5v6.5h3.5v-6.5H16.5l.5-3.5h-3V8.5z" /></I>
)
export const XBrand = (p) => (
  <I {...p} strokeWidth={p.strokeWidth || 2.6}><path d="M5 4l14 16M19 4L5 20" /></I>
)
export const Spotify = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M8 10.5c2.8-.8 5.5-.5 8 .8" /><path d="M8.5 13.5c2.3-.7 4.5-.4 6.5.7" /><path d="M9 16.2c1.8-.5 3.4-.3 5 .6" /></I>
)

/** Pick a platform glyph by (category/service) name. */
export function PlatformIcon({ platform = '', size = 18, ...props }) {
  const n = String(platform).toLowerCase()
  if (n.includes('insta')) return <Instagram size={size} {...props} />
  if (n.includes('you')) return <Youtube size={size} {...props} />
  if (n.includes('tik')) return <Tiktok size={size} {...props} />
  if (n.includes('tele')) return <Telegram size={size} {...props} />
  if (n.includes('face')) return <Facebook size={size} {...props} />
  if (n === 'x' || n.includes('twitter')) return <XBrand size={size} {...props} />
  if (n.includes('spot')) return <Spotify size={size} {...props} />
  return <Tag size={size} {...props} />
}

/* ------------------------- v5: security + sound ------------------------- */

export const KeyRound = (p) => (
  <I {...p}><circle cx="8" cy="14" r="4.2" /><path d="M11.2 10.8L20 2.5" /><path d="M16.5 6l2.6 2.6" /><path d="M13.8 8.7l2.4 2.4" /></I>
)

export const Volume2 = (p) => (
  <I {...p}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" /><path d="M15 9a4.2 4.2 0 010 6" /><path d="M17.4 6.6a7.6 7.6 0 010 10.8" /></I>
)

export const VolumeX = (p) => (
  <I {...p}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" /><path d="M15.5 9.5l5 5" /><path d="M20.5 9.5l-5 5" /></I>
)

export const Share = (p) => (
  <I {...p}><circle cx="6.5" cy="12" r="2.5" /><circle cx="17" cy="5.8" r="2.5" /><circle cx="17" cy="18.2" r="2.5" /><path d="M8.7 10.9l6-3.3M8.7 13.1l6 3.3" /></I>
)
