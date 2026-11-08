import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { chooseList, sortWishesUI, compactUI, openTools } from './ui'

async function reachable(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollX }))
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(viewport.scrollX).toBe(0)
  expect(await target.evaluate(node => {
    const rect = node.getBoundingClientRect()
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return top !== null && (top === node || node.contains(top))
  }), 'control must be unobstructed at its centre').toBe(true)
}

test('empty list and populated list keep each important action within the viewport', async ({ page }, info) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kleine & große Wünsche' })).toBeVisible()
  for (const width of [320, 390, 620, 768, 960, 1024, 1280, 1440, 1699, 1920, 2560]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 })
    await chooseList(page, 'Für Weihnachten')
    await expect(page.getByRole('heading', { name: 'Noch keine Wünsche' })).toBeVisible()
    for (const target of [
      page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }),
      page.getByRole('button', { name: 'Liste teilen', exact: true }),
      page.getByRole('button', { name: 'Liste bearbeiten', exact: true }),
      page.getByRole('button', { name: 'Ersten Wunsch hinzufügen', exact: true }),
    ]) await reachable(page, target)
    if (width === 1699) {
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: `test-results/${info.project.name}-wide-empty.png` })
    }
    await chooseList(page, 'Kleine & große Wünsche')
    await expect(page.getByRole('article')).toHaveCount(3)
    if (await compactUI(page)) {
      await reachable(page, page.getByRole('button', { name: 'Suchen und sortieren' }))
      await openTools(page)
      await reachable(page, page.getByRole('textbox', { name: 'Wünsche durchsuchen' }))
      await reachable(page, page.getByRole('combobox', { name: 'Wünsche sortieren' }))
      await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    } else {
      await reachable(page, page.getByRole('textbox', { name: 'Wünsche durchsuchen' }))
      await reachable(page, page.getByRole('combobox', { name: 'Wünsche sortieren' }))
    }
    await reachable(page, page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflow at ${width}px`).toBe(true)
    const menu = page.locator('.card-menu').last()
    await menu.locator('summary').click()
    await reachable(page, menu.getByRole('button', { name: 'Bearbeiten', exact: true }))
    await reachable(page, menu.getByRole('button', { name: 'Löschen', exact: true }))
    await menu.locator('summary').press('Escape')
  }
})

test('sorting works and an empty filter can be reset', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(3)
  await sortWishesUI(page, 'price-asc')
  await expect(page.getByRole('article').first()).toContainText('22,00')
  await sortWishesUI(page, 'price-desc')
  await expect(page.getByRole('article').first()).toContainText('99,00')
  await page.getByRole('button', { name: 'Erfüllt', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Keine Wünsche in diesem Filter' })).toBeVisible()
  await page.getByRole('button', { name: 'Filter zurücksetzen', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(3)
})

test('long content and optional fields stay reachable in a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).click()
  await page.getByRole('textbox', { name: 'Link zum Wunsch' }).fill('shop.de/produkt')
  await page.getByRole('textbox', { name: 'Dein Wunsch', exact: true }).fill('Ein besonders langer Wunsch mit mehreren Worten für einen konkreten Anlass'.repeat(2))
  await page.getByText('Preis & Bild-Link ergänzen', { exact: false }).click()
  const price = page.getByRole('textbox', { name: 'Preis in €' })
  await reachable(page, price)
  await price.fill('12,50')
  const image = page.getByRole('textbox', { name: 'Bild-Link' })
  await reachable(page, image)
  await reachable(page, page.getByRole('button', { name: 'Wunsch speichern' }))
  await page.getByRole('button', { name: 'Wunsch speichern' }).click()
  await expect(page.getByRole('article')).toHaveCount(4)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
