import { expect, test } from '@playwright/test'

for (const width of [1200, 390]) {
  test(`open card menu stays above adjacent cards at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    await expect(page.getByRole('article')).toHaveCount(3)
    await page.evaluate(() => {
      const key = 'herzenswuensche-demo-v1'
      const data = JSON.parse(localStorage.getItem(key)!)
      // Short cards put the lower menu actions over the next row, as in production.
      data.items = [...data.items, ...data.items.map((item: { id: string }) => ({ ...item, id: crypto.randomUUID() }))]
        .map((item: object, index: number) => ({ ...item, notes: '', fulfilled: index === 0 }))
      localStorage.setItem(key, JSON.stringify(data))
    })
    await page.reload()
    const cards = page.getByRole('article')
    await expect(cards).toHaveCount(6)
    // Compact menus open upward over the preceding card; desktop menus open downward.
    const card = cards.nth(width > 620 ? 0 : 1)
    const summary = card.locator('summary')
    await summary.click()
    const menu = card.locator('.card-menu')
    await expect(menu).toHaveAttribute('open', '')
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0)
    for (const button of await menu.getByRole('button').all()) {
      await button.scrollIntoViewIfNeeded()
      expect(await button.evaluate(node => {
        const rect = node.getBoundingClientRect()
        return [0.2, 0.5, 0.8].every(fraction => {
          const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height * fraction)
          return top !== null && node.contains(top)
        })
      }), `${await button.textContent()} must be visible and clickable`).toBe(true)
    }
    await page.screenshot({ path: info.outputPath('open-card-menu.png') })
    await menu.getByRole('button', { name: 'Löschen', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Behalten', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(summary).toBeFocused()
    await summary.click()
    await summary.press('Escape')
    await expect(menu).not.toHaveAttribute('open', '')
  })
}
