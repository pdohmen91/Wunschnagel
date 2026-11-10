import { expect, test } from '@playwright/test'
import { compactUI } from './ui'

const examples = [
  { name: 'Hochformat', path: 'portrait', width: 240, height: 960, transparent: false },
  { name: 'Querformat', path: 'landscape', width: 1200, height: 300, transparent: false },
  { name: 'Quadratisch', path: 'square', width: 600, height: 600, transparent: false },
  { name: 'Transparent', path: 'transparent', width: 360, height: 600, transparent: true },
  { name: 'Kleines Bild', path: 'small', width: 90, height: 90, transparent: false },
  { name: 'Nicht erreichbar', path: 'broken', width: 0, height: 0, transparent: false },
]

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(examples => {
    const created_at = new Date().toISOString()
    const list = { id: '00000000-0000-4000-8000-000000000081', owner_id: 'demo', title: 'Bildformate', description: '', emoji: '📷', visibility: 'link', share_token: 'a'.repeat(64), created_at }
    const items = examples.map((example, index) => ({ id: `00000000-0000-4000-8000-${String(82 + index).padStart(12, '0')}`, wishlist_id: list.id, title: example.name, url: 'https://shop.example/' + example.path, image_url: 'https://images.example/' + example.path + '.svg', notes: '', price: null, fulfilled: false, offer_source: 'none', created_at }))
    localStorage.setItem('herzenswuensche-demo-v1', JSON.stringify({ lists: [list], items }))
  }, examples)
  await page.route('https://images.example/**', async route => {
    const example = examples.find(value => route.request().url().endsWith('/' + value.path + '.svg'))!
    if (!example.width) { await route.fulfill({ status: 404, body: 'Missing fixture' }); return }
    const { width, height } = example
    // Edge markers expose clipping; unequal dimensions expose distorted images.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${example.transparent ? '' : '<rect width="100%" height="100%" fill="white"/>'}<rect x="8" y="8" width="${width - 16}" height="${height - 16}" rx="12" fill="#dbe6d8" stroke="#285344" stroke-width="6"/><path d="M12 12 L${width - 12} ${height - 12} M${width - 12} 12 L12 ${height - 12}" stroke="#ba7540" stroke-width="5"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 5}" fill="#285344"/></svg>`
    await route.fulfill({ contentType: 'image/svg+xml', body: svg })
  })
  await page.goto('/')
})

test('portrait, landscape, square and transparent images fit their card without editing controls covering them', async ({ page }, info) => {
  const frameHeights: number[] = []
  for (const example of examples.filter(value => value.width)) {
    const card = page.getByRole('article').filter({ hasText: example.name })
    const image = card.getByRole('img', { name: example.name, exact: true })
    await image.scrollIntoViewIfNeeded()
    await expect(image).toHaveJSProperty('complete', true)
    await expect(image).toHaveJSProperty('naturalWidth', example.width)
    await expect(image).toHaveJSProperty('naturalHeight', example.height)
    const layout = await image.evaluate(node => {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect(), frame = node.closest('.wish-image')!.getBoundingClientRect()
      return { fit: style.objectFit, width: rect.width, height: rect.height, frameWidth: frame.width, frameHeight: frame.height, background: getComputedStyle(node.closest('a')!).backgroundColor }
    })
    expect(layout.fit).toBe('contain')
    expect(layout.width).toBeLessThanOrEqual(layout.frameWidth + 1)
    expect(layout.height).toBeLessThanOrEqual(layout.frameHeight + 1)
    expect(layout.background).toBe('rgb(255, 255, 255)')
    frameHeights.push(layout.frameHeight)
    if (!await compactUI(page) || page.viewportSize()!.width > 620) {
      expect(layout.frameHeight).toBeGreaterThan(200)
      const frame = await card.locator('.wish-image').boundingBox(), edit = await card.locator('.card-menu summary').boundingBox()
      expect(edit!.y).toBeGreaterThanOrEqual(frame!.y + frame!.height)
    }
  }
  expect(Math.max(...frameHeights) - Math.min(...frameHeights)).toBeLessThanOrEqual(1)
  const broken = page.getByRole('article').filter({ hasText: 'Nicht erreichbar' })
  await broken.locator('.wish-image').scrollIntoViewIfNeeded()
  await expect(broken.locator('.image-placeholder')).toContainText('Bild nicht erreichbar')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('card-image-formats.png'), fullPage: true })
})

test('editing an image card still opens the correct wish', async ({ page }) => {
  const card = page.getByRole('article').filter({ hasText: 'Hochformat' })
  await card.locator('summary').click()
  await card.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Wunsch bearbeiten', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Dein Wunsch', exact: true })).toHaveValue('Hochformat')
})
