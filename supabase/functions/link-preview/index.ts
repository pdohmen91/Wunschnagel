import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { DEFAULT_SHOP_HOSTS } from './helpers.ts'
import { fetchShopPreview } from './fetch.ts'
import { handlePreview } from './handler.ts'
import { RequestError } from './io.ts'

const allowedHosts = [...DEFAULT_SHOP_HOSTS, ...(Deno.env.get('PREVIEW_ALLOWED_HOSTS') || '').toLowerCase().split(',').map(host => host.trim()).filter(Boolean)]
const allowedOrigins = ['https://pdohmen91.github.io', 'http://127.0.0.1:5173', 'http://localhost:5173', ...(Deno.env.get('PREVIEW_ALLOWED_ORIGINS') || '').split(',').map(origin => origin.trim()).filter(Boolean)]

Deno.serve(request => handlePreview(request, {
  allowedHosts, allowedOrigins,
  authorize: async (token, signal) => {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]) }) },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) return null
    return { consumeBudget: async () => { const { data, error } = await client.rpc('consume_preview_budget'); if (error) throw new RequestError(503, 'Vorschau ist gerade nicht verfügbar.'); return data === true } }
  },
  preview: (url, signal) => fetchShopPreview(url, {
        allowedHosts, signal,
        resolveAddresses: async host => {
          const answers = await Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')])
          return answers.flatMap(result => result.status === 'fulfilled' ? result.value : [])
        },
  }),
}))
