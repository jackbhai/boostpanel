import { create } from 'zustand'
import { gatewayReconcile, getCatalog, getProfile, getSessionUser, getSettings, logSecEvent, mfaAal, mfaVerifyLogin, mySessions, signIn, signOut, signUp, touchSession } from './db'
import { deviceName } from './security'
import { isConfigured } from './supabase'

/** Global app state: session + profile + catalog + settings. */
export const useStore = create((set, get) => ({
  user: null,
  profile: null,
  settings: { site_name: 'BoostPanel', currency: '₹', min_deposit: 100, support_email: '', notice: '' },
  categories: [],
  services: [],
  booted: false,
  authBusy: false,
  setupError: false,

  isAdmin: () => get().profile?.role === 'admin',
  currency: () => get().settings?.currency || '₹',

  /** Load session + profile + catalog on app start. */
  boot: async () => {
    if (!isConfigured) {
      set({ booted: true, setupError: true })
      return
    }
    try {
      const [user, settings, catalog] = await Promise.all([
        getSessionUser().catch(() => null),
        getSettings().catch(() => null),
        getCatalog().catch(() => ({ categories: [], services: [] })),
      ])
      let profile = null
      if (user) profile = await getProfile(user.id).catch(() => null)
      try {
        const a = profile?.accent || localStorage.getItem('bp_accent') || 'violet'
        localStorage.setItem('bp_accent', a)
        document.documentElement.dataset.accent = a
      } catch { /* ignore */ }
      set({
        user: profile ? user : null,
        profile,
        settings: settings || get().settings,
        categories: catalog.categories || [],
        services: catalog.services || [],
        booted: true,
      })
      if (profile) get()._reconcileGw()
    } catch {
      set({ booted: true })
    }
  },

  login: async (email, password) => {
    set({ authBusy: true })
    try {
      const { user, profile } = await signIn(email, password)
      const aal = await mfaAal().catch(() => null)
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        return { needsMfa: true }
      }
      set({ user, profile })
      get()._postAuth(user)
      get()._reconcileGw()
      return profile
    } finally {
      set({ authBusy: false })
    }
  },

  verifyMfa: async (code) => {
    set({ authBusy: true })
    try {
      await mfaVerifyLogin(code)
      const user = await getSessionUser()
      const profile = user ? await getProfile(user.id).catch(() => null) : null
      set({ user, profile })
      if (user) { get()._postAuth(user); get()._reconcileGw() }
      return profile
    } finally {
      set({ authBusy: false })
    }
  },

  /** Silent auto-settle: stuck gateway payments credit themselves on app open. */
  _reconcileGw: () => {
    (async () => {
      try {
        const r = await gatewayReconcile().catch(() => null)
        const paid = (r?.settled || []).filter((s) => s.status === 'paid')
        if (!paid.length) return
        const u = get().user
        const fresh = u ? await getProfile(u.id).catch(() => null) : null
        if (fresh) set({ profile: fresh })
        const total = paid.reduce((a, s) => a + Number(s.credited || 0), 0)
        const [{ toast }, { sfx }] = await Promise.all([import('../components/ui'), import('./sound')])
        sfx('coin')
        toast(`Payment confirmed! ${get().currency()}${Number(total.toFixed(2)).toLocaleString('en-IN')} added to wallet.`)
      } catch { /* never blocks boot */ }
    })()
  },

  /** Fire-and-forget security trail — never blocks auth UX. */
  _postAuth: (user) => {
    (async () => {
      try {
        const dev = deviceName()
        await logSecEvent(user.id, 'login', dev).catch(() => null)
        const sess = await mySessions(user.id).catch(() => [])
        const seen = (sess || []).some((s) => (s.device || '').split('·')[0].trim() === dev.split('·')[0].trim())
        if (!seen) await logSecEvent(user.id, 'new_device', dev).catch(() => null)
        await touchSession(user.id, dev).catch(() => null)
      } catch { /* ignore */ }
    })()
  },

  signup: async (email, password) => {
    set({ authBusy: true })
    try {
      const res = await signUp(email, password)
      if (res.needsVerification) return { needsVerification: true }
      set({ user: res.user, profile: res.profile })
      if (res.user) { get()._postAuth(res.user); get()._reconcileGw() }
      return res.profile
    } finally {
      set({ authBusy: false })
    }
  },

  logout: async () => {
    await signOut()
    set({ user: null, profile: null })
  },

  refreshProfile: async () => {
    const { user } = get()
    if (!user) return
    const profile = await getProfile(user.id).catch(() => null)
    set({ profile })
  },

  refreshCatalog: async () => {
    const catalog = await getCatalog().catch(() => null)
    if (catalog) set({ categories: catalog.categories, services: catalog.services })
  },

  refreshSettings: async () => {
    const settings = await getSettings().catch(() => null)
    if (settings) set({ settings })
  },
}))

export function serviceById(services, id) {
  return services.find((s) => String(s.id) === String(id))
}
