import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { chooseList } from '../browser/ui'
const backend = 'https://security-test.supabase.co', uid = '00000000-0000-4000-8000-000000000071', listId = '00000000-0000-4000-8000-000000000072'
const input = { title: 'Meine Geburtstagswünsche', description: '', emoji: '🎁', visibility: 'private' }
function session(userId = uid) {
  const now = Math.floor(Date.now() / 1000)
  const jwt = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: now + 3600 })).toString('base64url') + '.fixture-only'
  return { access_token: jwt, refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: { id: userId, aud: 'authenticated', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'QA Eigene Listen' }, created_at: new Date().toISOString() } }
}
async function setup(page: Page, signedIn: boolean, initialLists: object[] = []) {
  let lists = initialLists, writes = 0
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(backend + '/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' }
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    if (path.endsWith('/get_my_wishlists')) { await route.fulfill({ headers, json: lists }); return }
    if (path.endsWith('/wishlists') && request.method() === 'POST') {
      writes++
      const list = { ...request.postDataJSON(), id: listId, share_token: 'e'.repeat(64), created_at: new Date().toISOString() }
      lists = [list]; await route.fulfill({ headers, json: list }); return
    }
    if (path.endsWith('/logout')) { await route.fulfill({ headers, status: 204 }); return }
    await route.fulfill({ headers, json: [] })
  })
  if (signedIn) await page.addInitScript(auth => {
    if (sessionStorage.getItem('qa-auth-seeded')) return
    localStorage.setItem('sb-security-test-auth-token', JSON.stringify(auth)); sessionStorage.setItem('qa-auth-seeded', '1')
  }, session())
  await page.goto('/')
  return () => writes
}

test('signed-out visitors have no demo entry or list creation and private repository operations reject before network access', async ({ page }) => {
  const writes = await setup(page, false)
  await expect(page.getByRole('button', { name: 'Mit Google anmelden', exact: true })).toBeVisible()
  await expect(page.getByText('Melde dich an, um eigene Wunschlisten zu erstellen und geteilte Listen zu merken.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /ausprobieren|Neue Wunschliste|Wunschliste erstellen|Wunsch hinzufügen/ })).toHaveCount(0)
  const error = await page.evaluate(async ({ path, input }) => {
    const { cloudRepository } = await import(path)
    try { await cloudRepository('').createList(input); return '' } catch (e) { return (e as Error).message }
  }, { path: '/src/lib/repository.ts', input })
  expect(error).toContain('Bitte melde dich an')
  expect(writes()).toBe(0)
})

test('an authenticated user can still create a wishlist and reopen it after reload', async ({ page }) => {
  const writes = await setup(page, true)
  await page.getByRole('button', { name: 'Wunschliste erstellen', exact: true }).click()
  await page.getByRole('textbox', { name: 'Name deiner Liste', exact: true }).fill(input.title)
  await page.getByRole('button', { name: 'Liste erstellen', exact: true }).click()
  await expect(page.getByRole('heading', { name: input.title, exact: true })).toBeVisible()
  expect(writes()).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('herzenswuensche-demo-v1'))).toBeNull()
  await page.reload()
  await expect(page.getByRole('heading', { name: input.title, exact: true })).toBeVisible()
})

test('losing the session closes an open creation form and returns to sign-in', async ({ page }) => {
  const writes = await setup(page, true)
  await page.getByRole('button', { name: 'Wunschliste erstellen', exact: true }).click()
  await page.getByRole('textbox', { name: 'Name deiner Liste', exact: true }).fill('Nicht ohne Anmeldung speichern')
  await page.evaluate(async path => { const { supabase } = await import(path); await supabase.auth.signOut() }, '/src/lib/client.ts')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mit Google anmelden', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Liste erstellen', exact: true })).toHaveCount(0)
  expect(writes()).toBe(0)
})

function selectionLists() {
  return ['Meine erste Liste', 'Gemeinsame Lieblingswünsche'].map((title, index) => ({
    ...input, title, id: `${listId.slice(0, -1)}${index + 3}`, owner_id: index ? 'another-owner' : uid,
    emoji: '🌿', share_token: 'e'.repeat(64), created_at: new Date().toISOString(),
  }))
}

test('reload restores the selected shared member list even when list order changes', async ({ page }) => {
  const lists = selectionLists()
  await setup(page, true, lists)
  await chooseList(page, lists[1].title)
  await page.reload()
  await expect(page.getByRole('heading', { name: lists[1].title, exact: true })).toBeVisible()
  await chooseList(page, lists[0].title)
  const title = lists[0].title
  lists.reverse()
  await page.reload()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
})

test('a removed selected list falls back to an available list or the empty state', async ({ page }) => {
  const lists = selectionLists()
  await setup(page, true, lists)
  await chooseList(page, lists[1].title)
  lists.pop()
  await page.reload()
  await expect(page.getByRole('heading', { name: lists[0].title, exact: true })).toBeVisible()
  lists.splice(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Deine erste Wunschliste', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('accounts sharing the same lists keep independent selections in this browser', async ({ page }) => {
  const lists = selectionLists()
  await setup(page, true, lists)
  await chooseList(page, lists[1].title)
  await page.evaluate(auth => localStorage.setItem('sb-security-test-auth-token', JSON.stringify(auth)), session('00000000-0000-4000-8000-000000000081'))
  await page.reload()
  await expect(page.getByRole('heading', { name: lists[0].title, exact: true })).toBeVisible()
  await page.evaluate(auth => localStorage.setItem('sb-security-test-auth-token', JSON.stringify(auth)), session())
  await page.reload()
  await expect(page.getByRole('heading', { name: lists[1].title, exact: true })).toBeVisible()
})

test('unavailable preference storage still allows opening and switching lists', async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('wunschnagel-selected-list:')) throw new DOMException('Storage disabled', 'SecurityError')
      return get.call(this, key)
    }
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('wunschnagel-selected-list:')) throw new DOMException('Storage disabled', 'SecurityError')
      return set.call(this, key, value)
    }
  })
  const lists = selectionLists()
  await setup(page, true, lists)
  await chooseList(page, lists[1].title)
  await page.reload()
  await expect(page.getByRole('heading', { name: lists[0].title, exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
