import { lookup } from 'node:dns/promises'
import type { Plugin } from 'vite'
import { DEFAULT_SHOP_HOSTS } from '../supabase/functions/link-preview/helpers.ts'
import { fetchShopPreview } from '../supabase/functions/link-preview/fetch.ts'
import type { PreviewFetchOptions } from '../supabase/functions/link-preview/fetch.ts'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

export async function localLinkPreview(request: Request, overrides: Partial<PreviewFetchOptions> = {}) {
  const origin = new URL(request.url).origin
  if (request.headers.get('origin') && request.headers.get('origin') !== origin) return json({ error: 'Nicht erlaubt.' }, 403)
  if (request.method !== 'POST') return json({ error: 'POST erforderlich.' }, 405)
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'JSON erforderlich.' }, 415)
  try {
    const body = await request.text()
    if (body.length > 4096) return json({ error: 'Anfrage zu groß.' }, 413)
    const { url } = JSON.parse(body)
    if (typeof url !== 'string') return json({ error: 'Shop-Link fehlt.' }, 400)
    const preview = await fetchShopPreview(url, {
      allowedHosts: DEFAULT_SHOP_HOSTS,
      resolveAddresses: async host => (await lookup(host, { all: true })).map(answer => answer.address),
      ...overrides,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
    })
    return json(preview)
  } catch {
    return json({ error: 'Für diesen Shop ist keine Vorschau verfügbar. Bitte gib den Titel manuell ein.' }, 422)
  }
}

/** Development only: static hosting continues to use the authenticated Edge Function. */
export function localLinkPreviewPlugin(extraHosts = ''): Plugin {
  const allowedHosts = [...DEFAULT_SHOP_HOSTS, ...extraHosts.toLowerCase().split(',').map(host => host.trim()).filter(Boolean)]
  return {
    name: 'local-link-preview', apply: 'serve',
    configureServer(server) {
      const endpoint = `${server.config.base}__api/link-preview`
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== endpoint) return next()
        const host = request.headers.host || ''
        if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) { response.writeHead(403).end(); return }
        if (request.method !== 'POST') { response.writeHead(405).end(); return }
        const controller = new AbortController()
        response.on('close', () => { if (!response.writableEnded) controller.abort() })
        try {
          let body = ''
          for await (const chunk of request) {
            body += chunk.toString()
            if (body.length > 4096) { response.writeHead(413).end(); return }
          }
          const result = await localLinkPreview(new Request(`http://${host}${endpoint}`, {
            method: 'POST', body, signal: controller.signal,
            headers: { 'Content-Type': request.headers['content-type'] || '', ...(request.headers.origin ? { Origin: request.headers.origin } : {}) },
          }), { allowedHosts })
          if (!response.destroyed) {
            response.writeHead(result.status, Object.fromEntries(result.headers))
            response.end(await result.text())
          }
        } catch { if (!response.destroyed) response.writeHead(500).end() }
      })
    },
  }
}
