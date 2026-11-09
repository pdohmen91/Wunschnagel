import { test } from 'node:test'
import assert from 'node:assert/strict'
import { euroPrice } from '../supabase/functions/link-preview/prices.ts'
import { metadata, DEFAULT_SHOP_HOSTS } from '../supabase/functions/link-preview/helpers.ts'
import { fetchShopPreview } from '../supabase/functions/link-preview/fetch.ts'
import { shopifyAmount } from '../supabase/functions/link-preview/shopify.ts'

const base = 'https://www.thalia.de/produkt'
const ld = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`
const product = (offers: unknown) => ({ '@type': 'Product', name: 'Mein Wunsch', url: base, offers })
const options = { allowedHosts: DEFAULT_SHOP_HOSTS, resolveAddresses: async () => ['1.1.1.1'], signal: new AbortController().signal }

test('parses unambiguous euro prices, including free and localized amounts, without currency conversion', () => {
  for (const [value, amount] of [['29.90', 29.9], ['29,90', 29.9], ['1.234,56 €', 1234.56], ['EUR 1,234.56', 1234.56], ['1\u202f234,56', 1234.56], [0, 0], ['0.00', 0], ['999999.99', 999999.99]] as const) assert.equal(euroPrice(value, 'EUR'), amount, String(value))
  assert.equal(euroPrice('29,90 €', undefined), 29.9)
  for (const value of [null, '', false, -1, Infinity, NaN, 1000000, '1.234', '1e3', 'ab 29,90', '29–39', '29,90 / Monat', '29 USD', '12 34,56']) assert.equal(euroPrice(value, 'EUR'), null, String(value))
  for (const currency of ['USD', 'GBP', undefined, null, '']) assert.equal(euroPrice(29.9, currency), null)
  assert.equal(euroPrice('29,90 €', 'USD'), null)
})

test('uses the active Product offer, referenced offers and active price specifications', () => {
  assert.equal(metadata(ld(product({ '@type': 'Offer', price: '39.90', priceCurrency: 'EUR', priceSpecification: { price: '59.90', priceCurrency: 'EUR', priceType: 'https://schema.org/StrikethroughPrice' } })), base).price, 39.9)
  assert.equal(metadata(ld({ '@graph': [product({ '@id': '#offer' }), { '@id': '#offer', '@type': 'Offer', price: 19.9, priceCurrency: 'EUR' }] }), base).price, 19.9)
  assert.equal(metadata(ld(product({ priceSpecification: [{ price: 59.9, priceCurrency: 'EUR', priceType: 'https://schema.org/StrikethroughPrice' }, { price: 39.9, priceCurrency: 'EUR' }] })), base).price, 39.9)
  assert.equal(metadata(ld(product({ priceSpecification: { price: 5, priceCurrency: 'EUR', billingDuration: 'P1M' } })), base).price, null)
})

test('does not use recommendations, foreign currencies, ambiguous offers or variant ranges', () => {
  const other = { '@type': 'Product', url: '/recommendation', offers: { price: 1, priceCurrency: 'EUR' } }
  assert.equal(metadata(ld([other, product({ price: 49.9, priceCurrency: 'EUR' })]), base).price, 49.9)
  assert.equal(metadata(ld([other, product(undefined)]), base).price, null)
  assert.equal(metadata(ld(other), base).price, null)
  for (const offers of [{ price: 49.9, priceCurrency: 'USD' }, { price: 49.9 }, { '@type': 'AggregateOffer', lowPrice: 10, highPrice: 50, priceCurrency: 'EUR' }, [{ price: 10, priceCurrency: 'EUR' }, { price: 50, priceCurrency: 'EUR' }]]) assert.equal(metadata(ld(product(offers)), base).price, null)
  assert.equal(metadata(ld(product({ '@type': 'AggregateOffer', lowPrice: 10, highPrice: 10, priceCurrency: 'EUR' })), base).price, 10)
})

test('selects the linked variant rather than a cheaper variant or ProductGroup range', () => {
  const group = { '@type': 'ProductGroup', url: base, hasVariant: [product({ price: 10, priceCurrency: 'EUR', url: base + '?variant=1' }), { ...product({ price: 30, priceCurrency: 'EUR' }), url: base + '?variant=2' }] }
  assert.equal(metadata(ld(group), base + '?variant=2').price, 30)
  assert.equal(metadata(ld(product([{ url: base + '?variant=1', price: 10, priceCurrency: 'EUR' }, { url: base + '?variant=2', price: 30, priceCurrency: 'EUR' }])), base + '?variant=2').price, 30)
  assert.equal(metadata(ld(product([{ url: base + '?variant=1', price: 10, priceCurrency: 'EUR' }])), base + '?variant=9').price, null)
  const offers = [{ sku: 'PACK-1', price: 35, priceCurrency: 'EUR' }, { sku: 'PACK-4', price: 119, priceCurrency: 'EUR' }]
  assert.equal(metadata(ld(product(offers)), base + '?product=PACK-4').price, 119)
  assert.equal(metadata(ld(product(offers)), base + '?product=missing').price, null)
  assert.equal(metadata(`<link rel="canonical" href="${base}">` + ld(product(offers)), base + '/four-pack?product=PACK-4').price, 119)
})

test('uses page price metadata and unambiguous microdata without picking an arbitrary visible price', () => {
  assert.equal(metadata('<meta property="product:price:amount" content="29.90"><meta property="product:price:currency" content="EUR">', base).price, 29.9)
  assert.equal(metadata('<meta property="og:price:amount" content="0"><meta property="og:price:currency" content="EUR">', base).price, 0)
  assert.equal(metadata('<meta itemprop="priceCurrency" content="EUR"><span itemprop="price" content="29.90">29,90 €</span>', base).price, 29.9)
  assert.equal(metadata('<span itemprop="price">1.234,56 €</span>', base).price, 1234.56)
  assert.equal(metadata('<span itemprop="price">29,90&nbsp;&euro;</span>', base).price, 29.9)
  assert.equal(metadata('<meta itemprop="priceCurrency" content="EUR"><meta itemprop="price" content="10"><meta itemprop="price" content="20">', base).price, null)
  assert.equal(metadata('<p>Versand: 4,90 €</p><del>99,90 €</del><strong>29,90 €</strong>', base).price, null)
})

test('continues after a complete title/image head to read product prices in the body', async () => {
  const chunks = ['<head><title>Mein Wunsch</title><meta property="og:image" content="/photo.jpg"></head>', '<body>' + ld(product({ price: 39.9, priceCurrency: 'EUR' })) + '</body>']
  const body = new ReadableStream({ pull(controller) { const text = chunks.shift(); if (text) controller.enqueue(new TextEncoder().encode(text)); else controller.close() } })
  const result = await fetchShopPreview(base, { ...options, fetcher: async () => new Response(body, { headers: { 'Content-Type': 'text/html' } }) })
  assert.equal(result.price, 39.9)
  assert.equal(result.title, 'Mein Wunsch')
  assert.equal(result.image_url, 'https://www.thalia.de/photo.jpg')
})

test('Shopify uses the selected variant in minor units and verifies the presentment currency', async () => {
  const data = { id: 1, title: 'Messer', price: 1000, price_varies: true, variants: [{ id: 1, price: 1000 }, { id: 2, price: 3299 }] }
  const url = new URL('https://fivi.gg/de/products/messer?variant=2')
  assert.equal(shopifyAmount(data, url), 32.99)
  assert.equal(shopifyAmount(data, new URL('https://fivi.gg/products/messer')), null)
  assert.equal(shopifyAmount(data, new URL('https://fivi.gg/products/messer?variant=9')), null)
  for (const currency of ['EUR', 'USD', null]) {
    const calls: string[] = []
    const result = await fetchShopPreview(url.href, { ...options, fetcher: async input => {
      const path = new URL(String(input)).pathname; calls.push(path)
      return new Response(JSON.stringify(path.endsWith('/cart.js') ? { currency } : data), { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } })
    } })
    assert.equal(result.price, currency === 'EUR' ? 32.99 : null)
    assert.deepEqual(calls, ['/de/products/messer.js', '/de/cart.js'])
  }
})

test('an explicit SKU keeps reading past a generic head price to find the matching offer', async () => {
  const chunks = ['<head><title>Varianten</title><meta property="og:image" content="/photo.jpg"><meta property="product:price:amount" content="10"><meta property="product:price:currency" content="EUR"></head>', ld(product([{ sku: 'PACK-1', price: 10, priceCurrency: 'EUR' }, { sku: 'PACK-4', price: 30, priceCurrency: 'EUR' }]))]
  const body = new ReadableStream({ pull(controller) { const text = chunks.shift(); if (text) controller.enqueue(new TextEncoder().encode(text)); else controller.close() } })
  const result = await fetchShopPreview(base + '?product=PACK-4', { ...options, fetcher: async () => new Response(body, { headers: { 'Content-Type': 'text/html' } }) })
  assert.equal(result.price, 30)
})

test('currency lookup failures preserve Shopify titles/images and never trigger retries', async () => {
  let calls = 0
  const result = await fetchShopPreview('https://fivi.gg/products/messer', { ...options, fetcher: async () => ++calls === 1 ? new Response(JSON.stringify({ id: 1, title: 'Messer', price: 3990, featured_image: '/photo.jpg' }), { headers: { 'Content-Type': 'application/json' } }) : new Response(null, { status: 429 }) })
  assert.equal(calls, 2)
  assert.equal(result.title, 'Messer')
  assert.equal(result.image_url, 'https://fivi.gg/photo.jpg')
  assert.equal(result.price, null)
})
