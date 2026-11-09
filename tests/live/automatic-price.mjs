import { signInQa, openQaSession } from './qa-auth.mjs'
// Opt-in online check. Uses public, independently researched product links and
// a disposable QA account; never reads or changes existing users' wishes.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { webkit, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const { url, publishable_key: key } = JSON.parse(readFileSync(process.env.WUNSCHNAGEL_QA_CONFIG, 'utf8'))
const ref = new URL(url).hostname.split('.')[0]
const keys = JSON.parse(execFileSync(process.env.WUNSCHNAGEL_QA_SUPABASE || 'supabase', ['projects', 'api-keys', `--remote=${ref}`, '--reveal', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, keys.find(k => k.type === 'secret').api_key, options), api = createClient(url, key, options)
const base = process.env.WUNSCHNAGEL_QA_BASE || 'https://pdohmen91.github.io/Wunschnagel/'
const productUrl = process.env.WUNSCHNAGEL_QA_PRODUCT_URL || 'https://fivi.gg/products/officemesser-luca-fivi'
let userId, browser, phase = 'Setup'
async function checked(request) { const { data, error } = await request; if (error) throw new Error(error.message); return data }
try {
  const email = `wunschnagel-price-qa-${randomBytes(8).toString('hex')}@example.invalid`, password = randomBytes(32).toString('base64url')
  const created = await checked(admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'QA Preisimport' } }))
  userId = created.user.id
  const signed = await signInQa(api, admin, email)
  phase = 'Independent public price baseline'
  let expectedPrice = Number(process.env.WUNSCHNAGEL_QA_EXPECTED_PRICE)
  if (!process.env.WUNSCHNAGEL_QA_EXPECTED_PRICE) {
    const response = await fetch(productUrl + '.js', { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`Öffentliche Preisreferenz nicht verfügbar (HTTP ${response.status}); kein automatischer Wiederholungsversuch.`)
    const source = await response.json()
    expectedPrice = source.price / 100
  }
  assert.ok(Number.isFinite(expectedPrice) && expectedPrice > 0)
  phase = 'Production edge function extracts prices'
  const preview = await checked(api.functions.invoke('link-preview', { body: { url: productUrl } }))
  assert.equal(preview.price, expectedPrice)
  assert.ok(preview.title && preview.image_url)
  const apple = new URL(productUrl).hostname === 'www.apple.com' ? preview : await checked(api.functions.invoke('link-preview', { body: { url: 'https://www.apple.com/de/shop/buy-airtag/airtag?product=MFE94ZM%2FA' } }))
  assert.ok(typeof apple.price === 'number' && apple.price > 0)
  const list = await checked(api.from('wishlists').insert({ owner_id: userId, title: '[QA] Automatischer Preis', emoji: '🔎', visibility: 'link' }).select().single())
  phase = 'Mobile app imports price without opening optional fields'
  browser = await webkit.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openQaSession(page, base, url, signed.session)
  await expect(page.getByRole('heading', { name: list.title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Wunsch hinzufügen', exact: true }).click()
  await page.getByRole('textbox', { name: 'Link zum Wunsch', exact: true }).fill(productUrl)
  await expect(page.locator('.shop-price-preview')).toBeVisible({ timeout: 15000 })
  const money = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
  await expect(page.locator('.shop-price-preview strong')).toHaveText(money.format(expectedPrice))
  assert.deepEqual((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id), [])
  await page.screenshot({ path: 'test-results/automatic-price-live-mobile.png' })
  await page.getByRole('button', { name: 'Wunsch speichern', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  const saved = await checked(api.from('wishes').select('id,price').eq('wishlist_id', list.id).single())
  assert.equal(saved.price, expectedPrice)
  await page.reload()
  const wish = page.getByRole('article').first()
  await expect(wish.locator('.price')).toContainText(money.format(expectedPrice))
  phase = 'Manual price is preserved on explicit preview reload'
  await wish.locator('summary').click(); await wish.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  const price = page.getByRole('textbox', { name: 'Preis in €' })
  const manual = expectedPrice + 5
  await price.fill(manual.toFixed(2).replace('.', ','))
  await page.getByRole('button', { name: 'Shop-Vorschau neu laden', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Shop-Preis übernehmen', exact: true })).toBeVisible({ timeout: 15000 })
  await expect(price).toHaveValue(manual.toFixed(2).replace('.', ','))
  await page.getByRole('button', { name: 'Shop-Preis übernehmen', exact: true }).click()
  await expect(price).toHaveValue(String(expectedPrice).replace('.', ','))
  await page.getByRole('button', { name: 'Wunsch speichern', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  phase = 'Read-only guest receives the saved price'
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const guest = await guestContext.newPage()
  await guest.goto(base + '#/s/' + list.share_token)
  await expect(guest.getByRole('article').locator('.price')).toContainText(money.format(expectedPrice))
  await expect(guest.locator('.card-menu')).toHaveCount(0)
  console.log(JSON.stringify({ testedHost: new URL(productUrl).hostname, shopPriceMatchesBaseline: true, appleSkuPriceImported: true, mobilePreviewShowsPrice: true, savedPriceSurvivesReload: true, manualPricePreserved: true, explicitPriceAdoptionWorks: true, sharedGuestsSeePrice: true, accessibilityPassed: true }))
} catch (e) {
  console.error(JSON.stringify({ phase, message: String(e.message).split('\n')[0].replace(/(access_token|refresh_token)=[^&\s]+/g, '$1=[redacted]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]') }))
  process.exitCode = 1
} finally {
  await browser?.close()
  if (userId) { const { error } = await admin.auth.admin.deleteUser(userId); if (error) { console.error('QA cleanup failed for ' + userId); process.exitCode = 1 } }
  console.log('Temporary QA account, lists and wishes removed.')
}
