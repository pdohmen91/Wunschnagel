import { expect, test } from '@playwright/test'

test('production build works under GitHub Pages subpath and opens offline after first installation', async ({ page, context }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Kleine & große Wünsche' })).toBeVisible()
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!
    return { url: link.href, body: await fetch(link.href).then(response => response.json()) }
  })
  expect(manifest.url).toContain('/Wishling/manifest.webmanifest')
  expect(manifest.body.name).toBe('Wishling')
  expect(manifest.body.short_name).toBe('Wishling')
  expect(manifest.body.display).toBe('standalone')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Kleine & große Wünsche' })).toBeVisible()
  await expect(page.getByText('Du bist offline.', { exact: false })).toBeVisible()
  const response = await page.evaluate(() => fetch('./icon-192.png').then(response => response.ok))
  expect(response).toBe(true)
  const cachedUrls = await page.evaluate(async () => {
    const keys = await caches.keys()
    return (await Promise.all(keys.filter(key => key.startsWith('herzenswuensche-')).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat()
  })
  expect(cachedUrls.every(url => new URL(url).origin === 'http://127.0.0.1:4182')).toBe(true)
  expect(cachedUrls.some(url => url.includes('/assets/') && url.endsWith('.js'))).toBe(true)
})
