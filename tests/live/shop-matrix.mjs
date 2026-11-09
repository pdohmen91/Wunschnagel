import { signInQa } from './qa-auth.mjs'
// Public product fixtures only. Does not query existing users/lists, send mail,
// retry blocked shops, or bypass the function's normal per-user request budget.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const { url, publishable_key: key } = JSON.parse(readFileSync(process.env.WUNSCHNAGEL_QA_CONFIG, 'utf8'))
const ref = new URL(url).hostname.split('.')[0]
const keys = JSON.parse(execFileSync(process.env.WUNSCHNAGEL_QA_SUPABASE || 'supabase', ['projects', 'api-keys', `--remote=${ref}`, '--reveal', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, keys.find(k => k.type === 'secret').api_key, options), api = createClient(url, key, options)
const samples = JSON.parse(readFileSync(new URL('./shop-samples.json', import.meta.url), 'utf8'))
const chosen = process.env.WUNSCHNAGEL_QA_SHOPS?.split(',').map(name => name.trim())
const rows = [], started = new Date().toISOString()
let userId, browser
async function checked(request) { const { data, error } = await request; if (error) throw new Error(error.message); return data }
try {
  const email = `wunschnagel-shops-qa-${randomBytes(8).toString('hex')}@example.invalid`, password = randomBytes(32).toString('base64url')
  const created = await checked(admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'QA Shopprüfung' } }))
  userId = created.user.id
  await signInQa(api, admin, email)
  for (const sample of samples.filter(sample => !chosen || chosen.includes(sample.shop))) {
    const start = Date.now()
    const { data, error } = await api.functions.invoke('link-preview', { body: { url: sample.url } })
    const row = { ...sample, title: '', image: false, image_url: '', price: null, error: null, duration_ms: Date.now() - start }
    if (error) {
      const response = error.context instanceof Response ? await error.context.clone().json().catch(() => null) : null
      row.error = { code: response?.code || 'request_failed', message: response?.error || error.message }
    } else {
      assert.equal(typeof data.title, 'string')
      assert.equal(typeof data.image_url, 'string')
      assert.ok(data.price === null || typeof data.price === 'number' && Number.isFinite(data.price) && data.price >= 0 && data.price <= 999999.99)
      row.title = data.title; row.image = !!data.image_url; row.image_url = data.image_url; row.price = data.price
    }
    rows.push(row)
    console.log(JSON.stringify(row))
  }
  if (process.env.WUNSCHNAGEL_QA_CHECK_IMAGES === '1') {
    const { webkit } = await import('@playwright/test')
    browser = await webkit.launch()
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } })
    const page = await context.newPage()
    await page.setContent('<!doctype html><html lang="de"><head><title>Öffentliche Shop-Vorschauen</title><style>body{font:16px system-ui;background:#f6f1e8;color:#352334;padding:20px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}article{background:white;padding:16px;border:1px solid #ddd}img{width:100%;height:150px;object-fit:contain}h2{font-size:18px}p{font-size:13px}</style></head><body><h1>Öffentliche Shop-Vorschauen</h1><main></main></body></html>')
    const images = await page.evaluate(async samples => Promise.all(samples.filter(row => row.image_url).map(async row => {
      const card = document.createElement('article'), title = document.createElement('h2'), image = document.createElement('img'), caption = document.createElement('p')
      title.textContent = row.shop; image.alt = row.title; image.referrerPolicy = 'no-referrer'; caption.textContent = row.title
      card.append(title, image, caption); document.querySelector('main').append(card)
      const loaded = await new Promise(resolve => { const timer = setTimeout(() => resolve(false), 8000); image.onload = () => { clearTimeout(timer); resolve(image.naturalWidth > 0) }; image.onerror = () => { clearTimeout(timer); resolve(false) }; image.src = row.image_url })
      return { shop: row.shop, loaded }
    })), rows)
    for (const result of images) { const row = rows.find(row => row.shop === result.shop); row.image_loaded = result.loaded }
    await page.screenshot({ path: 'test-results/shop-images-audit.png', fullPage: true })
    console.log(JSON.stringify({ imageChecks: images }))
  }
  const report = { tested_at: started, environment: 'production edge function', samples: rows }
  const output = process.env.WUNSCHNAGEL_QA_REPORT || '/private/tmp/wunschnagel-shop-matrix.json'
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ report: output, tested: rows.length, complete: rows.filter(row => row.title && row.image && row.price !== null).length, partial: rows.filter(row => !row.error && (!row.title || !row.image || row.price === null)).length, failed: rows.filter(row => row.error).length }))
} catch (e) {
  console.error(String(e.message).split('\n')[0].replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]'))
  process.exitCode = 1
} finally {
  await browser?.close()
  if (userId) { const { error } = await admin.auth.admin.deleteUser(userId); if (error) { console.error('QA cleanup failed for ' + userId); process.exitCode = 1 } }
  console.log('Temporary QA account and preview budget removed. Existing lists and wishes were not accessed.')
}
