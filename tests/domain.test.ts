import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inviteUrl, offerSearch, parsePrice, readInviteRoute, readShareRoute, shareUrl, sortWishes, webUrl } from '../src/domain.ts'
import type { Wish, Wishlist } from '../src/domain.ts'

const list = { id: '12345678-1234-4234-8234-123456789abc', share_token: 'a'.repeat(64), visibility: 'link' } as Wishlist

test('invitation links are separate from read-only routes and preserve the Pages base path', () => {
  const token = 'b'.repeat(64)
  const link = inviteUrl(token, 'https://pdohmen91.github.io/Wunschnagel/?tracking=1#/p/old')
  assert.equal(link, `https://pdohmen91.github.io/Wunschnagel/#/invite/${token}`)
  assert.equal(readInviteRoute(new URL(link).hash), token)
  assert.equal(readShareRoute(new URL(link).hash), null)
  for (const hash of ['#/invite/short', '#/invite/' + 'x'.repeat(64), '#/invite/' + token + '/extra', '#access_token=secret', '#/s/' + token]) assert.equal(readInviteRoute(hash), null)
  assert.throws(() => inviteUrl('javascript:alert(1)', 'https://example.com/'))
})

test('offer searches use exact keywords, safe encoding and useful legacy defaults', () => {
  const legacy = offerSearch({ title: 'Bialetti Moka Express' })
  assert.equal(new URL(legacy.url).hostname, 'www.idealo.de')
  assert.equal(new URL(legacy.url).searchParams.get('q'), 'Bialetti Moka Express')
  const exact = offerSearch({ title: 'Mein Geschenk', search_term: '  Marke X & Größe + 2  ', offer_source: 'idealo' })
  assert.equal(new URL(exact.url).searchParams.get('q'), 'Marke X & Größe + 2')
  assert.equal(offerSearch({ title: ' ' }).url, '')
})

test('used and classified links open result lists rather than individual offers', () => {
  const used = new URL(offerSearch({ title: 'Modell X123', offer_source: 'ebay' }).url)
  assert.equal(used.pathname, '/sch/i.html')
  assert.equal(used.searchParams.get('_nkw'), 'Modell X123')
  assert.deepEqual(used.searchParams.get('LH_ItemCondition')?.split('|'), ['3000', '4000', '5000', '6000'])
  const classifieds = new URL(offerSearch({ title: 'Modell X123', offer_source: 'kleinanzeigen' }).url)
  assert.equal(classifieds.hostname, 'www.kleinanzeigen.de')
  assert.equal(classifieds.searchParams.get('keywords'), 'Modell X123')
})

test('custom search links support saved filters and reject active URLs or credentials', () => {
  const link = 'https://shop.de/suche?q=modell&max=100'
  assert.equal(offerSearch({ title: 'Modell', offer_source: 'custom', search_url: link }).url, link)
  for (const search_url of ['', 'javascript:alert(1)', 'data:text/html,evil', 'https://user:password@shop.de/']) assert.equal(offerSearch({ title: 'Modell', offer_source: 'custom', search_url }).url, '')
})

test('private lists cannot produce share links', () => {
  assert.throws(() => shareUrl({ ...list, visibility: 'private' }, 'https://example.org/Wunschnagel/'))
})
test('share links preserve GitHub Pages base path and strip previous query/hash', () => {
  const url = shareUrl(list, 'https://example.org/Wunschnagel/?old=value#old')
  assert.equal(url, `https://example.org/Wunschnagel/#/s/${list.share_token}`)
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
