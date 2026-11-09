import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const backend = 'https://security-test.supabase.co', id = '00000000-0000-4000-8000-000000000001', token = 'c'.repeat(64)
type List = { title: string; visibility: 'public' | 'link' | 'private' }
async function fixture(page: Page, lists: List[]) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(backend + '/**', async route => {
    const path = new URL(route.request().url()).pathname
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST,GET,OPTIONS' }
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    if (path.endsWith('/get_public_wishlist') || path.endsWith('/get_shared_wishlist')) {
      const state = lists[0]
      await route.fulfill({ headers, json: { list: { ...state, id, emoji: '🌿', description: 'Geschenkideen für meine Lieblingsmenschen.', created_at: new Date().toISOString() }, can_purchase: true, items: [{ id: '00000000-0000-4000-8000-000000000002', wishlist_id: id, title: 'Eine besondere Espressokanne', notes: 'Bitte das kleine Modell in Silber.', image_url: '', price: 39.9, url: 'https://shop.example/product', fulfilled: false, purchased: false, created_at: new Date().toISOString() }] } }); return
    }
    await route.fulfill({ headers, json: [] })
  })
}
async function audit(page: Page) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

test('public birthday list uses subtle rose accents with readable compact mobile controls', async ({ page }, info) => {
  if (info.project.name === 'auth-webkit') await page.setViewportSize({ width: 320, height: 650 })
  await fixture(page, [{ title: 'Zum 30. GEBURTSTAG', visibility: 'public' }])
  await page.goto('/#/p/' + id)
  await expect(page.getByRole('heading', { name: 'Zum 30. GEBURTSTAG', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-occasion', 'birthday')
  await expect(page.locator('.list-cover svg')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Zum Shop', exact: true })).toBeVisible()
  const card = await page.getByRole('article').boundingBox()
  const button = await page.getByRole('button', { name: 'Als gekauft markieren', exact: true }).boundingBox()
  expect(button!.width).toBeGreaterThan(card!.width * 0.75)
  expect(button!.height).toBeLessThanOrEqual(50)
  await audit(page)
  await page.screenshot({ path: info.outputPath('birthday-list.png'), fullPage: true })
})

test('shared Christmas list and the gift popup share the pine and gold palette', async ({ page }, info) => {
  await fixture(page, [{ title: 'Fuchsbau Weihnachtswünsche', visibility: 'link' }])
  await page.goto('/#/s/' + token)
  await expect(page.getByRole('heading', { name: 'Fuchsbau Weihnachtswünsche', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-occasion', 'christmas')
  await expect(page.locator('.christmas-atmosphere')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('.christmas-header-art')).toBeVisible()
  await expect(page.locator('.christmas-nav-lights')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('.christmas-nav-lights .christmas-light').first()).toHaveCSS('animation-name', 'none')
  expect(await page.locator('.christmas-atmosphere').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none')
  if (info.project.name === 'auth-webkit') {
    const header = await page.locator('.sidebar').boundingBox(), nav = await page.locator('.topbar .mobile-list-trigger').boundingBox()
    expect(nav!.y).toBeGreaterThanOrEqual(header!.y)
    expect(nav!.y + nav!.height).toBeLessThanOrEqual(header!.y + header!.height)
  }
  await audit(page)
  await page.screenshot({ path: info.outputPath('christmas-list.png'), fullPage: true })
  await page.getByRole('link', { name: 'Zum Shop', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('link', { name: 'Zum Shop', exact: true })).toBeVisible()
  // Opening the dialog can place its action under the existing mouse cursor.
  // Check the base palette in a deterministic non-hover state.
  await page.mouse.move(0, 0)
  await expect(dialog.getByRole('link', { name: 'Zum Shop', exact: true })).toHaveCSS('background-color', 'rgb(219, 184, 110)')
  await audit(page)
  await dialog.screenshot({ path: info.outputPath('christmas-gift-dialog.png') })
  if (info.project.name === 'auth-webkit') {
    await dialog.getByRole('button', { name: 'Zurück zur Liste', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await page.setViewportSize({ width: 320, height: 650 })
    await audit(page)
    const header = await page.locator('.sidebar').boundingBox(), nav = await page.locator('.topbar .mobile-list-trigger').boundingBox()
    expect(nav!.y + nav!.height).toBeLessThanOrEqual(header!.y + header!.height)
    await page.screenshot({ path: info.outputPath('christmas-list-narrow.png'), fullPage: true })
  }
})

test('ordinary and private lists stay neutral and changing the open list clears occasion colors', async ({ page }) => {
  const lists: List[] = [{ title: 'Geburtstagswünsche für Alex', visibility: 'link' }]
  await fixture(page, lists)
  await page.goto('/#/s/' + token)
  await expect(page.locator('html')).toHaveAttribute('data-occasion', 'birthday')
  lists[0] = { title: 'Kleine & große Wünsche', visibility: 'public' }
  await page.goto('/#/p/' + id)
  await expect(page.getByRole('heading', { name: 'Kleine & große Wünsche', exact: true })).toBeVisible()
  await expect(page.locator('html')).not.toHaveAttribute('data-occasion')
  await expect(page.locator('.christmas-atmosphere')).toHaveCount(0)
  // Direct guest access to private lists is forbidden in production; this
  // fixture verifies presentation gating independently of backend permissions.
  lists[0] = { title: 'Für Weihnachten', visibility: 'private' }
  await page.goto('/#/s/' + token)
  await expect(page.getByRole('heading', { name: 'Für Weihnachten', exact: true })).toBeVisible()
  await expect(page.locator('html')).not.toHaveAttribute('data-occasion')
  await expect(page.locator('.christmas-atmosphere')).toHaveCount(0)
  lists[0] = { title: 'Geburtstag & Weihnachten', visibility: 'link' }
  await page.goto('/#/p/' + id)
  await expect(page.getByRole('heading', { name: 'Geburtstag & Weihnachten', exact: true })).toBeVisible()
  await expect(page.locator('html')).not.toHaveAttribute('data-occasion')
  await expect(page.locator('.christmas-atmosphere')).toHaveCount(0)
})
