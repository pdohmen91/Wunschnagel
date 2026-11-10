// Opt-in test: only newly created QA accounts/list fixtures. No real purchases,
// existing wishes, email sends or buyer identities are involved.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { webkit, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { openQaSession, signInQa } from './qa-auth.mjs'

const { url, publishable_key: key } = JSON.parse(readFileSync(process.env.WUNSCHNAGEL_QA_CONFIG, 'utf8'))
const ref = new URL(url).hostname.split('.')[0]
const keys = JSON.parse(execFileSync(process.env.WUNSCHNAGEL_QA_SUPABASE || 'supabase', ['projects', 'api-keys', `--remote=${ref}`, '--reveal', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, keys.find(k => k.type === 'secret').api_key, options), owner = createClient(url, key, options)
const a = createClient(url, key, options), b = createClient(url, key, options)
const base = process.env.WUNSCHNAGEL_QA_BASE || 'https://pdohmen91.github.io/Wunschnagel/'
let userId, browser, phase = 'setup', checks = 0
const proof = () => randomBytes(32).toString('hex')
async function ok(request) { const r = await request; assert.equal(r.error, null, r.error?.message); checks++; return r.data }
async function denied(request) { assert.ok((await request).error); checks++ }
try {
  const email = `wunschnagel-gifts-qa-${randomBytes(8).toString('hex')}@example.invalid`
  const { user } = await ok(admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: 'QA Geschenkstatus' } }))
  userId = user.id
  const signed = await signInQa(owner, admin, email)
  const list = await ok(owner.from('wishlists').insert({ owner_id: userId, title: '[QA] Verborgene Geschenkstatus', visibility: 'link' }).select().single())
  const wish = await ok(owner.from('wishes').insert({ wishlist_id: list.id, title: '[QA] Eine kleine Überraschung', url: 'https://example.com/qa-gift', notes: 'Nur ein isolierter Funktionstest.' }).select().single())
  const secondWish = await ok(owner.from('wishes').insert({ wishlist_id: list.id, title: '[QA] Gleichzeitiger Kauf', url: 'https://example.com/qa-other' }).select().single())
  const params = (item, receipt, token = list.share_token) => ({ list_id: list.id, item_id: item.id, read_token: token, receipt })
  const shared = client => ok(client.rpc('get_shared_wishlist', { token: list.share_token }))
  phase = 'anonymous access, owner secrecy and capability boundaries'
  const first = proof(), second = proof()
  assert.equal(await ok(a.rpc('purchase_wish', params(wish, first))), 'purchased')
  assert.equal((await shared(b)).items.find(w => w.id === wish.id).purchased, true)
  const hidden = await shared(owner)
  assert.equal(hidden.can_purchase, false); assert.equal('purchased' in hidden.items[0], false)
  assert.deepEqual(await ok(owner.from('wishes').select('*').eq('id', wish.id).single()), wish)
  await denied(a.from('wish_purchases').select('*'))
  await denied(owner.from('wish_purchases').select('*'))
  await denied(owner.rpc('purchase_wish', params(wish, first)))
  await denied(owner.rpc('undo_wish_purchase', params(wish, first)))
  await denied(a.rpc('purchase_wish', params(secondWish, first, proof())))
  assert.equal(await ok(b.rpc('undo_wish_purchase', params(wish, second))), false)
  assert.equal(await ok(a.rpc('purchase_wish', params(wish, first))), 'purchased')
  assert.equal(await ok(b.rpc('purchase_wish', params(wish, second))), 'already_purchased')
  assert.equal(await ok(a.rpc('undo_wish_purchase', params(wish, first))), true)
  phase = 'two independent guests marking simultaneously'
  const raced = await Promise.all([ok(a.rpc('purchase_wish', params(secondWish, first))), ok(b.rpc('purchase_wish', params(secondWish, second)))])
  assert.deepEqual([...raced].sort(), ['already_purchased', 'purchased']); checks++
  phase = 'private and secret-link scopes'
  const privateList = await ok(owner.from('wishlists').insert({ owner_id: userId, title: '[QA] Private', visibility: 'private' }).select().single())
  const privateWish = await ok(owner.from('wishes').insert({ wishlist_id: privateList.id, title: '[QA] Private gift', url: 'https://example.com/qa-private' }).select().single())
  await denied(a.rpc('purchase_wish', { list_id: privateList.id, item_id: privateWish.id, read_token: privateList.share_token, receipt: first }))
  await denied(a.rpc('purchase_wish', params(privateWish, first)))
  await denied(owner.from('wishlists').update({ visibility: 'public' }).eq('id', privateList.id))
  const sharedList = await ok(owner.from('wishlists').update({ visibility: 'link' }).eq('id', privateList.id).select().single())
  await denied(a.rpc('purchase_wish', { list_id: privateList.id, item_id: privateWish.id, read_token: null, receipt: first }))
  assert.equal(await ok(a.rpc('purchase_wish', { list_id: privateList.id, item_id: privateWish.id, read_token: sharedList.share_token, receipt: first })), 'purchased')
  assert.equal((await ok(b.rpc('get_shared_wishlist', { token: sharedList.share_token }))).items[0].purchased, true)
  assert.equal('purchased' in (await ok(owner.rpc('get_shared_wishlist', { token: sharedList.share_token }))).items[0], false)
  assert.equal(await ok(b.rpc('get_public_wishlist', { list_id: privateList.id })), null)
  if (process.env.WUNSCHNAGEL_QA_API_ONLY !== '1') {
    phase = 'mobile guests and unchanged owner UI'
    browser = await webkit.launch()
    const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }
    const ca = await browser.newContext(mobile), cb = await browser.newContext(mobile), co = await browser.newContext(mobile)
    const pa = await ca.newPage(), pb = await cb.newPage(), po = await co.newPage()
    await openQaSession(po, base, url, signed.session)
    await expect(po.getByRole('heading', { name: list.title, exact: true })).toBeVisible()
    const link = base + '#/s/' + list.share_token
    await pa.goto(link)
    const card = pa.locator(`[data-wish-id="${wish.id}"]`)
    await card.getByRole('link', { name: 'Zum Shop', exact: true }).click()
    const dialog = pa.getByRole('dialog')
    await expect(dialog).toContainText('komm danach hierher zurück')
    await expect(dialog.getByRole('button', { name: 'Als gekauft markieren', exact: true })).toBeEnabled()
    assert.equal((await shared(a)).items.find(w => w.id === wish.id).purchased, false)
    assert.equal(ca.pages().length, 1)
    assert.deepEqual((await new AxeBuilder({ page: pa }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id), [])
    await pa.screenshot({ path: 'test-results/gift-purchase-live-mobile.png' })
    await dialog.getByRole('button', { name: 'Als gekauft markieren', exact: true }).click()
    await expect(dialog.getByRole('status')).toContainText('Festgenagelt')
    await dialog.getByRole('button', { name: 'Zurück zur Liste', exact: true }).click()
    await expect(card.locator('.gift-badge')).toHaveText('Bereits gekauft')
    await pb.goto(link)
    const otherCard = pb.locator(`[data-wish-id="${wish.id}"]`)
    await expect(otherCard.locator('.gift-badge')).toHaveText('Bereits gekauft')
    await expect(otherCard.getByRole('button', { name: 'Kaufmarkierung verwalten', exact: true })).toHaveCount(0)
    await po.reload()
    await expect(po.getByRole('heading', { name: list.title, exact: true })).toBeVisible()
    await expect(po.locator('.gift-badge,.gift-purchase-status')).toHaveCount(0)
    await po.goto(link)
    await expect(po.getByRole('heading', { name: list.title, exact: true })).toBeVisible()
    await expect(po.locator('.gift-badge,.gift-purchase-status,.guest-gift-guide')).toHaveCount(0)
    assert.deepEqual(await ok(owner.from('wishes').select('*').eq('id', wish.id).single()), wish)
    await pa.reload()
    await card.getByRole('button', { name: 'Kaufmarkierung verwalten', exact: true }).click()
    await pa.getByRole('button', { name: 'Meine Markierung aufheben', exact: true }).click()
    await expect(pa.getByRole('dialog').getByRole('status')).toContainText('Kaufmarkierung aufgehoben')
    await pb.bringToFront(); await pb.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(otherCard.locator('.gift-badge')).toHaveCount(0, { timeout: 15000 })
    checks += 14
  }
  phase = 'revocation remains effective for purchase mutations'
  await ok(owner.rpc('rotate_share_token', { list_id: list.id }))
  await denied(a.rpc('purchase_wish', params(wish, first)))
  await denied(a.rpc('undo_wish_purchase', params(secondWish, first)))
  console.log(JSON.stringify({ passed: true, checks, anonymousGuests: 2, ownerUnchanged: true, simultaneousPurchaseProtected: true, mobileUi: process.env.WUNSCHNAGEL_QA_API_ONLY !== '1' }))
} catch (error) { console.error(JSON.stringify({ phase, message: error.message.split('\n')[0] })); process.exitCode = 1 }
finally { await browser?.close(); if (userId) { const { error } = await admin.auth.admin.deleteUser(userId); if (error) { console.error('Isolated QA account cleanup failed.'); process.exitCode = 1 } } console.log('Isolated gift QA account and all associated data removed.') }
