import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { searchWishes, sortWishesUI } from '../browser/ui'

const backend = 'https://security-test.supabase.co', token = 'c'.repeat(64)
const listId = '00000000-0000-4000-8000-000000000001', itemId = '00000000-0000-4000-8000-000000000002'
type State = { purchased: boolean; canPurchase: boolean; receipt: string | null; writes: number; fail?: boolean; offerSource?: 'ebay' | 'ebay_all'; highlighted?: boolean; extraWishes?: { id: string; title: string; purchased: boolean; fulfilled: boolean }[] }
async function mock(page: Page, state: State, signedIn = false) {
  if (signedIn) {
    const uid = '00000000-0000-4000-8000-000000000099', now = Math.floor(Date.now() / 1000)
    const jwt = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: uid, role: 'authenticated', aud: 'authenticated', exp: now + 3600 })).toString('base64url') + '.fixture-only'
    await page.addInitScript(auth => {
      localStorage.setItem('sb-security-test-auth-token', JSON.stringify(auth))
    }, { access_token: jwt, refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: { id: uid, aud: 'authenticated', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'QA Gast' }, created_at: new Date().toISOString() } })
  }
  await page.route(backend + '/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' }
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    if (path.endsWith('/get_shared_wishlist')) {
      const wish = { id: itemId, wishlist_id: listId, title: 'Eine besondere Espressokanne', notes: 'Bitte das kleine Modell.', offer_source: state.offerSource || 'none', highlighted: !!state.highlighted, url: 'https://shop.example/product', image_url: '', price: 39.9, fulfilled: false, purchased: state.purchased, created_at: new Date().toISOString() }
      const items = [wish, ...(state.extraWishes || []).map(item => ({ ...wish, ...item }))].map(({ purchased, ...item }) => ({ ...item, ...(state.canPurchase ? { purchased } : {}) }))
      await route.fulfill({ headers, json: { list: { id: listId, title: 'Geschenke für Alex', description: '', emoji: '🎁', visibility: 'link', created_at: new Date().toISOString() }, can_purchase: state.canPurchase, items } }); return
    }
    if (path.endsWith('/purchase_wish')) {
      state.writes++
      const body = request.postDataJSON()
      expect(body.list_id).toBe(listId); expect(body.item_id).toBe(itemId); expect(body.read_token).toBe(token); expect(body.receipt).toMatch(/^[a-f0-9]{64}$/)
      if (state.fail) { await route.fulfill({ headers, status: 500, json: { message: 'Speichern fehlgeschlagen.' } }); return }
      state.receipt = body.receipt; state.purchased = true
      await route.fulfill({ headers, json: 'purchased' }); return
    }
    if (path.endsWith('/undo_wish_purchase')) {
      expect(request.postDataJSON().receipt).toBe(state.receipt)
      state.purchased = false
      await route.fulfill({ headers, json: true }); return
    }
    await route.fulfill({ headers, json: [] })
  })
  await page.context().route('https://shop.example/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Externer Shop</h1>' }))
  await page.goto('/#/s/' + token)
  await expect(page.getByRole('heading', { name: 'Geschenke für Alex', exact: true })).toBeVisible()
}

