import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { compactUI, prepareNewList, chooseList } from './ui'

// Contrast is measured after entry transitions; input stays live during motion.
async function settleEntry(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
    const animations = dialog ? dialog.getAnimations({ subtree: true }) : document.getAnimations()
    return animations.filter(animation => {
      const target = (animation.effect as KeyframeEffect | null)?.target
      return target instanceof Element && target.checkVisibility() && animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity
    }).length
  })).toBe(0)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kleine & große Wünsche' })).toBeVisible()
})

test('overview has readable contrast and comfortably sized controls', async ({ page }, info) => {
  await settleEntry(page)
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  await info.attach('accessibility-overview', { body: JSON.stringify(audit.violations, null, 2), contentType: 'application/json' })
  expect(audit.violations).toEqual([])
  for (const target of [
    page.getByRole('button', { name: await compactUI(page) ? 'Listen' : 'Neue Wunschliste', exact: true }),
    page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }),
    page.getByRole('button', { name: 'Liste teilen', exact: true }),
    page.getByRole('button', { name: 'Liste bearbeiten', exact: true }),
    page.getByRole('button', { name: 'Offen', exact: true }),
    ...(await compactUI(page) ? [] : [page.getByRole('button', { name: 'App installieren', exact: true })]),
    await compactUI(page) ? page.getByRole('button', { name: 'Suchen und sortieren', exact: true }) : page.getByRole('combobox', { name: 'Wünsche sortieren', exact: true }),
    page.locator('.card-menu summary').first(),
    page.getByRole('link', { name: 'Zum Shop', exact: true }).first(),
  ]) {
    const box = await target.boundingBox()
    expect(box?.height, await target.textContent() || 'icon').toBeGreaterThanOrEqual(44)
    expect(box?.width).toBeGreaterThanOrEqual(44)
  }
  const picker = page.getByRole('combobox', { name: 'Wunschliste auswählen' })
  if (await picker.isVisible()) expect((await picker.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/${info.project.name}-viewport.png` })
})

test('forms support keyboard navigation, restore focus and avoid misleading warnings', async ({ page }) => {
  const { opener, returnTarget } = await prepareNewList(page)
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(page.getByRole('textbox', { name: 'Name deiner Liste' })).toBeFocused()
  await expect(dialog.getByText('Bestehende Freigabelinks', { exact: false })).toHaveCount(0)
  await settleEntry(page)
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations).toEqual([])
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
  }
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Abbrechen', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(returnTarget).toBeFocused()
})

test('product entry accepts a pasted link without protocol and long notes remain readable', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).click()
  await settleEntry(page)
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations).toEqual([])
  const link = page.getByRole('textbox', { name: 'Link zum Wunsch' })
  expect(await link.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16)
  await link.fill('shop.de/lieblingswunsch')
  await page.getByRole('textbox', { name: 'Dein Wunsch', exact: true }).fill('Ein Wunsch mit wichtigen Hinweisen')
  const notes = 'Bitte die richtige Größe auswählen. '.repeat(18) + 'Wichtig: Größe 42, Farbe Grün.'
  await page.getByRole('textbox', { name: 'Notizen & Hinweise' }).fill(notes)
  const save = page.getByRole('button', { name: 'Wunsch speichern', exact: true })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport()
  await page.getByRole('dialog').screenshot({ path: `test-results/${info.project.name}-wish-dialog.png` })
  await save.click()
  const card = page.getByRole('article').filter({ hasText: 'Ein Wunsch mit wichtigen Hinweisen' })
  await expect(card.getByRole('link', { name: 'Zum Shop', exact: true })).toHaveAttribute('href', 'https://shop.de/lieblingswunsch')
  const readMore = card.getByRole('button', { name: 'Alle Hinweise lesen' })
  await expect(readMore).toBeVisible()
  await readMore.click()
  await expect(card.locator('.wish-notes')).toHaveText(notes)
  await expect.poll(() => card.locator('.wish-notes').evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
  await card.getByRole('button', { name: 'Weniger anzeigen' }).click()
  await expect(readMore).toBeVisible()
})

test('card menus close with Escape and when tapping outside', async ({ page }) => {
  const menu = page.locator('.card-menu').first()
  const trigger = menu.locator('summary')
  await trigger.click()
  await expect(menu).toHaveAttribute('open', '')
  await trigger.press('Escape')
  await expect(menu).not.toHaveAttribute('open', '')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('heading', { name: 'Kleine & große Wünsche' }).click()
  await expect(menu).not.toHaveAttribute('open', '')
})

test('layout remains usable at small phone, tablet and zoom-equivalent widths', async ({ page }) => {
  for (const width of [320, 360, 430, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`).toBe(true)
    await expect(page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true })).toBeVisible()
    if (width <= 960) {
      await chooseList(page, 'Für Weihnachten')
      await chooseList(page, 'Kleine & große Wünsche')
    }
  }
})
