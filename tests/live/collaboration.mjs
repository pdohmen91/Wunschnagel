import { signInQa, openQaSession } from './qa-auth.mjs'
// Opt-in integration test against an explicitly configured backend. Creates
// isolated QA accounts only; never queries existing users or personal lists.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { webkit, chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const { url, publishable_key: key } = JSON.parse(readFileSync(process.env.WUNSCHNAGEL_QA_CONFIG, 'utf8'))
const ref = new URL(url).hostname.split('.')[0]
const keys = JSON.parse(execFileSync(process.env.WUNSCHNAGEL_QA_SUPABASE || 'supabase', ['projects', 'api-keys', `--remote=${ref}`, '--reveal', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, keys.find(k => k.type === 'secret').api_key, options)
const anon = createClient(url, key, options)
const base = process.env.WUNSCHNAGEL_QA_BASE || 'https://pdohmen91.github.io/Wunschnagel/'
const userIds = []
let browser, phase = 'Setup'
async function checked(request) { const { data, error } = await request; if (error) throw new Error(error.message); return data }
async function account(name) {
  const email = `wunschnagel-collab-qa-${randomBytes(8).toString('hex')}@example.invalid`, password = randomBytes(32).toString('base64url')
  const created = await checked(admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } }))
  userIds.push(created.user.id)
  const client = createClient(url, key, options)
  const signed = await signInQa(client, admin, email)
  return { id: created.user.id, client, session: signed.session }
}
async function signIn(page, session) { await openQaSession(page, base, url, session) }

