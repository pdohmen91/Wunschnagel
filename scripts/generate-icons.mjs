import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage()
  const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8')
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:#352334}svg{width:100%;height:100%;display:block}</style>${svg}`)
    await page.screenshot({ path: `public/icon-${size}.png` })
  }
  await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:#352334;display:grid;place-items:center}svg{width:80%;height:80%;display:block}</style>${svg}`)
  await page.screenshot({ path: 'public/icon-maskable.png' })
} finally { await browser.close() }
