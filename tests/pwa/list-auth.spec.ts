import { expect, test } from '@playwright/test'

test('production refuses local list creation even with the fixture build flag, old demo data and a demo URL', async ({ page }) => {
  const legacy = JSON.stringify({ lists: [{ id: 'old', title: 'VERTRAULICHE ALTE DEMOLISTE', emoji: '🎁', owner_id: 'demo', visibility: 'private' }], items: [] })
  await page.addInitScript(value => localStorage.setItem('herzenswuensche-demo-v1', value), legacy)
  await page.goto('./?demo=true#/demo')
  await expect(page.getByRole('heading', { name: /Deine Wünsche/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mit Google anmelden', exact: true })).toBeDisabled()
  await expect(page.getByRole('status')).toContainText('Die Anmeldung ist hier noch nicht verfügbar.')
  await expect(page.getByRole('button', { name: /ausprobieren|Neue Wunschliste|Wunschliste erstellen|Wunsch hinzufügen/ })).toHaveCount(0)
  await expect(page.getByText('VERTRAULICHE ALTE DEMOLISTE', { exact: true })).toHaveCount(0)
  await expect(page.locator('.list-view, .demo-banner, .compact-demo')).toHaveCount(0)
  // Retired personal demo data is left untouched, never silently uploaded.
  expect(await page.evaluate(() => localStorage.getItem('herzenswuensche-demo-v1'))).toBe(legacy)
})
