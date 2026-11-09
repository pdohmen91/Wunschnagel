import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
const backend = 'https://security-test.supabase.co', id = '00000000-0000-4000-8000-000000000061', uid = '00000000-0000-4000-8000-000000000062'
const token = 'd'.repeat(64), storageKey = 'wunschnagel-saved-lists-v1'
const shared = { id, title: 'Weihnachtswünsche für Alex', description: '', emoji: '🎄', visibility: 'link', created_at: new Date().toISOString() }
const entry = { list_id: id, kind: 'token', value: token, title: shared.title, emoji: shared.emoji, saved_at: new Date().toISOString() }
type State = { entries: unknown[]; writes: number; reads?: number; failRead?: boolean; failWrite?: boolean }
function session() {
  const now = Math.floor(Date.now() / 1000)
  const jwt = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: uid, role: 'authenticated', aud: 'authenticated', exp: now + 3600 })).toString('base64url') + '.fixture-only'
  return { access_token: jwt, refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: { id: uid, aud: 'authenticated', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'QA Merker' }, created_at: new Date().toISOString() } }
}
async function mock(page: Page, state: State) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(backend + '/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS,DELETE' }
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    if (path.endsWith('/get_shared_wishlist')) { await route.fulfill({ headers, json: { list: shared, items: [], can_purchase: true } }); return }
    if (path.endsWith('/get_wishlist_bookmarks')) { state.reads = (state.reads || 0) + 1; await route.fulfill(state.failRead ? { status: 500, headers, json: { message: 'Offline fixture' } } : { headers, json: state.entries }); return }
    if (path.endsWith('/save_wishlist_bookmark')) {
      state.writes++; expect(request.postDataJSON().expected_user).toBe(uid)
      if (state.failWrite) { await route.fulfill({ status: 500, headers, json: { message: 'Speichern fehlgeschlagen' } }); return }
      const row = { ...entry, value: request.postDataJSON().bookmark_value, available: true }; state.entries = [row]
      await route.fulfill({ headers, json: row }); return
    }
    if (path.endsWith('/delete_wishlist_bookmark')) { state.entries = []; await route.fulfill({ status: 204, headers }); return }
    if (path.endsWith('/logout')) { await route.fulfill({ status: 204, headers }); return }
    await route.fulfill({ headers, json: [] })
  })
}
async function library(page: Page) {
  if (await page.locator('.topbar .mobile-list-trigger').isVisible()) await page.getByRole('button', { name: 'Listen', exact: true }).click()
  else await page.getByRole('button', { name: /Gemerkte Listen/ }).click()
  return page.getByRole('dialog', { name: 'Meine Wunschlisten' })
}
async function audit(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([])
}

async function signIn(page: Page) {
  await page.context().addInitScript(auth => {
    if (sessionStorage.getItem('qa-auth-seeded')) return
    localStorage.setItem('sb-security-test-auth-token', JSON.stringify(auth)); sessionStorage.setItem('qa-auth-seeded', '1')
  }, session())
}
async function legacy(page: Page) {
  await page.context().addInitScript(({ entry, storageKey }) => {
    if (sessionStorage.getItem('qa-legacy-seeded')) return
    localStorage.setItem(storageKey, JSON.stringify([entry])); sessionStorage.setItem('qa-legacy-seeded', '1')
  }, { entry, storageKey })
}

