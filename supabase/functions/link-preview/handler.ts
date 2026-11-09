import { shopDestination } from './helpers.ts'
import { previewFailure } from './errors.ts'
import { abortable, readRequestJson, RequestError } from './io.ts'

type Preview = { title: string; image_url: string; description: string; price: number | null }
export type PreviewServices = {
  allowedHosts: readonly string[]
  allowedOrigins: readonly string[]
  authorize: (token: string, signal: AbortSignal) => Promise<null | { consumeBudget: () => Promise<boolean> }>
  preview: (url: string, signal: AbortSignal) => Promise<Preview>
}

export async function handlePreview(request: Request, services: PreviewServices): Promise<Response> {
  const origin = request.headers.get('origin')
  const allowed = !origin || services.allowedOrigins.includes(origin)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  }
  if (origin && allowed) headers['Access-Control-Allow-Origin'] = origin
  headers['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type'
  headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers })
  if (!allowed) return json({ error: 'Diese Herkunft ist nicht freigegeben.' }, 403)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return json({ error: 'POST erforderlich.' }, 405)
  const authorization = request.headers.get('authorization') || ''
  if (!/^Bearer \S+$/i.test(authorization)) return json({ error: 'Bitte zuerst anmelden.' }, 401)
  // One outer deadline includes auth, upload and the bounded shop request.
  const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(12000)])
  try {
    const body = await readRequestJson(request, AbortSignal.any([deadline, AbortSignal.timeout(2000)]))
    if (typeof body.url !== 'string') return json({ error: 'Shop-Link fehlt.' }, 400)
    shopDestination(body.url, services.allowedHosts)
    const auth = await abortable(services.authorize(authorization.slice(7), deadline), deadline)
    if (!auth) return json({ error: 'Bitte zuerst anmelden.' }, 401)
    if (!await abortable(auth.consumeBudget(), deadline)) return json({ error: 'Heute wurden bereits 40 Vorschauen geladen. Du kannst den Wunsch manuell ergänzen.' }, 429)
    return json(await abortable(services.preview(body.url, AbortSignal.any([deadline, AbortSignal.timeout(8000)])), deadline))
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status)
    if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return json({ error: 'Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.', code: 'timeout' }, 504)
    return json(previewFailure(error), 422)
  }
}
