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
  assert.deepEqual(metadata(`<html><head><meta content="Ein Wunsch &amp; mehr" property="og:title"><meta property='og:image' content='/product.jpg'><meta name="description" content="Für &#100;ich"></head></html>`, 'https://shop.de/product'), { title: 'Ein Wunsch & mehr', image_url: 'https://shop.de/product.jpg', description: 'Für dich' })
  assert.equal(metadata('<title>Mein Buch</title>', 'https://shop.de/').title, 'Mein Buch')
  assert.equal(metadata('<meta property="og:image" content="javascript:alert(1)">', 'https://shop.de/').image_url, '')
  assert.equal(metadata('<meta property="og:image" content="https://127.0.0.1/track">', 'https://shop.de/').image_url, '')
})
