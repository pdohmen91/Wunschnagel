import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readRequestJson, RequestError, abortable } from '../supabase/functions/link-preview/io.ts'
import { handlePreview } from '../supabase/functions/link-preview/handler.ts'
import { fetchShopPreview } from '../supabase/functions/link-preview/fetch.ts'
import { metadata } from '../supabase/functions/link-preview/helpers.ts'
import { sanitizeAuthCallback } from '../src/lib/authCallback.ts'
import { assertPublicConfiguration, contentSecurityPolicy } from '../server/securityPolicy.ts'

const fixture = { title: 'Ein Wunsch', image_url: '', description: '', price: 10 }
const origin = 'https://pdohmen91.github.io'
const signal = () => new AbortController().signal
const request = (body: BodyInit = '{"url":"https://www.thalia.de/product"}', headers = {}) => new Request('https://project.supabase.co/functions/v1/link-preview', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer valid-fixture', origin, ...headers }, body, duplex: 'half' } as RequestInit)

test('body limits count actual UTF-8 bytes without relying on Content-Length', async () => {
  const input = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('ü'.repeat(2100))); controller.close() } })
  await assert.rejects(readRequestJson(request(input), signal()), e => e instanceof RequestError && e.status === 413)
  await assert.rejects(readRequestJson(request('{}', { 'content-length': '5000' }), signal()), e => e instanceof RequestError && e.status === 413)
  await assert.rejects(readRequestJson(request('null'), signal()), e => e instanceof RequestError && e.status === 400)
  await assert.rejects(readRequestJson(request('{}', { 'content-type': 'text/plain' }), signal()), e => e instanceof RequestError && e.status === 415)
})

test('abort deadlines interrupt stalled uploads, DNS, fetches and body reads', async () => {
  const stream = new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}) }, cancel() { return new Promise(() => {}) } })
  const controller = new AbortController()
  const reading = readRequestJson(request(stream), controller.signal)
  controller.abort(new DOMException('Stopped', 'AbortError'))
  await assert.rejects(reading, /Stopped/)
  for (const stage of ['dns', 'fetch', 'body']) {
    const stop = new AbortController()
    const pending = fetchShopPreview('https://www.thalia.de/item', {
      allowedHosts: ['www.thalia.de'], signal: stop.signal,
      resolveAddresses: () => stage === 'dns' ? new Promise(() => {}) : Promise.resolve(['1.1.1.1']),
      fetcher: () => stage === 'fetch' ? new Promise(() => {}) : Promise.resolve(new Response(new ReadableStream({ pull() { return new Promise(() => {}) }, cancel() { return new Promise(() => {}) } }), { headers: { 'content-type': 'text/html' } })),
    })
    setTimeout(() => stop.abort(new DOMException('Stopped', 'AbortError')), 10)
    await assert.rejects(pending, /Stopped/)
  }
  const aborted = new AbortController(); aborted.abort()
  await assert.rejects(abortable(Promise.reject(new Error('late error')), aborted.signal), /abort/i)
})

test('handler checks origin, authentication and quota before any shop fetch', async () => {
  let shopCalls = 0
  const service = { allowedOrigins: [origin], allowedHosts: ['www.thalia.de'], authorize: async (token: string) => token === 'valid-fixture' ? { consumeBudget: async () => true } : null, preview: async () => { shopCalls++; return fixture } }
  assert.equal((await handlePreview(request('{}', { origin: 'https://attacker.invalid' }), service)).status, 403)
  assert.equal((await handlePreview(request(undefined, { authorization: 'Bearer forged' }), service)).status, 401)
  assert.equal((await handlePreview(request(), { ...service, authorize: async () => ({ consumeBudget: async () => false }) })).status, 429)
  assert.equal(shopCalls, 0)
  const result = await handlePreview(request(), service)
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), fixture)
  assert.equal(result.headers.get('access-control-allow-origin'), origin)
  assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(shopCalls, 1)
})

test('legacy bearer URLs and OAuth errors are scrubbed without changing invitation routes', () => {
  const token = 'a'.repeat(64), base = 'https://example.com/Wunschnagel/'
  assert.equal(sanitizeAuthCallback(base + '#/invite/' + token).href, base + '#/invite/' + token)
  const sanitized = sanitizeAuthCallback(base + '?access_token=untrusted&code=one-time#refresh_token=untrusted')
  assert.equal(sanitized.href, base + '?code=one-time')
  assert.ok(sanitized.warning)
  assert.equal(sanitizeAuthCallback(base + '#error=failed&error_description=malicious').href, base)
})

test('production policy rejects inline scripts and private build credentials', () => {
  const policy = contentSecurityPolicy('https://project.supabase.co')
  assert.match(policy, /script-src 'self'; script-src-attr 'none'/)
  assert.match(policy, /base-uri 'none'/)
  assert.match(policy, /connect-src 'self' https:\/\/project.supabase.co wss:\/\/project.supabase.co/)
  assert.doesNotMatch(policy, /unsafe-eval/)
  assert.throws(() => contentSecurityPolicy('javascript:alert(1)'))
  assert.throws(() => assertPublicConfiguration('sb_secret_fixture'))
  const jwt = ['header', Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'), 'signature'].join('.')
  assert.throws(() => assertPublicConfiguration(jwt))
  assert.doesNotThrow(() => assertPublicConfiguration('sb_publishable_fixture'))
})

test('malformed large shop markup cannot trigger repeated suffix scans', () => {
  for (const source of ['<script>'.repeat(100000), '<meta '.repeat(150000), '<meta ' + 'a'.repeat(7990) + '>']) assert.doesNotThrow(() => metadata(source, 'https://www.zalando.de/item.html'))
})
