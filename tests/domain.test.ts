import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePrice, readShareRoute, shareUrl, sortWishes, webUrl } from '../src/domain.ts'
import type { Wish, Wishlist } from '../src/domain.ts'

const list = { id: '12345678-1234-4234-8234-123456789abc', share_token: 'a'.repeat(64), visibility: 'link' } as Wishlist

test('private lists cannot produce share links', () => {
  assert.throws(() => shareUrl({ ...list, visibility: 'private' }, 'https://example.org/wunschliste/'))
})
test('share links preserve GitHub Pages base path and strip previous query/hash', () => {
  const url = shareUrl(list, 'https://example.org/wunschliste/?old=value#old')
  assert.equal(url, `https://example.org/wunschliste/#/s/${list.share_token}`)
  assert.deepEqual(readShareRoute(new URL(url).hash), { kind: 'token', value: list.share_token })
  assert.equal(shareUrl({ ...list, visibility: 'public' }, 'https://example.org/'), `https://example.org/#/p/${list.id}`)
  assert.equal(readShareRoute('#access_token=not-a-list'), null)
})
test('product URLs reject active content and embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,bad', 'https://user:secret@example.org/', 'no-url']) assert.throws(() => webUrl(url))
  assert.equal(webUrl(' https://shop.de/item '), 'https://shop.de/item')
  assert.equal(webUrl('shop.de/item'), 'https://shop.de/item')
  assert.equal(webUrl('www.shop.de/produkt?farbe=gruen'), 'https://www.shop.de/produkt?farbe=gruen')
  assert.equal(webUrl('', false), '')
})
test('prices support German decimals without accepting negative or invalid values', () => {
  assert.equal(parsePrice('29,90'), 29.9)
  assert.equal(parsePrice('0'), 0)
  assert.equal(parsePrice(''), null)
  for (const value of ['-1', 'NaN', 'Infinity', '1.000.000', '1000000']) assert.throws(() => parsePrice(value))
})

test('sorting prices keeps unspecified prices at the end and does not change source data', () => {
  const items = [{ title: 'Unbekannt', price: null }, { title: 'Teuer', price: 99 }, { title: 'Kostenlos', price: 0 }, { title: 'Günstig', price: 22 }] as Wish[]
  assert.deepEqual(sortWishes(items, 'price-asc').map(item => item.title), ['Kostenlos', 'Günstig', 'Teuer', 'Unbekannt'])
  assert.deepEqual(sortWishes(items, 'price-desc').map(item => item.title), ['Teuer', 'Günstig', 'Kostenlos', 'Unbekannt'])
  assert.equal(items[0].title, 'Unbekannt')
})

test('sorting by name and newest works independently of input order', () => {
  const items = [{ title: 'Zelt', created_at: '2026-01-01' }, { title: 'Buch', created_at: '2026-11-07' }] as Wish[]
  assert.deepEqual(sortWishes(items, 'name').map(item => item.title), ['Buch', 'Zelt'])
  assert.deepEqual(sortWishes(items, 'newest').map(item => item.title), ['Buch', 'Zelt'])
  assert.deepEqual(sortWishes(items, 'added').map(item => item.title), ['Zelt', 'Buch'])
})
