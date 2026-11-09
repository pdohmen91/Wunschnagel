import { test } from 'node:test'
import assert from 'node:assert/strict'
import { metadata, DEFAULT_SHOP_HOSTS, shopDestination } from '../supabase/functions/link-preview/helpers.ts'
import { PreviewError, previewFailure } from '../supabase/functions/link-preview/errors.ts'
import { fetchShopPreview } from '../supabase/functions/link-preview/fetch.ts'
import { shopifyProductUrl, shopifyMetadata } from '../supabase/functions/link-preview/shopify.ts'
import { PreviewCache, previewRequestError } from '../src/lib/previewCache.ts'
import { sharedProduct } from '../src/domain.ts'

const options = { allowedHosts: DEFAULT_SHOP_HOSTS, resolveAddresses: async () => ['1.1.1.1'], signal: new AbortController().signal }
const page = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/html' } })

test('the four reported shops and eBay share-link destinations are trusted explicitly', () => {
  for (const host of ['ebay.io', 'www.ebay.de', 'eu.store.bambulab.com', 'fivi.gg', 'www.dyson.de']) assert.equal(shopDestination(`https://${host}/produkt`, DEFAULT_SHOP_HOSTS).hostname, host)
  assert.throws(() => shopDestination('https://fivi.gg.attacker.com/produkt', DEFAULT_SHOP_HOSTS))
})

test('reads a separately declared JSON-LD image and prefers the matching product', () => {
  const graph = [
    { '@type': 'Product', url: '/recommendation', name: 'Empfehlung', image: '/wrong.jpg' },
    { '@type': 'Product', url: '/wanted', name: 'Gewünschtes Produkt', image: { '@id': '#photo' } },
    { '@type': 'ImageObject', '@id': '#photo', contentUrl: '/right.jpg' },
  ]
  const result = metadata(`<script type="application/ld+json">${JSON.stringify({ '@graph': graph })}</script>`, 'https://fivi.gg/wanted')
  assert.equal(result.title, 'Gewünschtes Produkt')
  assert.equal(result.image_url, 'https://fivi.gg/right.jpg')
  assert.equal(metadata('<h1><span>Ein</span> Produkt&nbsp;&ndash;&nbsp;schön</h1>', 'https://fivi.gg/wanted').title, 'Ein Produkt – schön')
})

test('does not stop at an image-only head when the product title is in the body', async () => {
  const chunks = ['<head><meta property="og:image" content="https://fivi.gg/photo.jpg"></head>', '<body><h1>Der richtige Titel</h1></body>']
  const body = new ReadableStream({ pull(controller) { const text = chunks.shift(); if (text) controller.enqueue(new TextEncoder().encode(text)); else controller.close() } })
  const result = await fetchShopPreview('https://www.dyson.de/produkt', { ...options, fetcher: async () => new Response(body, { headers: { 'Content-Type': 'text/html' } }) })
  assert.equal(result.title, 'Der richtige Titel')
})

test('reports blocked, throttled, missing and challenge pages accurately without retrying', async () => {
  for (const [status, code] of [[403, 'shop_blocked'], [429, 'shop_rate_limited'], [404, 'not_found']] as const) {
    let calls = 0
    await assert.rejects(fetchShopPreview('https://www.dyson.de/produkt', { ...options, fetcher: async () => { calls++; return new Response(null, { status }) } }), error => error instanceof PreviewError && error.code === code)
    assert.equal(calls, 1)
  }
  await assert.rejects(fetchShopPreview('https://www.dyson.de/produkt', { ...options, fetcher: async () => page('<title>Just a moment...</title><h1>Please wait</h1>') }), error => error instanceof PreviewError && error.code === 'shop_blocked')
  assert.equal(previewFailure(new DOMException('Timed out', 'TimeoutError')).code, 'timeout')
})

test('respects declared page encoding for product titles', async () => {
  const body = Uint8Array.from([...Buffer.from('<title>M'), 0xfc, ...Buffer.from('hle</title>')])
  const result = await fetchShopPreview('https://www.dyson.de/produkt', { ...options, fetcher: async () => new Response(body, { headers: { 'Content-Type': 'text/html; charset=windows-1252' } }) })
  assert.equal(result.title, 'Mühle')
})

