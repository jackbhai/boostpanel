import { createClient } from '@supabase/supabase-js'

/** Forgiving env parse: trims, strips quotes, recovers a pasted "NAME=value" line. */
const clean = (v) => {
  let s = String(v || '').trim().replace(/^["']|["']$/g, '').trim()
  const eq = s.indexOf('=')
  if (eq > 0 && /^[\w-]+$/.test(s.slice(0, eq))) s = s.slice(eq + 1).trim()
  return s
}

const url = clean(import.meta.env.VITE_SUPABASE_URL)
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

let urlOk = false
try {
  const u = new URL(url)
  urlOk = u.protocol === 'https:' && !!u.hostname
} catch { urlOk = false }

/** False when env keys are missing → App shows a setup screen instead. */
export const isConfigured = Boolean(urlOk && anonKey)

/** Supabase client (null when not configured). */
export const supabase = isConfigured ? createClient(url, anonKey) : null
export const FN_URL = isConfigured ? `${url}/functions/v1` : ''
