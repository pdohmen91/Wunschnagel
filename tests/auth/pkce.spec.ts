import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'

const backend = 'https://security-test.supabase.co'
const uid = '00000000-0000-4000-8000-000000000001'
const session = (id = uid) => {
  const now = Math.floor(Date.now() / 1000)
  const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })).toString('base64url') + '.fixture-only'
  return { access_token: token, refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: { id, aud: 'authenticated', email: 'fixture@example.invalid', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Sicherer Test' }, created_at: new Date().toISOString() } }
}

test('PKCE uses S256, redeems only with the local verifier and keeps the session after reopening', async ({ page }) => {
  let challenge = '', redeemed = false
  await page.route(backend + '/**', async route => {
    const url = new URL(route.request().url())
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' }
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    if (url.pathname === '/auth/v1/authorize') { await route.fulfill({ contentType: 'text/html', body: '<p>Controlled OAuth fixture</p>', headers }); return }
    if (url.pathname === '/auth/v1/token') {
      expect(url.searchParams.get('grant_type')).toBe('pkce')
      const body = route.request().postDataJSON()
      expect(body.auth_code).toBe('controlled-code')
      expect(createHash('sha256').update(body.code_verifier).digest('base64url')).toBe(challenge)
      redeemed = true
      await route.fulfill({ json: session(), headers }); return
    }
    if (url.pathname === '/rest/v1/rpc/get_my_wishlists') {
      await route.fulfill({ json: [{ id: uid, owner_id: uid, title: 'Anmeldung geschützt', emoji: '🔒', description: '', visibility: 'private', share_token: 'a'.repeat(64), created_at: new Date().toISOString() }], headers }); return
    }
    await route.fulfill({ json: [], headers })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Mit Google anmelden', exact: true }).click()
  await page.waitForURL(url => url.pathname === '/auth/v1/authorize')
  const authorization = new URL(page.url())
  expect(authorization.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256')
  challenge = authorization.searchParams.get('code_challenge')!
  expect(challenge).toHaveLength(43)
  expect(authorization.searchParams.has('code_verifier')).toBe(false)
  await page.goto('http://127.0.0.1:4183/?code=controlled-code')
  await expect(page.getByRole('heading', { name: 'Anmeldung geschützt', exact: true })).toBeVisible()
  expect(redeemed).toBe(true)
  expect(new URL(page.url()).searchParams.has('code')).toBe(false)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Anmeldung geschützt', exact: true })).toBeVisible()
})

test('unsolicited tokens and authorization codes cannot log a visitor into another account', async ({ page }) => {
  let network = 0
  await page.route(backend + '/**', async route => { network++; await route.fulfill({ status: 400, json: { message: 'Unexpected auth request' }, headers: { 'access-control-allow-origin': '*' } }) })
  const attacker = session('00000000-0000-4000-8000-000000000002')
  await page.goto('/?access_token=' + attacker.access_token + '#refresh_token=' + attacker.refresh_token)
  await expect(page.getByRole('button', { name: 'Mit Google anmelden', exact: true })).toBeVisible()
  expect(page.url()).not.toContain('access_token')
  expect(page.url()).not.toContain('refresh_token')
  expect(network).toBe(0)
  await page.goto('/?code=unsolicited-code')
  await expect(page.getByRole('button', { name: 'Mit Google anmelden', exact: true })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.has('code')).toBe(false)
  expect(network).toBe(0)
})
