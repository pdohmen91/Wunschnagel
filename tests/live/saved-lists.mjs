// Opt-in: isolated QA accounts/lists only. Admin-generated links never send email.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { webkit, expect } from '@playwright/test'
import { openQaSession, signInQa } from './qa-auth.mjs'
const { url, publishable_key: key } = JSON.parse(readFileSync(process.env.WUNSCHNAGEL_QA_CONFIG, 'utf8'))
const ref = new URL(url).hostname.split('.')[0]
const keys = JSON.parse(execFileSync(process.env.WUNSCHNAGEL_QA_SUPABASE || 'supabase', ['projects', 'api-keys', `--remote=${ref}`, '--reveal', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const client = () => createClient(url, key, options)
const admin = createClient(url, keys.find(k => k.type === 'secret').api_key, options), owner = client(), viewer = client(), anon = client()
const base = process.env.WUNSCHNAGEL_QA_BASE || 'https://pdohmen91.github.io/Wunschnagel/'
const users = []
let browser, phase = 'setup', checks = 0
async function ok(promise) { const r = await promise; assert.equal(r.error, null, r.error?.message); checks++; return r.data }
async function denied(promise) { assert.ok((await promise).error); checks++ }
async function library(page) { await page.getByRole('button', { name: 'Listen', exact: true }).click(); return page.getByRole('dialog', { name: 'Meine Wunschlisten' }) }
try {
  const sessions = []
  for (const [api, label] of [[owner, 'Besitzer'], [viewer, 'Merker']]) {
    const email = `wunschnagel-bookmarks-qa-${randomBytes(8).toString('hex')}@example.invalid`
    const { user } = await ok(admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: `QA ${label}` } }))
    users.push(user.id); sessions.push((await signInQa(api, admin, email)).session)
  }
  const [ownerId, viewerId] = users
  const list = await ok(owner.from('wishlists').insert({ owner_id: ownerId, title: '[QA] Weihnachtswünsche merken', visibility: 'link' }).select().single())
  const mine = await ok(viewer.from('wishlists').insert({ owner_id: viewerId, title: '[QA] Eigene Wunschliste', visibility: 'private' }).select().single())
  const get = api => ok(api.rpc('get_wishlist_bookmarks', { expected_user: api === owner ? ownerId : viewerId }))
  const save = (api = viewer, value = list.share_token, kind = 'token', expected = viewerId) => api.rpc('save_wishlist_bookmark', { bookmark_kind: kind, bookmark_value: value, expected_user: expected })
  const remove = id => ok(viewer.rpc('delete_wishlist_bookmark', { bookmark_list_id: id, expected_user: viewerId }))
  phase = 'RPC permissions and account isolation'
  await denied(save(anon)); await denied(anon.rpc('get_wishlist_bookmarks', { expected_user: viewerId }))
  await denied(anon.from('wishlist_bookmarks').select('*')); await denied(viewer.from('wishlist_bookmarks').select('*'))
  await denied(save(viewer, list.share_token, 'token', ownerId))
  await denied(viewer.rpc('get_wishlist_bookmarks', { expected_user: ownerId }))
  await denied(viewer.rpc('delete_wishlist_bookmark', { bookmark_list_id: list.id, expected_user: ownerId }))
  const saved = await ok(save())
  assert.equal(saved.list_id, list.id); assert.equal(saved.available, true)
  assert.deepEqual(Object.keys(saved).sort(), ['available','emoji','kind','list_id','saved_at','title','value'].sort())
  await ok(save()); assert.equal((await get(viewer)).length, 1); assert.deepEqual(await get(owner), [])
  assert.deepEqual(await ok(viewer.from('wishlists').select('*').eq('id', list.id)), [])
  assert.equal((await ok(viewer.rpc('get_my_wishlists'))).some(row => row.id === list.id), false)
  phase = 'revocation never reveals new private metadata'
  await ok(owner.from('wishlists').update({ visibility: 'private', title: '[QA] SECRET NEW TITLE', emoji: '🔒' }).eq('id', list.id))
  const stale = (await get(viewer))[0]
  assert.equal(stale.available, false); assert.equal(stale.title, list.title); assert.notEqual(stale.emoji, '🔒')
  await denied(save())
  await ok(owner.from('wishlists').update({ visibility: 'link', title: list.title, emoji: list.emoji }).eq('id', list.id))
  const renewed = await ok(owner.rpc('rotate_share_token', { list_id: list.id }))
  await denied(save()); await ok(save(viewer, renewed))
  assert.equal((await get(viewer)).length, 1); assert.equal((await get(viewer))[0].value, renewed)
  list.share_token = renewed
  phase = 'deleted references remain removable and public visibility is checked'
  const temporary = await ok(owner.from('wishlists').insert({ owner_id: ownerId, title: '[QA] Temporary public reference', visibility: 'public' }).select().single())
  await ok(save(viewer, temporary.id, 'public'))
  await ok(owner.from('wishlists').delete().eq('id', temporary.id))
  assert.equal((await get(viewer)).find(row => row.list_id === temporary.id).available, false)
  await remove(temporary.id); await remove(list.id)
  assert.deepEqual(await get(viewer), [])
  assert.equal((await ok(anon.rpc('get_shared_wishlist', { token: list.share_token }))).list.id, list.id)
  if (process.env.WUNSCHNAGEL_QA_API_ONLY !== '1') {
    phase = 'mobile guests cannot save or access bookmarks'
    browser = await webkit.launch()
    const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' }
    const cg = await browser.newContext(mobile), ca = await browser.newContext(mobile), cb = await browser.newContext(mobile)
    const pg = await cg.newPage(), pa = await ca.newPage(), pb = await cb.newPage()
    const link = base + '#/s/' + list.share_token
    await pg.goto(link)
    await expect(pg.getByRole('heading', { name: list.title, exact: true })).toBeVisible()
    await expect(pg.getByRole('link', { name: 'Zum Merken anmelden', exact: true })).toBeVisible()
    await expect(pg.getByRole('button', { name: /^(Liste merken|Gemerkt|Listen)$/ })).toHaveCount(0)
    await expect(pg.locator('.saved-library-trigger, .saved-list-entry')).toHaveCount(0)
    await pg.goto(base)
    await expect(pg.getByRole('button', { name: 'Listen', exact: true })).toHaveCount(0)
    assert.equal(await pg.evaluate(() => localStorage.getItem('wunschnagel-saved-lists-v1')), null)
    assert.deepEqual(await get(viewer), [])
    phase = 'account save and independent-device synchronization'
    await openQaSession(pa, link, url, sessions[1])
    await pa.getByRole('button', { name: 'Liste merken', exact: true }).click()
    await expect(pa.getByRole('button', { name: 'Gemerkt', exact: true })).toBeVisible()
    assert.equal((await get(viewer))[0].list_id, list.id)
    await openQaSession(pb, base, url, sessions[1])
    let dialog = await library(pb)
    await expect(dialog.locator('.saved-list-entry')).toContainText('In deinem Konto')
    await dialog.getByRole('link', { name: new RegExp(list.title.replace(/[\[\]]/g, '\\$&')) }).click()
    await expect(pb.getByRole('button', { name: 'Gemerkt', exact: true })).toBeVisible()
    await expect(pb.getByRole('button', { name: 'Liste bearbeiten', exact: true })).toHaveCount(0)
    await expect.poll(() => pb.locator('.christmas-header-art img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
    await pb.screenshot({ path: '/private/tmp/wunschnagel-bookmark-live-mobile.png', fullPage: true })
    phase = 'own-list navigation and removal do not change the shared source'
    dialog = await library(pb)
    await dialog.locator('.list-picker-options').getByRole('button', { name: new RegExp(mine.title.replace(/[\[\]]/g, '\\$&')) }).click()
    await expect(pb.getByRole('heading', { name: mine.title, exact: true })).toBeVisible()
    dialog = await library(pb)
    await dialog.getByRole('button', { name: /nicht mehr merken/ }).click()
    await expect(dialog.locator('.saved-list-entry')).toHaveCount(0)
    assert.deepEqual(await get(viewer), [])
    assert.equal((await ok(anon.rpc('get_shared_wishlist', { token: list.share_token }))).list.id, list.id)
    await pa.reload()
    await expect(pa.getByRole('button', { name: 'Liste merken', exact: true })).toBeVisible()
    checks += 17
    await Promise.all([cg.close(), ca.close(), cb.close()])
  }
  console.log(`PASS saved lists: ${checks} checks; isolated accounts, no email or real user data.`)
} catch (error) {
  console.error(`FAIL saved lists phase: ${phase}`)
  throw error
} finally {
  await browser?.close()
  for (const id of users.reverse()) { const result = await admin.auth.admin.deleteUser(id); if (result.error) throw new Error('Could not clean up isolated bookmark QA account') }
  console.log('QA accounts and their fixtures removed.')
}
