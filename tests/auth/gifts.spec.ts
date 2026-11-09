import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

const backend = 'https://security-test.supabase.co', token = 'c'.repeat(64)
const listId = '00000000-0000-4000-8000-000000000001', itemId = '00000000-0000-4000-8000-000000000002'
type State = { purchased: boolean; canPurchase: boolean; receipt: string | null; writes: number; fail?: boolean; offerSource?: 'ebay' }
async function mock(page: Page, state: State) {
  await page.route(backend + '/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' }
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    if (path.endsWith('/get_shared_wishlist')) {
      await route.fulfill({ headers, json: { list: { id: listId, title: 'Geschenke für Alex', description: '', emoji: '🎁', visibility: 'link', created_at: new Date().toISOString() }, can_purchase: state.canPurchase, items: [{ id: itemId, wishlist_id: listId, title: 'Eine besondere Espressokanne', notes: 'Bitte das kleine Modell.', offer_source: state.offerSource || 'none', url: 'https://shop.example/product', image_url: '', price: 39.9, fulfilled: false, created_at: new Date().toISOString(), ...(state.canPurchase ? { purchased: state.purchased } : {}) }] } }); return
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
  await expect(page.locator('.gift-purchase-status')).toContainText('Bereits gekauft')
  expect(state.writes).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: 'Kaufmarkierung verwalten', exact: true }).click()
  await page.getByRole('button', { name: 'Meine Markierung aufheben', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Kaufmarkierung aufgehoben')
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

test('another guest sees the bought warning without undo rights; the owner projection shows no purchase UI', async ({ page }) => {
  const state = { purchased: true, canPurchase: true, receipt: null, writes: 0 }
  await mock(page, state)
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
