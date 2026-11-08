import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export async function compactUI(page: Page) {
  // Resize events and the root's ResizeObserver settle after setViewportSize.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  return page.evaluate(() => (document.getElementById('root')?.clientWidth ?? innerWidth) <= 960)
}

export async function prepareNewList(page: Page): Promise<{ opener: Locator; returnTarget: Locator }> {
  if (await compactUI(page)) {
    const returnTarget = page.getByRole('button', { name: 'Listen', exact: true })
    await returnTarget.click()
    return { opener: page.getByRole('dialog').getByRole('button', { name: 'Neue Wunschliste', exact: true }), returnTarget }
  }
  const opener = page.getByRole('button', { name: 'Neue Wunschliste', exact: true })
  return { opener, returnTarget: opener }
}

export async function openNewList(page: Page) {
  const { opener } = await prepareNewList(page)
  await opener.click()
  await expect(page.getByRole('textbox', { name: 'Name deiner Liste' })).toBeVisible()
}

export async function chooseList(page: Page, title: string) {
  if (await compactUI(page)) {
    await page.getByRole('button', { name: 'Listen', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(title) }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  } else await page.getByRole('navigation', { name: 'Wunschlisten', exact: true }).getByRole('button', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
}

export async function openTools(page: Page) {
  if (await compactUI(page)) {
    await page.getByRole('button', { name: 'Suchen und sortieren', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Suchen & sortieren' })).toBeVisible()
    return true
  }
  return false
}

export async function searchWishes(page: Page, value: string) {
  const compact = await openTools(page)
  await page.getByRole('textbox', { name: 'Wünsche durchsuchen' }).fill(value)
  if (compact) {
    await page.getByRole('button', { name: 'Ergebnisse anzeigen' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
}

export async function sortWishesUI(page: Page, value: string) {
  const compact = await openTools(page)
  await page.getByRole('combobox', { name: 'Wünsche sortieren' }).selectOption(value)
  if (compact) {
    await page.getByRole('button', { name: 'Ergebnisse anzeigen' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
}

export async function openHelp(page: Page) {
  const trigger = await compactUI(page) ? page.getByRole('button', { name: 'Details & Hilfe', exact: true }) : page.getByRole('button', { name: 'So funktioniert’s', exact: true })
  await trigger.click()
  if (await compactUI(page)) await page.getByRole('dialog').getByRole('button', { name: 'So funktioniert’s', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'So funktioniert’s', exact: true })).toBeVisible()
  return trigger
}
