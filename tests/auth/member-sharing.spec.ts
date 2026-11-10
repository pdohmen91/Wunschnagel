import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const backend = 'https://security-test.supabase.co'
const uid = '00000000-0000-4000-8000-000000000071'
const ownerId = '00000000-0000-4000-8000-000000000072'
const listId = '00000000-0000-4000-8000-000000000073'
const peerId = '00000000-0000-4000-8000-000000000074'
const token = 'a'.repeat(64), inviteToken = 'b'.repeat(64)
type State = { owner?: boolean; visibility?: 'private' | 'link' | 'public'; failInvite?: boolean; activeInvite?: boolean; failRead?: boolean; removed?: boolean; deleted?: boolean; updated?: boolean }

async function setup(page: Page, state: State) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.context().addInitScript(({ uid }) => {
    const now = Math.floor(Date.now() / 1000)
    const jwt = btoa('{"alg":"HS256","typ":"JWT"}') + '.' + btoa(JSON.stringify({ sub: uid, role: 'authenticated', aud: 'authenticated', exp: now + 3600 })) + '.fixture'
    localStorage.setItem('sb-security-test-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: { id: uid, aud: 'authenticated', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'QA Mitbearbeiter' } } }))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { sessionStorage.setItem('qa-copied-link', value) } } })
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => { sessionStorage.setItem('qa-shared-link', data.url || '') } })
  }, { uid })
  const list = { id: listId, owner_id: state.owner ? uid : ownerId, title: 'Unsere gemeinsamen Wünsche', description: '', emoji: '🎁', visibility: state.visibility || 'private', share_token: token, created_at: new Date().toISOString() }
  await page.route(backend + '/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' }
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    if (path.endsWith('/get_my_wishlists')) { await route.fulfill({ headers, json: state.deleted ? [] : [list] }); return }
    if (path.endsWith('/enable_wishlist_sharing')) {
      expect(request.postDataJSON()).toEqual({ list_id: listId })
      list.visibility = 'link'; await route.fulfill({ headers, status: 204 }); return
    }
    if (path.endsWith('/get_collaboration')) {
      const members = [
        ...(!state.owner ? [{ user_id: uid, display_name: 'QA Mitbearbeiter', email: 'member@example.invalid' }] : []),
        ...(!state.removed ? [{ user_id: peerId, display_name: 'QA Weitere Person', email: 'peer@example.invalid' }] : []),
      ]
      await route.fulfill(state.failRead ? { status: 500, headers, json: { message: 'Einladungen konnten nicht geladen werden.' } } : { headers, json: { owner: { user_id: list.owner_id, display_name: 'QA Besitzer', email: 'owner@example.invalid' }, invite: state.activeInvite ? { token: inviteToken, expires_at: '2027-01-01T00:00:00Z' } : null, members } }); return
    }
    if (path.endsWith('/create_wishlist_invite')) {
      expect(request.postDataJSON()).toEqual({ list_id: listId })
      if (state.failInvite) { await route.fulfill({ status: 500, headers, json: { message: 'Einladung konnte nicht erstellt werden.' } }); return }
      state.activeInvite = true; await route.fulfill({ headers, status: 204 }); return
    }
    if (path.endsWith('/remove_wishlist_member')) {
      expect(request.postDataJSON()).toEqual({ list_id: listId, member_id: peerId })
      state.removed = true; state.activeInvite = false; await route.fulfill({ headers, status: 204 }); return
    }
    if (path.endsWith('/revoke_wishlist_invite')) { state.activeInvite = false; await route.fulfill({ headers, status: 204 }); return }
    if (path.endsWith('/rotate_share_token')) { list.share_token = 'c'.repeat(64); await route.fulfill({ headers, json: list.share_token }); return }
    if (path === '/rest/v1/wishlists') {
      expect(new URL(request.url()).searchParams.has('owner_id')).toBe(false)
      if (request.method() === 'PATCH') { Object.assign(list, request.postDataJSON()); state.updated = true }
      else if (request.method() === 'DELETE') state.deleted = true
      else throw new Error('Unexpected list request')
      await route.fulfill({ headers, json: { id: listId } }); return
    }
    await route.fulfill({ headers, json: [] })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Liste teilen', exact: true }).click()
  return page.getByRole('dialog', { name: 'Liste teilen', exact: true })
}