test('guests cannot save or access bookmarks, including old local references', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  const state: State = { entries: [entry], writes: 0 }; await mock(page, state); await legacy(page)
  await page.goto('/#/s/' + token)
  await expect(page.getByRole('heading', { name: shared.title, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Zum Merken anmelden', exact: true })).toHaveAttribute('href', '/')
  await expect(page.getByRole('button', { name: /^(Liste merken|Gemerkt|Link aktualisieren|Listen)$/ })).toHaveCount(0)
  await expect(page.locator('.saved-library-trigger, .saved-list-entry')).toHaveCount(0)
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull()
  await audit(page)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Zum Merken anmelden', exact: true })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Mit Google anmelden', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toHaveCount(0)
  expect(state.writes).toBe(0); expect(state.reads || 0).toBe(0)
})

test('signed-in users save, reopen and remove account references on a narrow phone', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 700 })
  const state: State = { entries: [], writes: 0 }; await mock(page, state); await signIn(page)
  await page.goto('/#/s/' + token)
  await page.getByRole('button', { name: 'Liste merken', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Gemerkt', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await audit(page)
  await page.goto('/')
  const dialog = await library(page)
  await expect(dialog.locator('.saved-list-entry')).toContainText(shared.title)
  await expect(dialog.locator('.saved-list-entry')).toContainText('In deinem Konto')
  await audit(page)
  await dialog.screenshot({ path: info.outputPath('gemerkte-listen-320.png') })
  await dialog.getByRole('link', { name: new RegExp(shared.title) }).click()
  await expect(page.getByRole('heading', { name: shared.title, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Liste bearbeiten', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Gemerkt', exact: true })).toBeVisible()
  const again = await library(page)
  await again.getByRole('button', { name: /nicht mehr merken/ }).click()
  await expect(again.locator('.saved-list-entry')).toHaveCount(0)
  await again.getByRole('button', { name: 'Schließen', exact: true }).click()
  await expect(page.getByRole('heading', { name: shared.title, exact: true })).toBeVisible()
  expect(state.writes).toBe(1)
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull()
})

test('legacy guest entries never enter an account and sign-out hides all account bookmarks', async ({ page }) => {
  const state: State = { entries: [], writes: 0 }; await mock(page, state); await signIn(page); await legacy(page)
  await page.goto('/#/s/' + token)
  let dialog = await library(page)
  await expect(dialog.locator('.saved-list-entry')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Ins Konto übernehmen', exact: true })).toHaveCount(0)
  expect(state.writes).toBe(0)
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull()
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click()
  await page.getByRole('button', { name: 'Liste merken', exact: true }).click()
  await page.reload(); dialog = await library(page)
  await expect(dialog.locator('.saved-list-entry')).toContainText('In deinem Konto')
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click()
  await page.locator('.app-shell[data-compact=true] .topbar, .app-shell[data-compact=false] .profile').getByRole('button', { name: 'Abmelden', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Zum Merken anmelden', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Listen|Liste merken|Gemerkt)$/ })).toHaveCount(0)
  await expect(page.locator('.saved-library-trigger, .saved-list-entry')).toHaveCount(0)
  expect(state.entries).toHaveLength(1)
})

test('renewed links replace the account reference without a local backup', async ({ page }) => {
  const state: State = { entries: [], writes: 0 }; await mock(page, state); await signIn(page)
  await page.goto('/#/s/' + token)
  await page.getByRole('button', { name: 'Liste merken', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Gemerkt', exact: true })).toBeVisible()
  await page.goto('/#/s/' + 'e'.repeat(64))
  await page.getByRole('button', { name: 'Link aktualisieren', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Gemerkt', exact: true })).toBeVisible()
  expect(state.entries).toHaveLength(1); expect(state.entries[0]).toMatchObject({ value: 'e'.repeat(64) })
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull()
})

test('account load and write failures are visible and can be retried without false saved state', async ({ page, context }) => {
  const state: State = { entries: [], writes: 0, failRead: true, failWrite: true }; await mock(page, state)
  await context.addInitScript(auth => { if (!localStorage.getItem('sb-security-test-auth-token')) localStorage.setItem('sb-security-test-auth-token', JSON.stringify(auth)) }, session())
  await page.goto('/#/s/' + token)
  await page.getByRole('button', { name: 'Liste merken', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Speichern fehlgeschlagen')
  await expect(page.getByRole('button', { name: 'Liste merken', exact: true })).toHaveAttribute('aria-pressed', 'false')
  const dialog = await library(page)
  await expect(dialog.getByRole('alert')).toContainText('nicht geladen')
  state.failRead = false; state.entries = [{ ...entry, available: false }]
  await dialog.getByRole('button', { name: 'Erneut versuchen', exact: true }).click()
  await expect(dialog.locator('.saved-list-entry')).toContainText('Link nicht mehr verfügbar')
  await dialog.getByRole('button', { name: /nicht mehr merken/ }).click()
  await expect(dialog.locator('.saved-list-entry')).toHaveCount(0)
})
