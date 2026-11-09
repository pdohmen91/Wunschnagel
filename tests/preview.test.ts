import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SHOP_HOSTS, destination, metadata, publicAddress, shopDestination } from '../supabase/functions/link-preview/helpers.ts'

test('preview requests reject local, literal, credential-bearing and non-HTTPS destinations', () => {
  for (const value of ['http://shop.de', 'https://127.0.0.1', 'https://2130706433', 'https://0x7f000001', 'https://[::1]', 'https://localhost', 'https://shop.local', 'https://user:pass@shop.de/', 'https://shop.de:8443', 'https://shop.de./']) assert.throws(() => destination(value), value)
  assert.equal(destination('https://www.thalia.de/shop').hostname, 'www.thalia.de')
})
test('DNS answers must be public and mapped IPv6 addresses are rejected', () => {
  for (const ip of ['127.0.0.1', '10.2.3.4', '192.168.1.2', '169.254.169.254', '172.16.0.1', '100.64.0.1', '198.18.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(publicAddress(ip), false, ip)
  assert.equal(publicAddress('1.1.1.1'), true)
  assert.equal(publicAddress('2606:4700:4700::1111'), true)
})
test('shop allowlist uses exact hosts and cannot be bypassed with suffixes or subdomains', () => {
  assert.equal(shopDestination('https://www.amazon.de/product', DEFAULT_SHOP_HOSTS).hostname, 'www.amazon.de')
  for (const value of ['https://www.amazon.de.attacker.com', 'https://attacker.amazon.de', 'https://attacker.com']) assert.throws(() => shopDestination(value, DEFAULT_SHOP_HOSTS))
})
test('metadata handles attribute order, relative images, entities and fallback titles', () => {
  assert.deepEqual(metadata(`<html><head><meta content="Ein Wunsch &amp; mehr" property="og:title"><meta property='og:image' content='/product.jpg'><meta name="description" content="Für &#100;ich"></head></html>`, 'https://shop.de/product'), { title: 'Ein Wunsch & mehr', image_url: 'https://shop.de/product.jpg', description: 'Für dich', price: null })
  assert.equal(metadata('<title>Mein Buch</title>', 'https://shop.de/').title, 'Mein Buch')
  assert.equal(metadata('<meta property="og:image" content="javascript:alert(1)">', 'https://shop.de/').image_url, '')
  assert.equal(metadata('<meta property="og:image" content="https://127.0.0.1/track">', 'https://shop.de/').image_url, '')
})

test('finds Amazon product images in the body rather than unrelated page images', () => {
  const html = '<head><title>Eine Kanne</title></head><body><img src="https://images.shop.de/logo.png"><img data-old-hires="https://m.media-amazon.com/images/I/product.jpg" id="landingImage" src="https://m.media-amazon.com/images/I/small.jpg"></body>'
  assert.equal(metadata(html, 'https://www.amazon.de/dp/EXAMPLE').image_url, 'https://m.media-amazon.com/images/I/product.jpg')
  assert.equal(metadata(html, 'https://www.thalia.de/produkt').image_url, '')
  assert.equal(metadata('<img id="imgBlkFront" src="https://m.media-amazon.com/images/I/book.jpg">', 'https://www.amazon.de/dp/EXAMPLE').image_url, 'https://m.media-amazon.com/images/I/book.jpg')
})

test('reads Product and ProductGroup images from nested JSON-LD safely', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'Organization', image: 'https://images.shop.de/logo.png' }, { '@type': ['Thing', 'Product'], name: 'Mein Produkt', description: 'Eine Idee', image: [{ '@type': 'ImageObject', contentUrl: '/product.jpg' }] }] })}</script>`
  assert.deepEqual(metadata(html, 'https://shop.de/item'), { title: 'Mein Produkt', description: 'Eine Idee', image_url: 'https://shop.de/product.jpg', price: null })
  assert.equal(metadata('<script type="application/ld+json">{"@type":"https://schema.org/ProductGroup","image":["javascript:alert(1)","https://127.0.0.1/internal","/safe.jpg"]}</script>', 'https://shop.de/').image_url, 'https://shop.de/safe.jpg')
  assert.doesNotThrow(() => metadata('<script type="application/ld+json">invalid</script><script type="application/ld+json">null</script>', 'https://shop.de/'))
})

test('supports image_src and microdata, skipping unusable Open Graph images', () => {
  assert.equal(metadata('<meta property="og:image:secure_url" content="javascript:alert(1)"><meta property="og:image" content="/real.jpg">', 'https://shop.de/').image_url, 'https://shop.de/real.jpg')
  assert.equal(metadata('<link rel="image_src" href="/preview.jpg">', 'https://shop.de/item').image_url, 'https://shop.de/preview.jpg')
  assert.equal(metadata('<meta itemprop="image" content="/product.jpg">', 'https://shop.de/').image_url, 'https://shop.de/product.jpg')
  assert.equal(metadata('<img itemprop="image" data-src="/lazy.jpg">', 'https://shop.de/').image_url, 'https://shop.de/lazy.jpg')
  assert.equal(metadata('<img itemprop="image" src="data:image/svg+xml,invalid"><img src="/logo.jpg">', 'https://shop.de/').image_url, '')
})
