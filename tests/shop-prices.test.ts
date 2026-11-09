import { test } from 'node:test'
import assert from 'node:assert/strict'
import { metadata } from '../supabase/functions/link-preview/helpers.ts'
import { fetchShopPreview } from '../supabase/functions/link-preview/fetch.ts'

const ld = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`

test('Amazon uses the marked primary purchase price and ignores recommendations, crossed-out amounts and other currencies', () => {
  const html = '<span class="a-price"><span class="a-offscreen">1,00 €</span></span><span id="apex-pricetopay-accessibility-label">209,99&nbsp;€</span><span class="a-text-price">249,99 €</span>'
  assert.equal(metadata(html, 'https://www.amazon.de/dp/EXAMPLE').price, 209.99)
  assert.equal(metadata(html, 'https://www.thalia.de/item').price, null)
  assert.equal(metadata('<span class="a-price apex-pricetopay-value"><span class="a-offscreen">39,90€</span></span>', 'https://www.amazon.de/dp/EXAMPLE').price, 39.9)
  assert.equal(metadata('<span class="a-price"><span class="a-offscreen">1,00 €</span></span>', 'https://www.amazon.de/dp/EXAMPLE').price, null)
  assert.equal(metadata('<span id="apex-pricetopay-accessibility-label">209.99 USD</span>', 'https://www.amazon.de/dp/EXAMPLE').price, null)
})

test('IKEA extracts the current accessible price without using the old or per-unit price', () => {
  const html = '<span class="pipcom-price__sr-text">Preis 99.99€</span><span class="pipcom-price pipcom-price-module__current-price"><span class="pipcom-price__integer">49</span><span class="pipcom-price__sr-text">Preis 49.99€</span></span>'
  assert.equal(metadata(html, 'https://www.ikea.com/de/de/p/billy-00263850/').price, 49.99)
  assert.equal(metadata(html.replace('Preis 49.99€', 'Preis 499 SEK'), 'https://www.ikea.com/de/de/p/billy-00263850/').price, null)
  assert.equal(metadata(html, 'https://www.amazon.de/dp/EXAMPLE').price, null)
})

test('Zalando combines only the exact product SKU fragments and chooses the sale price', () => {
  const sku = 'AD111A37W-A11', url = 'https://www.zalando.de/adidas-originals-samba-og-ad111a37w-a11.html'
  const fixture = (currency = 'EUR', tracked = 116.95) => '<script>runtime["hydratePartial"](' + JSON.stringify({ cache: {
    main: { data: { product: { sku, displayPrice: { original: { amount: 12995, currency }, promotional: { amount: 11695 }, trackingCurrentAmount: tracked } } } },
    partialOriginal: { data: { product: { id: `ern:product::${sku}`, displayPrice: { original: { amount: 12995, currency } } } } },
    formatted: { data: { product: { sku, displayPrice: { promotional: { formatted: '116,95 €' } } } } },
    recommended: { data: { product: { sku: 'UNRELATED-B99', displayPrice: { original: { amount: 100, currency: 'EUR' } } } } },
  }, options: { label: 'Quoted braces: } { "' } }) + ');globalThis.shopCodeMustNotRun = true;</script>'
  assert.equal(metadata(fixture(), url).price, 116.95)
  assert.equal(metadata(fixture('USD'), url).price, null)
  assert.equal(metadata(fixture('EUR', 99), url).price, null)
  assert.equal(metadata(fixture(), url.replace('ad111a37w-a11', 'ad111a37w-b22')).price, null)
  assert.equal(metadata(fixture().slice(0, -100), url).price, null)
  assert.equal('shopCodeMustNotRun' in globalThis, false)
})

test('selected IDs work across localized Bambu product paths and internal Marshall schema hosts', () => {
  const group = { '@type': 'ProductGroup', url: 'https://eu.store.bambulab.com/products/a1-mini', hasVariant: [
    { '@type': 'Product', sku: 'printer', offers: { url: 'https://eu.store.bambulab.com/products/a1-mini?id=printer', price: 179, priceCurrency: 'EUR', priceSpecification: { price: 189, priceCurrency: 'EUR', priceType: 'https://schema.org/StrikethroughPrice' } } },
    { '@type': 'Product', sku: 'combo', offers: { url: 'https://eu.store.bambulab.com/products/a1-mini?id=combo', price: 279, priceCurrency: 'EUR' } },
  ] }
  assert.equal(metadata(ld(group), 'https://eu.store.bambulab.com/de/products/a1-mini?id=printer').price, 179)
  assert.equal(metadata(ld(group), 'https://eu.store.bambulab.com/de/products/a1-mini?id=combo').price, 279)
  assert.equal(metadata(ld(group), 'https://eu.store.bambulab.com/de/products/a1-mini').price, null)
  const product = { '@type': 'Product', sku: '1006832', url: 'https://internal-storefront.invalid/de/de/product/major-v?pid=1006832', offers: { price: 149, priceCurrency: 'EUR' } }
  assert.equal(metadata(ld(product), 'https://www.marshall.com/de/de/product/major-v?pid=1006832').price, 149)
  assert.equal(metadata(ld(product), 'https://www.marshall.com/de/de/product/major-v?pid=other').price, null)
})

test('MediaMarkt defaults to an unambiguous new offer and keeps explicit offer selections conservative', () => {
  const base = 'https://www.mediamarkt.de/de/product/_headphones.html'
  const product = { '@type': 'Product', url: base, offers: [
    { price: 259, priceCurrency: 'EUR', itemCondition: 'https://schema.org/NewCondition' },
    { price: 179.1, priceCurrency: 'EUR', itemCondition: 'https://schema.org/RefurbishedCondition' },
  ] }
  assert.equal(metadata(ld(product), base).price, 259)
  assert.equal(metadata(ld(product), base + '?offerId=refurbished').price, null)
})

test('ROSSMANN challenge and dm app shell are errors rather than saved product titles', async () => {
  const opts = { allowedHosts: ['www.rossmann.de', 'www.dm.de'], resolveAddresses: async () => ['1.1.1.1'], signal: new AbortController().signal }
  for (const [url, html, code] of [
    ['https://www.rossmann.de/de/item', '<title>Client Challenge</title>', 'shop_blocked'],
    ['https://www.dm.de/p/d/1/item', '<title>dm-drogerie markt - dauerhaft günstig online kaufen</title>', 'no_metadata'],
  ]) {
    await assert.rejects(fetchShopPreview(url, { ...opts, fetcher: async () => new Response(html, { headers: { 'Content-Type': 'text/html' } }) }), error => typeof error === 'object' && !!error && 'code' in error && error.code === code)
  }
})
