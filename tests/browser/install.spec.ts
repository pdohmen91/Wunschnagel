import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('installation is named and visible immediately, and remains in the menu after dismissal', async ({ page }) => {
  await page.goto('/')
  const prompt = page.getByRole('region', { name: 'Wunschnagel als App nutzen' })
  const install = prompt.getByRole('button', { name: 'App installieren', exact: true })
  await expect(install).toBeInViewport()
  await expect(install.locator('span')).toHaveText('App installieren')
  await install.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'App auf dem Handy installieren' })).toBeVisible()
  await expect(dialog).toContainText('Zum Home-Bildschirm')
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click()
  await prompt.getByRole('button', { name: 'Installationshinweis schließen' }).click()
  await expect(prompt).toHaveCount(0)
  await page.reload()
  await expect(prompt).toHaveCount(0)
  await page.getByRole('button', { name: 'Listen', exact: true }).click()
  const menuInstall = page.getByRole('dialog').getByRole('button', { name: 'App installieren', exact: true })
  await expect(menuInstall).toBeInViewport()
  await menuInstall.click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'App auf dem Handy installieren' })).toBeVisible()
})

test('an installed iPhone app has no installation prompt', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kleine & große Wünsche', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Wunschnagel als App nutzen' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Listen', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'App installieren', exact: true })).toHaveCount(0)
})

test('completing installation hides the prompt including after a reload', async ({ page }) => {
  await page.goto('/')
  const prompt = page.getByRole('region', { name: 'Wunschnagel als App nutzen' })
  await expect(prompt).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await expect(prompt).toHaveCount(0)
  await page.reload()
  await expect(prompt).toHaveCount(0)
})
