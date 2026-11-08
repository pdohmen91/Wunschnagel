import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { openNewList } from './ui'

test.beforeEach(async ({ page }, info) => {
  test.skip(!['mobile', 'webkit-mobile'].includes(info.project.name), 'Phone interaction checks run with Android Chrome and iPhone WebKit.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

async function unobstructed(target: Locator, top: number, bottom: number) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(top - 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(bottom + 1)
  expect(await target.evaluate(node => {
    const rect = node.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return hit !== null && (hit === node || node.contains(hit))
  })).toBe(true)
}

test('primary actions remain reachable while scrolling and leave the last wish unobstructed', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const actions = page.getByRole('navigation', { name: 'Aktionen für die Wunschliste' })
  await expect(actions).toBeVisible()
  for (const button of await actions.getByRole('button').all()) {
    const box = await button.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(48)
    await unobstructed(button, 0, 844)
  }
  await expect.poll(async () => (await page.getByRole('article').first().boundingBox())!.y).toBeLessThan(360)
  const secondWish = await page.getByRole('article').nth(1).boundingBox()
  expect(secondWish!.y + secondWish!.height, 'two complete wishes should fit above the mobile action bar').toBeLessThanOrEqual((await actions.boundingBox())!.y)
  await page.screenshot({ path: `test-results/${info.project.name}-phone-start.png` })
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
  await unobstructed(page.getByRole('article').last().getByRole('link', { name: 'Zum Shop', exact: true }), 0, (await actions.boundingBox())!.y)
  await actions.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).tap()
  await expect(page.getByRole('textbox', { name: 'Link zum Wunsch' })).toBeFocused()
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).tap()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await actions.getByRole('button', { name: 'Liste teilen' }).tap()
  await expect(page.getByRole('dialog')).toContainText('lokalen Demo')
})

test('forms stay inside a keyboard-sized visual viewport and can still be saved', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    class KeyboardViewport extends EventTarget {
      height = innerHeight
      offsetTop = 0
      scale = 1
      set(height: number, top = 0) { this.height = height; this.offsetTop = top; this.dispatchEvent(new Event('resize')) }
    }
    const viewport = new KeyboardViewport()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    Object.assign(window, { keyboardViewport: viewport })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).tap()
  const dialog = page.getByRole('dialog')
  await page.getByRole('textbox', { name: 'Link zum Wunsch' }).fill('shop.de/mobil')
  await page.getByRole('textbox', { name: 'Dein Wunsch', exact: true }).fill('Mein mobiler Wunsch')
  await page.evaluate(() => (window as unknown as { keyboardViewport: { set: (height: number, top?: number) => void } }).keyboardViewport.set(344, 24))
  await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', 'true')
  const save = dialog.getByRole('button', { name: 'Wunsch speichern' })
  await expect.poll(async () => (await dialog.boundingBox())!.y).toBeGreaterThanOrEqual(24)
  await unobstructed(save, 24, 368)
  const title = dialog.getByRole('textbox', { name: 'Dein Wunsch', exact: true })
  await title.scrollIntoViewIfNeeded()
  await unobstructed(title, 24, 368)
  await title.fill('Auch mit Tastatur gespeichert')
  await dialog.screenshot({ path: `test-results/${info.project.name}-phone-keyboard.png` })
  await save.tap()
  await expect(dialog).toHaveCount(0)
  await page.evaluate(() => (window as unknown as { keyboardViewport: { set: (height: number) => void } }).keyboardViewport.set(innerHeight))
  await expect(page.getByRole('navigation', { name: 'Aktionen für die Wunschliste' })).toBeVisible()
  await expect(page.getByRole('article').filter({ hasText: 'Auch mit Tastatur gespeichert' })).toBeVisible()
  await openNewList(page)
  await page.evaluate(() => (window as unknown as { keyboardViewport: { set: (height: number) => void } }).keyboardViewport.set(304))
  const name = page.getByRole('textbox', { name: 'Name deiner Liste' })
  await name.scrollIntoViewIfNeeded()
  await name.fill('Mobil angelegte Liste')
  const create = page.getByRole('button', { name: 'Liste erstellen' })
  await unobstructed(create, 0, 304)
  await create.tap()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Mobil angelegte Liste', exact: true })).toBeVisible()
})