const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }
try {
  const owner = await account('QA Besitzer'), editor = await account('QA Mitbearbeiter'), outsider = await account('QA Außenstehend')
  const list = await checked(owner.client.from('wishlists').insert({ owner_id: owner.id, title: '[QA] Gemeinsame Wünsche', emoji: '🔨', visibility: 'private' }).select().single())
  await checked(owner.client.from('wishes').insert({ wishlist_id: list.id, title: '[QA] Ein Wunsch', url: 'https://example.com/qa', notes: 'Nur isolierte Testdaten' }))
  const engine = process.env.WUNSCHNAGEL_QA_BROWSER === 'chrome' ? chromium : webkit
  browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {})
  const ownerContext = await browser.newContext(mobile), memberContext = await browser.newContext(mobile), guestContext = await browser.newContext(mobile)
  const ownerPage = await ownerContext.newPage(), memberPage = await memberContext.newPage(), guestPage = await guestContext.newPage()
  phase = 'Owner creates invitation through mobile UI'
  await signIn(ownerPage, owner.session)
  await expect(ownerPage.getByRole('heading', { name: list.title, exact: true })).toBeVisible()
  await ownerPage.getByRole('button', { name: 'Liste teilen', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'Gemeinsam bearbeiten', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'Einladungslink erstellen', exact: true }).click()
  const field = ownerPage.getByRole('textbox', { name: 'Einladungslink zum Mitbearbeiten' })
  await expect(field).toHaveValue(/#\/invite\/[a-f0-9]{64}$/)
  const link = await field.inputValue()
  let token = new URL(link).hash.split('/').at(-1)
  const box = await field.boundingBox()
  assert.ok(box.x >= 0 && box.x + box.width <= 390)
  assert.deepEqual((await new AxeBuilder({ page: ownerPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id), [])
  await ownerPage.screenshot({ path: 'test-results/collaboration-owner-mobile.png' })
  phase = 'Unauthenticated invitation and OAuth return'
  await memberPage.goto(link)
  await expect(memberPage.getByRole('heading', { name: /Gemeinsame Wünsche/ })).toBeVisible()
  await expect(memberPage.getByRole('article')).toHaveCount(0)
  assert.deepEqual((await new AxeBuilder({ page: memberPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id), [])
  assert.ok((await anon.from('wishlists').select('id').eq('id', list.id)).error)
  assert.equal((await checked(outsider.client.from('wishlists').select('id').eq('id', list.id))).length, 0)
  assert.equal(await checked(anon.rpc('get_shared_wishlist', { token: list.share_token })), null)
  await memberPage.screenshot({ path: 'test-results/collaboration-invitation-mobile.png' })
  await memberPage.route(`${url}/auth/v1/authorize?**`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>QA OAuth handoff</p>' }))
  await memberPage.getByRole('button', { name: 'Mit Google anmelden', exact: true }).click()
  await memberPage.waitForURL(target => target.pathname.endsWith('/authorize'))
  // The real Google consent was confirmed by the operator separately. Complete
  // this controlled handoff with the isolated user's legitimate Supabase session.
  await memberPage.route(`${url}/auth/v1/token?grant_type=pkce`, async route => {
    const body = route.request().postDataJSON()
    assert.equal(body.auth_code, 'qa-controlled-code')
    assert.ok(body.code_verifier?.length >= 43)
    await route.fulfill({ json: editor.session, headers: { 'Access-Control-Allow-Origin': '*' } })
  })
  await memberPage.goto(base + '?code=qa-controlled-code')
  await expect(memberPage).toHaveURL(/#\/invite\/[a-f0-9]{64}$/)
  await expect(memberPage.getByRole('button', { name: 'Einladung annehmen', exact: true })).toBeVisible()
  assert.equal((await checked(editor.client.rpc('get_my_wishlists'))).length, 0)
  await memberPage.getByRole('button', { name: 'Einladung annehmen', exact: true }).click()
  await expect(memberPage.getByRole('article')).toHaveCount(1)
  await expect(memberPage.getByRole('button', { name: 'Liste bearbeiten', exact: true })).toHaveCount(0)
  await expect(memberPage.getByText('Mitbearbeiter', { exact: true })).toBeVisible()
  await memberPage.reload()
  await expect(memberPage.getByRole('article')).toHaveCount(1)
  phase = 'Member adds and edits wishes'
  await memberPage.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).click()
  await memberPage.getByRole('textbox', { name: 'Link zum Wunsch', exact: true }).fill('https://example.com/qa-new')
  await memberPage.getByRole('textbox', { name: 'Dein Wunsch', exact: true }).fill('[QA] Gemeinsam ergänzt')
  await memberPage.getByRole('button', { name: 'Wunsch speichern', exact: true }).click()
  await memberPage.getByRole('dialog').waitFor({ state: 'detached' })
  const wish = memberPage.getByRole('article').filter({ hasText: '[QA] Gemeinsam ergänzt' })
  await expect(wish).toBeVisible()
  await wish.locator('summary').click()
  await wish.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  await memberPage.getByRole('textbox', { name: 'Dein Wunsch', exact: true }).fill('[QA] Gemeinsam geändert')
  await memberPage.getByRole('button', { name: 'Wunsch speichern', exact: true }).click()
  await memberPage.getByRole('dialog').waitFor({ state: 'detached' })
  const saved = await checked(editor.client.from('wishes').select('id').eq('wishlist_id', list.id).eq('title', '[QA] Gemeinsam geändert').single())
  const changedWish = memberPage.getByRole('article').filter({ hasText: '[QA] Gemeinsam geändert' })
  await changedWish.locator('summary').click()
  await changedWish.getByRole('button', { name: 'Als erfüllt markieren', exact: true }).click()
  await expect(changedWish.locator('.fulfilled-badge')).toHaveText('Erfüllt')
  await checked(editor.client.from('wishes').insert({ wishlist_id: list.id, title: '[QA] Zum Löschen', url: 'https://example.com/delete' }))
  await memberPage.reload()
  const toDelete = memberPage.getByRole('article').filter({ hasText: '[QA] Zum Löschen' })
  await toDelete.locator('summary').click()
  await toDelete.getByRole('button', { name: 'Löschen', exact: true }).click()
  await memberPage.getByRole('dialog').getByRole('button', { name: 'Löschen', exact: true }).click()
  await memberPage.getByRole('dialog').waitFor({ state: 'detached' })
  await expect(memberPage.getByRole('article')).toHaveCount(2)
  assert.equal((await checked(editor.client.from('wishlists').update({ visibility: 'public' }).eq('id', list.id).select('id'))).length, 0)
  assert.equal((await checked(editor.client.from('wishlists').delete().eq('id', list.id).select('id'))).length, 0)
  for (const fn of ['get_collaboration', 'create_wishlist_invite', 'revoke_wishlist_invite']) assert.ok((await editor.client.rpc(fn, { list_id: list.id })).error)
  phase = 'Member update reaches owner, management shows joined user'
  await expect(ownerPage.getByText('QA Mitbearbeiter', { exact: true })).toBeVisible({ timeout: 15000 })
  await ownerPage.screenshot({ path: 'test-results/collaboration-members-mobile.png' })
  phase = 'Revocation blocks new joins while preserving existing membership'
  await ownerPage.getByRole('button', { name: 'Einladungslink deaktivieren', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'Jetzt deaktivieren', exact: true }).click()
  await expect(ownerPage.getByRole('button', { name: 'Einladungslink erstellen', exact: true })).toBeVisible()
  assert.ok((await checked(editor.client.rpc('get_my_wishlists'))).some(l => l.id === list.id))
  assert.ok((await outsider.client.rpc('accept_wishlist_invite', { invite_token: token })).error)
  await ownerPage.getByRole('button', { name: 'Einladungslink erstellen', exact: true }).click()
  await expect(field).toHaveValue(/#\/invite\/[a-f0-9]{64}$/)
  token = new URL(await field.inputValue()).hash.split('/').at(-1)
  await ownerPage.getByRole('button', { name: 'Schließen', exact: true }).click()
  await ownerPage.getByRole('dialog').waitFor({ state: 'detached' })
  await ownerPage.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(ownerPage.getByRole('heading', { name: '[QA] Gemeinsam geändert', exact: true })).toBeVisible({ timeout: 15000 })
  phase = 'Read-only guest links stay read-only'
  const readable = await checked(owner.client.from('wishlists').update({ visibility: 'link' }).eq('id', list.id).select().single())
  await guestPage.goto(base + '#/s/' + readable.share_token)
  await expect(guestPage.getByRole('article')).toHaveCount(2)
  await expect(guestPage.locator('.card-menu')).toHaveCount(0)
  await expect(guestPage.getByRole('button', { name: 'Wunsch hinzufügen', exact: true })).toHaveCount(0)
  assert.equal((await checked(outsider.client.from('wishes').update({ title: 'Blocked' }).eq('id', saved.id).select('id'))).length, 0)
  await checked(owner.client.from('wishlists').update({ visibility: 'private' }).eq('id', list.id))
  phase = 'Owner removes member and invitation cannot be reused'
  await ownerPage.getByRole('button', { name: 'Liste teilen', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'Gemeinsam bearbeiten', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'QA Mitbearbeiter entfernen', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'Person entfernen', exact: true }).click()
  await expect(ownerPage.getByRole('button', { name: 'Einladungslink erstellen', exact: true })).toBeVisible()
  await expect(ownerPage.getByText('QA Mitbearbeiter', { exact: true })).toHaveCount(0)
  assert.equal((await checked(editor.client.rpc('get_my_wishlists'))).length, 0)
  assert.equal((await checked(editor.client.from('wishes').update({ title: 'Blocked' }).eq('id', saved.id).select('id'))).length, 0)
  assert.ok((await editor.client.from('wishes').insert({ wishlist_id: list.id, title: 'Blocked', url: 'https://example.com' })).error)
  assert.ok((await editor.client.rpc('accept_wishlist_invite', { invite_token: token })).error)
  assert.equal(await checked(anon.rpc('get_wishlist_invite', { invite_token: token })), null)
  await memberPage.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(memberPage.getByRole('article')).toHaveCount(0, { timeout: 15000 })
  await guestPage.goto(link)
  await expect(guestPage.getByRole('alert')).toContainText('abgelaufen')
  phase = 'Member can rejoin with a fresh invitation and leave without deleting wishes'
  await ownerPage.getByRole('button', { name: 'Einladungslink erstellen', exact: true }).click()
  await expect(field).toHaveValue(/#\/invite\/[a-f0-9]{64}$/)
  const freshLink = await field.inputValue()
  await memberPage.goto(freshLink)
  await memberPage.getByRole('button', { name: 'Einladung annehmen', exact: true }).click()
  await expect(memberPage.getByRole('article')).toHaveCount(2)
  await memberPage.getByRole('button', { name: 'Gemeinsame Liste verwalten', exact: true }).click()
  await memberPage.getByRole('button', { name: 'Gemeinsame Liste verlassen', exact: true }).click()
  await memberPage.getByRole('button', { name: 'Liste verlassen', exact: true }).click()
  await memberPage.getByRole('dialog').waitFor({ state: 'detached' })
  await expect(memberPage.getByRole('article')).toHaveCount(0)
  assert.equal((await checked(owner.client.from('wishes').select('id').eq('wishlist_id', list.id))).length, 2)
  console.log(JSON.stringify({ invitationCreatedOnMobile: true, anonymousPreviewIsMinimal: true, oauthReturnRestoresInvitation: true, explicitAcceptanceRequired: true, joinedListSurvivesReload: true, memberCanAddAndEdit: true, listAdministrationOwnerOnly: true, updatesReachOwner: true, ownerSeesMembers: true, viewingLinksRemainReadOnly: true, revocationPreservesMembers: true, removalRevokesEditing: true, removedMemberCannotRejoin: true, memberCanLeaveWithoutDeletingWishes: true }))
} catch (e) {
  console.error(JSON.stringify({ phase, message: String(e.message).split('\n')[0].replace(/(access_token|refresh_token)=[^&\s]+/g, '$1=[redacted]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]') }))
  process.exitCode = 1
} finally {
  await browser?.close()
  for (const id of userIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) { console.error('QA cleanup failed for ' + id); process.exitCode = 1 }
  }
  console.log('Temporary QA accounts and all associated lists, wishes, invitations and memberships removed.')
}
