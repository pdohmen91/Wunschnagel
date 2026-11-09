import { expect, test } from '@playwright/test'

test('an invitation never falls through to editable demo lists when the backend is not configured', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/invite/' + 'a'.repeat(64))
  await expect(page.getByRole('heading', { name: 'Einladung zur Wunschliste', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Einladungen benötigen die Online-Version.')
  await expect(page.getByRole('article')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Einladung annehmen', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Zu meinen Listen', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(3)
})
