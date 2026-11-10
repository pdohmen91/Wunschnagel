// Opt-in regression test: newly-created QA users/lists only, no email or shops.
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
const admin = createClient(url, keys.find(k => k.type === 'secret').api_key, options), owner = createClient(url, key, options), editor = createClient(url, key, options), anon = createClient(url, key, options)
const base = process.env.WUNSCHNAGEL_QA_BASE || 'https://pdohmen91.github.io/Wunschnagel/'
const users = []; let browser, phase = 'setup', checks = 0
async function ok(request) { const r = await request; assert.equal(r.error, null, r.error?.message); checks++; return r.data }
async function denied(request) { assert.ok((await request).error); checks++ }
try {
  const sessions = []
  for (const [api, label] of [[owner, 'Besitzer'], [editor, 'Mitbearbeiter']]) {
    const email = `wunschnagel-highlight-qa-${randomBytes(8).toString('hex')}@example.invalid`
    const { user } = await ok(admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: `QA ${label}` } }))
    users.push(user.id); sessions.push((await signInQa(api, admin, email)).session)
  }
  const list = await ok(owner.from('wishlists').insert({ owner_id: users[0], title: '[QA] Herzenswunsch', visibility: 'link' }).select().single())
  const wish = await ok(owner.from('wishes').insert({ wishlist_id: list.id, title: '[QA] Besonders gewünscht', url: 'https://example.invalid/highlight', notes: '', price: 25 }).select().single())
  assert.equal(wish.highlighted, false)
  const shared = api => ok(api.rpc('get_shared_wishlist', { token: list.share_token }))
  phase = 'owner write, outsider/anonymous rejection, safe projection'
  await ok(owner.from('wishes').update({ highlighted: true }).eq('id', wish.id))
  assert.deepEqual(await ok(editor.from('wishes').update({ highlighted: false }).eq('id', wish.id).select('id')), [])
  await denied(anon.from('wishes').update({ highlighted: false }).eq('id', wish.id))
  const visible = await shared(anon)
  assert.equal(visible.items[0].highlighted, true)
  assert.equal('owner_id' in visible.list, false); assert.equal('share_token' in visible.list, false)
  await denied(anon.rpc('read_wishlist_payload', { list_id: list.id }))
  const receipt = randomBytes(32).toString('hex')
  await ok(anon.rpc('purchase_wish', { list_id: list.id, item_id: wish.id, read_token: list.share_token, receipt }))
  assert.equal('purchased' in (await shared(owner)).items[0], false)
  phase = 'invited editors can toggle without changing purchase status'
  await ok(owner.rpc('create_wishlist_invite', { list_id: list.id }))
  const invitation = (await ok(owner.rpc('get_collaboration', { list_id: list.id }))).invite.token
  await ok(editor.rpc('accept_wishlist_invite', { invite_token: invitation }))
  await ok(editor.from('wishes').update({ highlighted: false }).eq('id', wish.id).select('id').single())
  assert.equal((await shared(anon)).items[0].purchased, true)
  await ok(owner.from('wishes').update({ highlighted: true }).eq('id', wish.id))
  await denied(owner.from('wishes').update({ highlighted: null }).eq('id', wish.id))
  await denied(owner.from('wishlists').update({ visibility: 'public' }).eq('id', list.id))
  assert.equal((await shared(anon)).items[0].highlighted, true)
  assert.equal(await ok(anon.rpc('get_public_wishlist', { list_id: list.id })), null)
  await ok(owner.from('wishlists').update({ visibility: 'private' }).eq('id', list.id))
  assert.equal(await ok(anon.rpc('get_public_wishlist', { list_id: list.id })), null)
  await ok(owner.from('wishlists').update({ visibility: 'link' }).eq('id', list.id))
  // Returning from private visibility deliberately renews the read token.
  list.share_token = (await ok(owner.from('wishlists').select('share_token').eq('id', list.id).single())).share_token
  await ok(anon.rpc('undo_wish_purchase', { list_id: list.id, item_id: wish.id, read_token: list.share_token, receipt }))
  await ok(owner.from('wishes').update({ highlighted: false }).eq('id', wish.id))
  if (process.env.WUNSCHNAGEL_QA_API_ONLY !== '1') {
    phase = 'owner and shared mobile UI, persistence, removed footer'
    browser = await webkit.launch()
    const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' }
    const co = await browser.newContext(mobile), cg = await browser.newContext(mobile)
    const po = await co.newPage(), pg = await cg.newPage()
    // No external shop/preview traffic is needed for this test.
    await co.route(url + '/functions/v1/link-preview', route => {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,x-client-info,apikey,content-type', 'access-control-allow-methods': 'POST,OPTIONS' }
      return route.fulfill(route.request().method() === 'OPTIONS' ? { status: 204, headers } : { headers, json: { title: '[QA] Neu hervorgehoben', image_url: '', description: '' } })
    })
    await openQaSession(po, base, url, sessions[0])
    const card = po.locator(`[data-wish-id="${wish.id}"]`)
    await card.locator('summary').click()
    await card.getByRole('button', { name: 'Hervorheben', exact: true }).click()
    await expect(card).toHaveClass(/is-highlighted/)
    assert.equal((await shared(anon)).items[0].highlighted, true)
    await pg.goto(base + '#/s/' + list.share_token)
    await expect(pg.getByRole('article').locator('.wish-highlight-label')).toHaveText('Herzenswunsch')
    await expect(pg.locator('.card-menu')).toHaveCount(0)
    await expect(po.locator('.list-footer')).toHaveCount(0)
    await expect(pg.locator('.list-footer')).toHaveCount(0)
    await po.screenshot({ path: '/private/tmp/wunschnagel-highlight-owner.png' })
    await pg.screenshot({ path: '/private/tmp/wunschnagel-highlight-shared.png' })
    await po.reload()
    await expect(card).toHaveClass(/is-highlighted/)
    await card.locator('summary').click()
    await card.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    const choice = po.getByRole('checkbox', { name: 'Als Herzenswunsch hervorheben', exact: true })
    await expect(choice).toBeChecked(); await choice.uncheck()
    await po.getByRole('button', { name: 'Wunsch speichern', exact: true }).click()
    await expect(po.getByRole('dialog')).toHaveCount(0)
    await expect(card).not.toHaveClass(/is-highlighted/)
    await pg.reload()
    await expect(pg.getByRole('article')).not.toHaveClass(/is-highlighted/)
    await po.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).click()
    await po.getByRole('textbox', { name: 'Link zum Wunsch', exact: true }).fill('https://example.invalid/new-highlight')
    await po.getByRole('textbox', { name: 'Dein Wunsch', exact: true }).fill('[QA] Neu hervorgehoben')
    await po.getByRole('checkbox', { name: 'Als Herzenswunsch hervorheben', exact: true }).check()
    await po.getByRole('button', { name: 'Wunsch speichern', exact: true }).click()
    await expect(po.getByRole('dialog')).toHaveCount(0)
    await expect(po.getByRole('article').filter({ hasText: '[QA] Neu hervorgehoben' })).toHaveClass(/is-highlighted/)
    assert.equal((await shared(anon)).items.find(row => row.title === '[QA] Neu hervorgehoben').highlighted, true)
    await Promise.all([co.close(), cg.close()]); checks += 16
  }
  console.log(`PASS highlights: ${checks} checks; isolated users, no email or shop traffic.`)
} catch (error) { console.error(`FAIL highlights phase: ${phase}`); throw error }
finally {
  await browser?.close()
  for (const id of users.reverse()) { const result = await admin.auth.admin.deleteUser(id); if (result.error) throw new Error('Could not remove isolated highlight QA account') }
  console.log('QA users and their fixtures removed.')
}
