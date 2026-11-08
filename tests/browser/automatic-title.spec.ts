import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).click()
})

test('automatically loads title and image from a pasted link and saves the wish', async ({ page }) => {
  await page.route('**/__api/link-preview', route => route.fulfill({ json: { title: 'Automatisch geladener Produkttitel', image_url: 'https://www.thalia.de/bild.png', description: '' } }))
  await page.route('https://www.thalia.de/bild.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>' }))
  await page.getByRole('textbox', { name: 'Link zum Wunsch' }).fill('www.thalia.de/produkt')
  await expect(page.getByRole('textbox', { name: 'Dein Wunsch', exact: true })).toHaveValue('Automatisch geladener Produkttitel')
  await page.getByText('Preis & Bild-Link ergänzen', { exact: false }).click()
  await expect(page.getByRole('textbox', { name: 'Bild-Link' })).toHaveValue('https://www.thalia.de/bild.png')
  await page.getByRole('button', { name: 'Wunsch speichern' }).click()
  await expect(page.getByRole('article').filter({ hasText: 'Automatisch geladener Produkttitel' })).toBeVisible()
})

test('editing a saved wish without an image retries the preview and preserves its title', async ({ page }) => {
  let calls = 0
  await page.route('**/__api/link-preview', route => route.fulfill({ json: { title: 'Titel aus dem Shop', image_url: ++calls === 1 ? '' : 'https://www.thalia.de/recovered.png', description: '' } }))
  await page.route('https://www.thalia.de/recovered.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="orange"/></svg>' }))
  await page.getByRole('textbox', { name: 'Link zum Wunsch' }).fill('https://www.thalia.de/produkt')
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('kein verwendbares Bild')
  await page.getByRole('textbox', { name: 'Dein Wunsch', exact: true }).fill('Mein persönlicher Wunschtitel')
  await page.getByRole('button', { name: 'Wunsch speichern' }).click()
  const card = page.getByRole('article').filter({ hasText: 'Mein persönlicher Wunschtitel' })
  await card.locator('summary').click()
  await card.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  const image = page.getByRole('img', { name: 'Bildvorschau zum Wunsch', exact: true })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(page.getByRole('textbox', { name: 'Dein Wunsch', exact: true })).toHaveValue('Mein persönlicher Wunschtitel')
  await page.getByRole('button', { name: 'Wunsch speichern' }).click()
  await expect(card.getByRole('img', { name: 'Mein persönlicher Wunschtitel', exact: true })).toBeVisible()
  await page.reload()
  await expect(card.getByRole('img', { name: 'Mein persönlicher Wunschtitel', exact: true })).toBeVisible()
  expect(calls).toBe(2)
})

test('keeps a manually entered title and leaves other fields editable while loading', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/__api/link-preview', async route => {
    await pending
    await route.fulfill({ json: { title: 'Titel vom Shop', image_url: '', description: '' } })
  })
  await page.getByRole('textbox', { name: 'Link zum Wunsch' }).fill('https://www.thalia.de/produkt')
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('werden aus dem Shop geladen')
  await page.getByRole('textbox', { name: 'Dein Wunsch', exact: true }).fill('Mein eigener Titel')
  await page.getByRole('textbox', { name: 'Notizen & Hinweise' }).fill('Während des Abrufs bearbeitet')
  release()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Titel geladen')
  await expect(page.getByRole('textbox', { name: 'Dein Wunsch', exact: true })).toHaveValue('Mein eigener Titel')
  await expect(page.getByRole('textbox', { name: 'Notizen & Hinweise' })).toHaveValue('Während des Abrufs bearbeitet')
})

test('a late response for a previous link cannot replace the current title', async ({ page }) => {
  let release!: () => void
  let handled!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const finished = new Promise<void>(resolve => { handled = resolve })
  await page.route('**/__api/link-preview', async route => {
    const { url } = route.request().postDataJSON()
    if (url.endsWith('/alt')) {
      await pending
      await route.fulfill({ json: { title: 'Veralteter Titel', image_url: '', description: '' } }).catch(() => {})
      handled()
    } else await route.fulfill({ json: { title: 'Aktueller Titel', image_url: '', description: '' } })
  })
  const link = page.getByRole('textbox', { name: 'Link zum Wunsch' })
  await link.fill('https://www.thalia.de/alt')
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('werden aus dem Shop geladen')
  await link.fill('https://www.thalia.de/neu')
  await expect(page.getByRole('textbox', { name: 'Dein Wunsch', exact: true })).toHaveValue('Aktueller Titel')
  release()
  await finished
  await expect(page.getByRole('textbox', { name: 'Dein Wunsch', exact: true })).toHaveValue('Aktueller Titel')
})

test('failed lookups allow manual entry and the unfinished request can be cancelled', async ({ page }) => {
  await page.route('**/__api/link-preview', route => route.fulfill({ status: 422, json: { error: 'Bitte gib den Titel manuell ein.' } }))
  await page.getByRole('textbox', { name: 'Link zum Wunsch' }).fill('https://www.thalia.de/blockiert')
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('manuell')
  await page.getByRole('textbox', { name: 'Dein Wunsch', exact: true }).fill('Manueller Wunsch')
  await page.getByRole('button', { name: 'Wunsch speichern' }).click()
  await expect(page.getByRole('article').filter({ hasText: 'Manueller Wunsch' })).toBeVisible()
  await page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).click()
  let release!: () => void
  let handled!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const finished = new Promise<void>(resolve => { handled = resolve })
  await page.route('**/__api/link-preview', async route => {
    await pending
    await route.fulfill({ json: { title: 'Nicht mehr benötigt', image_url: '', description: '' } }).catch(() => {})
    handled()
  })
  await page.getByRole('textbox', { name: 'Link zum Wunsch' }).fill('https://www.thalia.de/anderer-link')
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('werden aus dem Shop geladen')
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  release()
  await finished
})
