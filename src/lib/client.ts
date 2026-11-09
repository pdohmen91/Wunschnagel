import { createClient } from '@supabase/supabase-js'
import { sanitizeAuthCallback } from './authCallback'

const callback = sanitizeAuthCallback(window.location.href)
if (callback.href !== window.location.href) window.history.replaceState(window.history.state, '', callback.href)
export const authCallbackWarning = callback.warning

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const supabase = url && key && !url.includes('YOUR_PROJECT') && !key.includes('YOUR_')
  ? createClient(url, key, { auth: {
    persistSession: true, autoRefreshToken: true, flowType: 'pkce',
    // In this SDK this callback controls implicit-grant detection. PKCE code
    // detection separately requires the locally stored verifier.
    detectSessionInUrl: () => false,
  } })
  : null
