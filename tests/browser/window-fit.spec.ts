import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'

async function withinVisibleWidth(target: Locator, width: number) {
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width)
}

test('reproduces the reported oversized window and keeps the full interface inside its visible area', async ({ page }, info) => {
  await page.setViewportSize({ width: 2190, height: 1235 })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'outerWidth', { configurable: true, value: 2560 })
    Object.defineProperty(window, 'screenX', { configurable: true, value: 0 })
    Object.defineProperty(window.screen, 'availWidth', { configurable: true, value: 2056 })
    Object.defineProperty(window.screen, 'availLeft', { configurable: true, value: 0 })
  })
  await page.goto('/')
  await expect(page.locator('#root')).toHaveCSS('width', '1686px')
  await page.getByRole('button', { name: /Für Weihnachten/ }).click()
  await expect(page.getByRole('heading', { name: 'Noch keine Wünsche' })).toBeVisible()
  for (const target of [
    page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }),
    page.getByRole('button', { name: 'Liste teilen', exact: true }),
    page.getByRole('button', { name: 'Ersten Wunsch hinzufügen', exact: true }),
    page.getByRole('button', { name: 'App installieren', exact: true }),
  ]) await withinVisibleWidth(target, 1686)
  await page.evaluate(() => scrollTo(0, 0))
  await page.screenshot({ path: `test-results/${info.project.name}-actual-visible-window.png`, clip: { x: 0, y: 0, width: 1686, height: 1235 } })
  await page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).click()
  await withinVisibleWidth(page.getByRole('dialog'), 1686)
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
  await page.getByRole('button', { name: 'Liste teilen', exact: true }).click()
  await withinVisibleWidth(page.getByRole('dialog'), 1686)
})

test('responsive layout follows the visible app area rather than the oversized host viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'outerWidth', { configurable: true, value: 1650 })
    Object.defineProperty(window, 'screenX', { configurable: true, value: 0 })
    Object.defineProperty(window.screen, 'availWidth', { configurable: true, value: 870 })
    Object.defineProperty(window.screen, 'availLeft', { configurable: true, value: 0 })
  })
  await page.goto('/')
  await expect(page.locator('#root')).toHaveCSS('width', '500px')
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeVisible()
  await withinVisibleWidth(page.getByRole('button', { name: 'Listen', exact: true }), 500)
  await withinVisibleWidth(page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }), 500)
  await page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).click()
  await withinVisibleWidth(page.getByRole('dialog'), 500)
  await withinVisibleWidth(page.getByRole('button', { name: 'Wunsch speichern', exact: true }), 500)
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
  await page.getByRole('button', { name: 'Liste teilen', exact: true }).click()
  await withinVisibleWidth(page.getByRole('dialog'), 500)
  await page.getByRole('button', { name: 'Zurück zur Liste' }).click()
  await page.evaluate(() => {
    Object.defineProperty(window, 'outerWidth', { configurable: true, value: 1280 })
    Object.defineProperty(window.screen, 'availWidth', { configurable: true, value: 2056 })
    dispatchEvent(new Event('resize'))
  })
  await expect(page.locator('#root')).toHaveCSS('width', '1280px')
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toHaveCount(0)
})