test('uses the reviewed Shopify product API and preserves selected variant images', async () => {
  const product = { id: 1, title: 'Messer', featured_image: '//fivi.gg/main.jpg', variants: [{ id: 12, title: 'Rot', featured_image: { src: '/red.jpg' } }] }
  let calls = 0
  const result = await fetchShopPreview('https://fivi.gg/de/products/messer?variant=12', { ...options, fetcher: async url => { calls++; assert.equal(new URL(String(url)).pathname, '/de/products/messer.js'); return new Response(JSON.stringify(product), { headers: { 'Content-Type': 'application/json' } }) } })
  assert.equal(result.title, 'Messer – Rot')
  assert.equal(result.image_url, 'https://fivi.gg/red.jpg')
  assert.equal(calls, 1)
  assert.equal(shopifyProductUrl(new URL('https://www.dyson.de/products/item')), null)
  assert.equal(shopifyMetadata({ title: 'Not a product' }, new URL('https://fivi.gg/')), null)
})

test('falls back to HTML for a missing product API but never retries a rate limit', async () => {
  let calls = 0
  const result = await fetchShopPreview('https://fivi.gg/products/messer', { ...options, fetcher: async () => ++calls === 1 ? new Response(null, { status: 404 }) : page('<title>Messer</title><meta property="og:image" content="/knife.jpg">') })
  assert.equal(result.image_url, 'https://fivi.gg/knife.jpg')
  assert.equal(calls, 2)
  calls = 0
  await assert.rejects(fetchShopPreview('https://fivi.gg/products/messer', { ...options, fetcher: async () => { calls++; return new Response(null, { status: 429 }) } }), error => error instanceof PreviewError && error.code === 'shop_rate_limited')
  assert.equal(calls, 1)
})

test('successful preview cache is bounded, isolated, expires and can be invalidated', () => {
  const cache = new PreviewCache(), otherAccount = new PreviewCache()
  const data = { title: 'Produkt', image_url: 'https://fivi.gg/photo.jpg', description: '' }
  cache.put('one', data, 100)
  const loaded = cache.get('one', 101)!
  loaded.title = 'Verändert'
  assert.equal(cache.get('one', 101)?.title, 'Produkt')
  assert.equal(otherAccount.get('one', 101), null)
  assert.equal(cache.get('one', 300_100), null)
  for (let index = 0; index < 41; index++) cache.put(String(index), data, 100)
  assert.equal(cache.get('0', 101), null)
  cache.invalidate('40')
  assert.equal(cache.get('40', 101), null)
  cache.put('partial', { ...data, image_url: '' }, 100)
  assert.equal(cache.get('partial', 101), null)
})

test('an oversized invalid API response cannot trigger more downloads', async () => {
  let calls = 0, cancelled = false
  const chunk = new Uint8Array(262_144).fill(120)
  const body = new ReadableStream({ pull(controller) { controller.enqueue(chunk) }, cancel() { cancelled = true } })
  await assert.rejects(fetchShopPreview('https://fivi.gg/products/messer', { ...options, fetcher: async () => { calls++; return new Response(body, { headers: { 'Content-Type': 'application/json' } }) } }), error => error instanceof PreviewError && error.code === 'no_metadata')
  assert.equal(calls, 1)
  assert.equal(cancelled, true)
})

test('the frontend preserves specific backend errors including the daily quota', async () => {
  for (const text of ['Diesen Shop unterstützen wir noch nicht.', 'Heute wurden bereits 40 Vorschauen geladen.', 'Dieser Shop blockiert den automatischen Abruf.']) {
    const error = await previewRequestError({ context: new Response(JSON.stringify({ error: text }), { status: 422 }) })
    assert.equal(error.message, text)
  }
})

test('extracts one shared product link and title without inventing titles for generic share text', () => {
  assert.deepEqual(sharedProduct('Meine Wunschlampe\nhttps://www.dyson.de/item?variant=1'), { url: 'https://www.dyson.de/item?variant=1', title: 'Meine Wunschlampe' })
  assert.deepEqual(sharedProduct('Schau mal, was ich gefunden habe! https://ebay.io/abc.'), { url: 'https://ebay.io/abc', title: '' })
  assert.equal(sharedProduct('https://fivi.gg/item?size=(large)')?.url, 'https://fivi.gg/item?size=(large)')
  assert.equal(sharedProduct('one https://fivi.gg/item and https://www.dyson.de/item'), null)
  assert.equal(sharedProduct('javascript:alert(1)'), null)
})
