import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchShopPreview } from '../supabase/functions/link-preview/fetch.ts'
import { localLinkPreview } from '../server/link-preview.ts'

const options = {
  allowedHosts: ['www.thalia.de'],
  resolveAddresses: async () => ['1.1.1.1'],
  signal: new AbortController().signal,
}
const page = (html: string) => new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

test('fetches and decodes the real page title when Open Graph metadata is absent', async () => {
  const result = await fetchShopPreview('https://www.thalia.de/produkt', {
    ...options, fetcher: async () => page('<head><title>Mein Buch &amp; mehr</title></head><body></body>'),
  })
  assert.equal(result.title, 'Mein Buch & mehr')
})

test('refuses private DNS answers before fetching any page', async () => {
  let fetched = false
  await assert.rejects(fetchShopPreview('https://www.thalia.de/produkt', {
    ...options, resolveAddresses: async () => ['127.0.0.1'], fetcher: async () => { fetched = true; return page('') },
  }), /nicht erreichbar/)
  assert.equal(fetched, false)
})

test('refuses redirects outside the trusted shops without fetching their contents', async () => {
  let calls = 0
  await assert.rejects(fetchShopPreview('https://www.thalia.de/produkt', {
    ...options, fetcher: async () => { calls++; return new Response(null, { status: 302, headers: { Location: 'https://attacker.com/private' } }) },
  }), /manuell/)
  assert.equal(calls, 1)
})

test('keeps a usable title when an image destination cannot be resolved publicly', async () => {
  const result = await fetchShopPreview('https://www.thalia.de/produkt', {
    ...options, resolveAddresses: async host => host === 'www.thalia.de' ? ['1.1.1.1'] : ['10.0.0.1'],
    fetcher: async () => page('<head><title>Ein gutes Buch</title><meta property="og:image" content="https://images.shop.de/test.png"></head>'),
  })
  assert.equal(result.title, 'Ein gutes Buch')
  assert.equal(result.image_url, '')
})

test('stops downloading after the page head when title, image and price are complete', async () => {
  let cancelled = false
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('<head><title>Titel aus dem Head</title><meta property="og:image" content="https://images.shop.de/preview.jpg"><meta property="product:price:amount" content="39.90"><meta property="product:price:currency" content="EUR"></head>')) }, cancel() { cancelled = true } })
  const result = await fetchShopPreview('https://www.thalia.de/produkt', { ...options, fetcher: async () => new Response(body, { headers: { 'Content-Type': 'text/html' } }) })
  assert.equal(result.title, 'Titel aus dem Head')
  assert.equal(result.price, 39.9)
  assert.equal(cancelled, true)
})

test('continues beyond the head to read a product image from the body', async () => {
  const encoder = new TextEncoder()
  const chunks = ['<head><title>Produkt aus dem Body</title></head>', ' '.repeat(70_000), '<img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/product.jpg">']
  const body = new ReadableStream({ pull(controller) { const chunk = chunks.shift(); if (chunk !== undefined) controller.enqueue(encoder.encode(chunk)); else controller.close() } })
  const result = await fetchShopPreview('https://www.amazon.de/dp/EXAMPLE', { ...options, allowedHosts: ['www.amazon.de'], fetcher: async () => new Response(body, { headers: { 'Content-Type': 'text/html' } }) })
  assert.equal(result.title, 'Produkt aus dem Body')
  assert.equal(result.image_url, 'https://m.media-amazon.com/images/I/product.jpg')
})

test('keeps the download bounded when the page never supplies an image', async () => {
  let reads = 0
  let cancelled = false
  const chunk = new TextEncoder().encode('<head><title>Nur ein Titel</title></head>' + ' '.repeat(100_000))
  const body = new ReadableStream({ pull(controller) { reads++; controller.enqueue(chunk) }, cancel() { cancelled = true } })
  const result = await fetchShopPreview('https://www.thalia.de/produkt', { ...options, fetcher: async () => new Response(body, { headers: { 'Content-Type': 'text/html' } }) })
  assert.equal(result.image_url, '')
  assert.equal(cancelled, true)
  assert.ok(reads <= 12)
})

test('local endpoint returns metadata and rejects requests from another origin', async () => {
  const makeRequest = (origin: string) => new Request('http://127.0.0.1:5173/__api/link-preview', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ url: 'https://www.thalia.de/produkt' }),
  })
  let calls = 0
  const dependencies = { ...options, fetcher: async () => { calls++; return page('<title>Lokaler Abruf</title>') } }
  const valid = await localLinkPreview(makeRequest('http://127.0.0.1:5173'), dependencies)
  assert.equal(valid.status, 200)
  assert.equal((await valid.json()).title, 'Lokaler Abruf')
  const forbidden = await localLinkPreview(makeRequest('https://attacker.com'), dependencies)
  assert.equal(forbidden.status, 403)
  assert.equal(calls, 1)
})
