import { create } from 'zustand'
import { getCatalog, getProfile, getSessionUser, getSettings, signIn, signOut, signUp } from './db'
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
    } catch {
      set({ booted: true })
    }
  },

  login: async (email, password) => {
    set({ authBusy: true })
    try {
      const { user, profile } = await signIn(email, password)
      set({ user, profile })
      return profile
    } finally {
      set({ authBusy: false })
    }
  },

  signup: async (email, password) => {
    set({ authBusy: true })
    try {
      const res = await signUp(email, password)
      if (res.needsVerification) return { needsVerification: true }
      set({ user: res.user, profile: res.profile })
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
