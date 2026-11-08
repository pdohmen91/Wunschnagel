import { createClient } from 'npm:@supabase/supabase-js@2'
import { DEFAULT_SHOP_HOSTS, shopDestination } from './helpers.ts'
import { fetchShopPreview } from './fetch.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const allowedHosts = [...DEFAULT_SHOP_HOSTS, ...(Deno.env.get('PREVIEW_ALLOWED_HOSTS') || '').toLowerCase().split(',').map(host => host.trim()).filter(Boolean)]

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'POST erforderlich.' }, 405)
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Bitte zuerst anmelden.' }, 401)
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser(authorization.slice(7))
  if (error || !data.user) return json({ error: 'Bitte zuerst anmelden.' }, 401)
  try {
    if (Number(request.headers.get('content-length')) > 4096) return json({ error: 'Anfrage zu groß.' }, 413)
    const text = await request.text()
    if (text.length > 4096) return json({ error: 'Anfrage zu groß.' }, 413)
    const { url } = JSON.parse(text)
    if (typeof url !== 'string') return json({ error: 'Shop-Link fehlt.' }, 400)
    shopDestination(url, allowedHosts)
    const { data: allowed, error: budgetError } = await client.rpc('consume_preview_budget')
    if (budgetError) return json({ error: 'Vorschau ist gerade nicht verfügbar.' }, 503)
    if (!allowed) return json({ error: 'Heute wurden bereits 40 Vorschauen geladen. Du kannst den Wunsch manuell ergänzen.' }, 429)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      return json(await fetchShopPreview(url, {
        allowedHosts, signal: controller.signal,
        resolveAddresses: async host => {
          const answers = await Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')])
          return answers.flatMap(result => result.status === 'fulfilled' ? result.value : [])
        },
      }))
    } finally { clearTimeout(timeout) }
  } catch {
    return json({ error: 'Für diesen Shop ist keine Vorschau verfügbar. Bitte ergänze Titel und Bild-Link selbst.' }, 422)
  }
})