test('members enable and forward read-only links, then create and forward edit invitations', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const dialog = await setup(page, {})
  await expect(dialog.getByRole('button', { name: 'Nur ansehen', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Link zum Teilen erstellen', exact: true }).click()
  const readLink = dialog.getByRole('textbox', { name: 'Dein Link zum Weitergeben', exact: true })
  await expect(readLink).toHaveValue(new RegExp('#/s/' + token + '$'))
  await dialog.getByRole('button', { name: 'Link kopieren', exact: true }).click()
  expect(await page.evaluate(() => sessionStorage.getItem('qa-copied-link'))).toBe(await readLink.inputValue())
  await dialog.getByRole('button', { name: 'Über andere App teilen', exact: true }).click()
  expect(await page.evaluate(() => sessionStorage.getItem('qa-shared-link'))).toBe(await readLink.inputValue())
  await expect(dialog.getByText('Freigabelink verwalten', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Gemeinsam bearbeiten', exact: true }).click()
  await dialog.getByRole('button', { name: 'Einladungslink erstellen', exact: true }).click()
  const editLink = dialog.getByRole('textbox', { name: 'Einladungslink zum Mitbearbeiten', exact: true })
  await expect(editLink).toHaveValue(new RegExp('#/invite/' + inviteToken + '$'))
  await dialog.getByRole('button', { name: 'Einladung kopieren', exact: true }).click()
  expect(await page.evaluate(() => sessionStorage.getItem('qa-copied-link'))).toBe(await editLink.inputValue())
  await dialog.getByRole('button', { name: 'Einladung teilen', exact: true }).click()
  expect(await page.evaluate(() => sessionStorage.getItem('qa-shared-link'))).toBe(await editLink.inputValue())
  await expect(dialog.getByRole('button', { name: 'Einladungslink deaktivieren', exact: true })).toBeVisible()
  await expect(dialog.locator('.collaboration-members')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'QA Besitzer entfernen', exact: true })).toHaveCount(0)
  await expect(dialog.getByText('Besitzer · kann nicht entfernt werden', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'QA Weitere Person entfernen', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Gemeinsame Liste verlassen', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([])
  await dialog.screenshot({ path: info.outputPath('member-sharing-320.png') })
})

test('members can retry invitation loading and creation without a false success state', async ({ page }) => {
  await page.clock.install()
  const state: State = { visibility: 'public', failRead: true, failInvite: true }
  const dialog = await setup(page, state)
  await expect(dialog.getByRole('textbox', { name: 'Dein Link zum Weitergeben', exact: true })).toHaveValue(new RegExp('#/p/' + listId + '$'))
  await dialog.getByRole('button', { name: 'Gemeinsam bearbeiten', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('nicht geladen')
  state.failRead = false
  await dialog.getByRole('button', { name: 'Erneut laden', exact: true }).click()
  await dialog.getByRole('button', { name: 'Einladungslink erstellen', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('nicht erstellt')
  await expect(dialog.getByRole('textbox', { name: 'Einladungslink zum Mitbearbeiten', exact: true })).toHaveCount(0)
  const refreshed = page.waitForResponse(response => response.url().endsWith('/get_collaboration') && response.ok())
  await page.clock.fastForward(10000)
  await refreshed
  await expect(dialog.getByRole('alert')).toContainText('nicht erstellt')
  state.failInvite = false
  await dialog.getByRole('button', { name: 'Einladungslink erstellen', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Einladungslink zum Mitbearbeiten', exact: true })).toBeVisible()
})

test('members manage read links and invitations, remove peers and cannot remove the owner', async ({ page }) => {
  const state: State = { visibility: 'link', activeInvite: true }
  const dialog = await setup(page, state)
  await dialog.getByText('Freigabelink verwalten', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Link ersetzen', exact: true }).click()
  await dialog.getByRole('button', { name: 'Alten Link deaktivieren und neuen erstellen', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Dein Link zum Weitergeben', exact: true })).toHaveValue(new RegExp('#/s/' + 'c'.repeat(64) + '$'))
  await dialog.getByRole('button', { name: 'Gemeinsam bearbeiten', exact: true }).click()
  await dialog.getByRole('button', { name: 'Einladungslink deaktivieren', exact: true }).click()
  await dialog.getByRole('button', { name: 'Jetzt deaktivieren', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Einladungslink erstellen', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'QA Weitere Person entfernen', exact: true }).click()
  await dialog.getByRole('button', { name: 'Person entfernen', exact: true }).click()
  expect(state.removed).toBe(true)
  await expect(dialog.getByRole('button', { name: 'QA Weitere Person entfernen', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'QA Besitzer entfernen', exact: true })).toHaveCount(0)
  await expect(dialog.getByText('Besitzer · kann nicht entfernt werden', { exact: true })).toBeVisible()
})

test('members change list settings and can delete the whole list', async ({ page }) => {
  const state: State = {}
  const dialog = await setup(page, state)
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click()
  await page.getByRole('button', { name: 'Liste bearbeiten', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Wunschliste bearbeiten', exact: true })
  await edit.getByRole('textbox', { name: 'Name deiner Liste', exact: true }).fill('Gemeinsam geändert')
  await edit.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gemeinsam geändert', exact: true })).toBeVisible()
  expect(state.updated).toBe(true)
  await page.getByRole('button', { name: 'Liste bearbeiten', exact: true }).click()
  await page.getByRole('button', { name: 'Liste löschen', exact: true }).click()
  await page.getByRole('dialog', { name: 'Wunschliste löschen?', exact: true }).getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Deine erste Wunschliste', exact: true })).toBeVisible()
  expect(state.deleted).toBe(true)
})

test('owners have the same management controls and cannot leave their list', async ({ page }) => {
  const dialog = await setup(page, { owner: true, visibility: 'link', activeInvite: true })
  await expect(dialog.getByText('Freigabelink verwalten', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Gemeinsam bearbeiten', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Einladungslink zum Mitbearbeiten', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Einladungslink deaktivieren', exact: true })).toBeVisible()
  await expect(dialog.locator('.collaboration-members')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Gemeinsame Liste verlassen', exact: true })).toHaveCount(0)
})