test('shop opening first explains the purchase action and only continues after the guest confirms', async ({ page }) => {
  const state = { purchased: false, canPurchase: true, receipt: null, writes: 0 }
  await mock(page, state)
  await page.getByRole('link', { name: 'Zum Shop', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('komm danach hierher zurück')
  await expect(dialog).toContainText('Ohne Anmeldung')
  await expect(dialog.getByRole('link', { name: 'Zum Shop', exact: true })).toBeVisible()
  expect(page.context().pages()).toHaveLength(1)
  expect(state.writes).toBe(0)
  const popup = page.waitForEvent('popup')
  await dialog.getByRole('link', { name: 'Zum Shop', exact: true }).click()
  await expect((await popup).getByRole('heading')).toHaveText('Externer Shop')
  expect(state.writes).toBe(0)
  await dialog.getByRole('button', { name: 'Als gekauft markieren', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Festgenagelt')
  await dialog.getByRole('button', { name: 'Zurück zur Liste', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Alle Wünsche sind bereits gekauft' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Gekaufte anzeigen', exact: true }).check()
  await expect(page.locator('.gift-purchase-status')).toContainText('Bereits gekauft')
  expect(state.writes).toBe(1)
  await page.reload()
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Gekaufte anzeigen', exact: true }).check()
  await page.getByRole('button', { name: 'Kaufmarkierung verwalten', exact: true }).click()
  await page.getByRole('button', { name: 'Meine Markierung aufheben', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Kaufmarkierung aufgehoben')
  await page.getByRole('button', { name: 'Zurück zur Liste', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Gekaufte anzeigen', exact: true }).uncheck()
  await expect(page.getByRole('article')).toBeVisible()
  await expect(page.getByRole('article')).not.toHaveClass(/is-purchased/)
})

test('product image and explicit used-offer search also use the small interstitial and fit on mobile', async ({ page }, info) => {
  if (info.project.name === 'auth-webkit') await page.setViewportSize({ width: 390, height: 650 })
  await mock(page, { purchased: false, canPurchase: true, receipt: null, writes: 0, offerSource: 'ebay' })
  await page.getByRole('link', { name: 'Zum Shop: Eine besondere Espressokanne', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Zum Shop', exact: true })).toHaveAttribute('href', 'https://shop.example/product')
  await page.getByRole('button', { name: 'Zurück zur Liste', exact: true }).click()
  await page.locator('.offer-search-link').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('link', { name: 'Gebraucht suchen', exact: true })).toHaveAttribute('href', /https:\/\/www.ebay.de\//)
  const box = await dialog.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await expect(dialog.getByRole('button', { name: 'Als gekauft markieren', exact: true })).toBeInViewport()
  await expect(dialog.getByRole('button', { name: 'Zurück zur Liste', exact: true })).toBeInViewport()
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))) })
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: test.info().outputPath('gift-dialog.png') })
})

test('all-offer eBay wishes hide original shop links and route the image through the eBay gift flow', async ({ page }) => {
  const state: State = { purchased: false, canPurchase: true, receipt: null, writes: 0, offerSource: 'ebay_all' }
  await mock(page, state)
  const wish = page.getByRole('article')
  await expect(wish.locator('a[href="https://shop.example/product"]')).toHaveCount(0)
  await expect(wish.locator('.shop-name')).toHaveText('eBay')
  const searchUrl = await wish.locator('.offer-search-link').getAttribute('href')
  await expect(wish.locator('.wish-image-link')).toHaveAttribute('href', searchUrl!)
  await wish.getByRole('link', { name: 'Bei eBay suchen: Eine besondere Espressokanne', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('link', { name: 'Bei eBay suchen', exact: true })).toHaveAttribute('href', searchUrl!)
  await expect(dialog.getByRole('button', { name: 'Als gekauft markieren', exact: true })).toBeVisible()
  expect(state.writes).toBe(0)
  state.canPurchase = false
  await page.reload()
  await expect(wish.locator('a[href="https://shop.example/product"]')).toHaveCount(0)
  await expect(wish.locator('.wish-image-link')).toHaveAttribute('href', searchUrl!)
  await expect(page.locator('.gift-purchase-status')).toHaveCount(0)
})

test('another guest sees the bought warning without undo rights; the owner projection shows no purchase UI', async ({ page }) => {
  const state = { purchased: true, canPurchase: true, receipt: null, writes: 0 }
  await mock(page, state)
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Gekaufte anzeigen', exact: true }).check()
  await expect(page.locator('.gift-purchase-status')).toContainText('Bereits gekauft')
  const image = await page.locator('.wish-image').boundingBox(), badge = await page.locator('.gift-badge').boundingBox()
  expect(badge!.x).toBeGreaterThanOrEqual(image!.x)
  expect(badge!.x + badge!.width).toBeLessThanOrEqual(image!.x + image!.width)
  await expect(page.getByRole('button', { name: 'Kaufmarkierung verwalten', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Zum Shop', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Bitte schenke es nicht doppelt')
  await expect(page.getByRole('button', { name: 'Meine Markierung aufheben', exact: true })).toHaveCount(0)
  state.canPurchase = false
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Geschenke für Alex', exact: true })).toBeVisible()
  await expect(page.locator('.gift-purchase-status')).toHaveCount(0)
  await expect(page.locator('.guest-gift-guide')).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Gekaufte anzeigen', exact: true })).toHaveCount(0)
  await expect(page.getByRole('article')).toBeVisible()
  await expect(page.getByRole('article')).not.toHaveClass(/is-purchased/)
})

for (const signedIn of [false, true]) test(`purchases stay hidden until explicitly enabled for ${signedIn ? 'signed-in' : 'anonymous'} visitors`, async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const state: State = { purchased: true, canPurchase: true, receipt: null, writes: 0, highlighted: true, extraWishes: [
    { id: '00000000-0000-4000-8000-000000000003', title: 'Noch gewünschtes Buch', purchased: false, fulfilled: false },
    { id: '00000000-0000-4000-8000-000000000004', title: 'Schon erhaltene Tasse', purchased: false, fulfilled: true },
    { id: '00000000-0000-4000-8000-000000000005', title: 'Bereits besorgte Kopfhörer', purchased: true, fulfilled: false },
  ] }
  await mock(page, state, signedIn)
  await expect(page.locator('.app-shell')).toHaveAttribute('data-account-actions', String(signedIn))
  const toggle = page.getByRole('checkbox', { name: 'Gekaufte anzeigen', exact: true })
  const purchased = page.locator(`[data-wish-id="${itemId}"]`)
  await expect(toggle).not.toBeChecked()
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Alle Wünsche 2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(purchased).toHaveCount(0)
  await expect(page.locator('#purchase-filter-help')).toHaveText('2 gekaufte Wünsche ausgeblendet.')
  await page.getByRole('button', { name: 'Offen', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article')).toContainText('Noch gewünschtes Buch')
  await page.getByRole('button', { name: 'Erfüllt', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article')).toContainText('Schon erhaltene Tasse')
  await page.getByRole('button', { name: 'Alle Wünsche 2', exact: true }).click()
  await sortWishesUI(page, 'name')
  await expect(page.getByRole('article')).toHaveCount(2)
  await searchWishes(page, 'Espressokanne')
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.getByRole('button', { name: 'Filter zurücksetzen', exact: true }).click()
  await expect(toggle).not.toBeChecked()
  await expect(page.getByRole('article')).toHaveCount(2)
  await toggle.check()
  await expect(page.getByRole('article')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Alle Wünsche 4', exact: true })).toBeVisible()
  await expect(purchased).toHaveClass(/is-purchased/)
  await expect(purchased.locator('.gift-badge')).toHaveText('Bereits gekauft')
  await expect(purchased.locator('.gift-purchase-status')).toContainText('Bitte nicht noch einmal schenken.')
  await expect(purchased.locator('h2')).toHaveCSS('text-decoration-line', 'line-through')
  await expect(purchased.locator('.gift-purchase-status')).toHaveCSS('background-color', 'rgb(37, 77, 62)')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([])
  await page.screenshot({ path: info.outputPath(`purchased-${signedIn ? 'signed-in' : 'anonymous'}.png`) })
  await page.getByRole('button', { name: 'Offen', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(3)
  await toggle.uncheck()
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(purchased).toHaveCount(0)
  await toggle.check()
  await page.evaluate(() => { window.location.hash = '/s/' + 'd'.repeat(64) })
  await expect(toggle).not.toBeChecked()
  await expect(purchased).toHaveCount(0)
  expect(state.writes).toBe(0)
})

test('a purchase made by another visitor disappears on refresh until the filter is enabled', async ({ page }) => {
  const state: State = { purchased: false, canPurchase: true, receipt: null, writes: 0 }
  await mock(page, state)
  await expect(page.getByRole('article')).toBeVisible()
  state.purchased = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Gekaufte anzeigen', exact: true }).check()
  await expect(page.getByRole('article')).toHaveClass(/is-purchased/)
})

test('failed marking stays unbought and can be retried', async ({ page }) => {
  const state = { purchased: false, canPurchase: true, receipt: null, writes: 0, fail: true }
  await mock(page, state)
  await page.getByRole('button', { name: 'Als gekauft markieren', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Als gekauft markieren', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Als gekauft markieren', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Speichern fehlgeschlagen')
  expect(state.purchased).toBe(false)
  state.fail = false
  await dialog.getByRole('button', { name: 'Erneut prüfen', exact: true }).click()
  await dialog.getByRole('button', { name: 'Als gekauft markieren', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Festgenagelt')
})


test('guests see a highlight without gaining edit controls', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mock(page, { purchased: false, canPurchase: true, receipt: null, writes: 0, highlighted: true })
  const card = page.getByRole('article')
  await expect(card).toHaveClass(/is-highlighted/)
  await expect(card.locator('.wish-highlight-label')).toHaveText('Herzenswunsch')
  await expect(card.locator('.card-menu')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Hervorheben$|Hervorhebung entfernen/ })).toHaveCount(0)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([])
  await page.screenshot({ path: info.outputPath('shared-herzenswunsch.png') })
})
