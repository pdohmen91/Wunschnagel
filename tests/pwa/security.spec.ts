import { expect, test } from '@playwright/test'

test('production CSP blocks inline script, inline handlers and base URL injection', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: /Deine Wünsche/ })).toBeVisible()
  const result = await page.evaluate(async () => {
    const script = document.createElement('script'); script.textContent = 'window.securityInjected = true'; document.head.append(script)
    const button = document.createElement('button'); button.setAttribute('onclick', 'window.securityInjected = true'); document.body.append(button); button.click()
    const base = document.createElement('base'); base.href = 'https://attacker.invalid/'; document.head.append(base)
    await new Promise(resolve => setTimeout(resolve, 50))
    return { injected: 'securityInjected' in window, origin: new URL(document.baseURI).origin }
  })
  expect(result.injected).toBe(false)
  expect(result.origin).toBe('http://127.0.0.1:4182')
})

test('framed app does not mount wishlist or account controls', async ({ page, baseURL }) => {
  const parent = new URL('__security-parent', baseURL).href
  await page.route(parent, route => route.fulfill({ contentType: 'text/html', body: `<iframe title="Untrusted frame" src="${baseURL}"></iframe>` }))
  await page.goto(parent)
  const frame = page.frameLocator('iframe')
  await expect(frame.getByRole('link', { name: 'Wunschnagel öffnen', exact: true })).toBeVisible()
  await expect(frame.getByRole('button', { name: 'Wunsch hinzufügen', exact: true })).toHaveCount(0)
  await expect(frame.getByRole('article')).toHaveCount(0)
})
