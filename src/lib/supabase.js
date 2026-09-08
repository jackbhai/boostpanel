import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False when env keys are missing → App shows a setup screen instead. */
export const isConfigured = Boolean(url && anonKey)

/** Supabase client (null when not configured). */
export const supabase = isConfigured ? createClient(url, anonKey) : null
export const FN_URL = isConfigured ? `${url}/functions/v1` : ''