test('notch and home indicator insets are respected in portrait and landscape', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('html').evaluate(node => { node.style.setProperty('--safe-top', '47px'); node.style.setProperty('--safe-bottom', '34px') })
  const actions = page.getByRole('navigation', { name: 'Aktionen für die Wunschliste' })
  await unobstructed(actions.getByRole('button', { name: 'Wunsch hinzufügen' }), 0, 810)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.locator('html').evaluate(node => {
    node.style.setProperty('--safe-top', '0px'); node.style.setProperty('--safe-bottom', '21px')
    node.style.setProperty('--safe-left', '44px'); node.style.setProperty('--safe-right', '44px')
  })
  for (const button of await actions.getByRole('button').all()) {
    const box = await button.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(44)
    expect(box!.x + box!.width).toBeLessThanOrEqual(800)
    await unobstructed(button, 0, 369)
  }
  await actions.getByRole('button', { name: 'Wunsch hinzufügen' }).tap()
  const dialog = page.getByRole('dialog')
  await unobstructed(dialog.getByRole('button', { name: 'Abbrechen' }), 0, 369)
  await dialog.screenshot({ path: `test-results/${info.project.name}-phone-landscape.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('phone widths keep touch targets in bounds and notices clear of the action bar', async ({ page }) => {
  await page.goto('/')
  for (const [width, height] of [[320, 568], [360, 740], [390, 844], [412, 915], [430, 932]]) {
    await page.setViewportSize({ width, height })
    const actions = page.getByRole('navigation', { name: 'Aktionen für die Wunschliste' })
    await expect(actions).toBeVisible()
    for (const button of await actions.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      await unobstructed(button, 0, height)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await openNewList(page)
  await page.getByRole('textbox', { name: 'Name deiner Liste' }).fill('Hinweis über der Leiste')
  await page.getByRole('button', { name: 'Liste erstellen' }).tap()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const toast = page.locator('.toast')
  await expect(toast).toBeVisible()
  const actionBox = await page.getByRole('navigation', { name: 'Aktionen für die Wunschliste' }).boundingBox()
  const toastBox = await toast.boundingBox()
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(actionBox!.y)
})

test('the reported open-filter screen shows wishes before secondary controls', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  const first = page.getByRole('article').first()
  await first.locator('summary').tap()
  await first.getByRole('button', { name: 'Als erfüllt markieren' }).tap()
  await page.getByRole('button', { name: 'Offen', exact: true }).tap()
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.locator('.mobile-result-summary')).toContainText('2 von 3 Wünschen')
  await expect.poll(async () => (await page.getByRole('article').first().boundingBox())!.y).toBeLessThan(360)
  await expect(page.getByRole('textbox', { name: 'Wünsche durchsuchen' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Wünsche sortieren' })).toHaveCount(0)
  await page.screenshot({ path: `test-results/${info.project.name}-compact-open-filter.png` })
  for (const button of await page.getByRole('navigation', { name: 'Aktionen für die Wunschliste' }).getByRole('button').all()) {
    expect(await button.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    expect(await button.evaluate(node => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      const lines = new Set<number>()
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue
        const range = document.createRange(); range.selectNodeContents(walker.currentNode)
        for (const rect of range.getClientRects()) lines.add(Math.round(rect.top))
      }
      return lines.size
    })).toBe(1)
  }
  await page.getByRole('button', { name: 'Details & Hilfe' }).tap()
  await expect(page.getByRole('dialog')).toContainText('Das schönste Geschenk ist aber gemeinsame Zeit.')
  await page.getByRole('button', { name: 'Schließen', exact: true }).tap()
})

test('mobile search and sorting are readable, cancellable and applied explicitly', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  const open = page.getByRole('button', { name: 'Suchen und sortieren', exact: true })
  await open.tap()
  const dialog = page.getByRole('dialog')
  const search = dialog.getByRole('textbox', { name: 'Wünsche durchsuchen' })
  const sort = dialog.getByRole('combobox', { name: 'Wünsche sortieren' })
  expect((await sort.boundingBox())!.width).toBeGreaterThan(230)
  await search.fill('nur ein Entwurf')
  await sort.selectOption('price-desc')
  await dialog.getByRole('button', { name: 'Abbrechen' }).tap()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(3)
  await open.tap()
  await expect(search).toHaveValue('')
  await expect(sort).toHaveValue('added')
  await search.fill('Musik')
  await dialog.getByRole('button', { name: 'Ergebnisse anzeigen' }).tap()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article')).toContainText('Musik für unterwegs')
  await page.getByRole('button', { name: 'Alle Wünsche zeigen', exact: true }).tap()
  await expect(page.getByRole('article')).toHaveCount(3)
})
