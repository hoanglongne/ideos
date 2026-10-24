// Sinh icon PNG từ public/icon.svg: node scripts/icons.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

// require() để dùng được cả playwright cài global
const { chromium } = createRequire(import.meta.url)('playwright')

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()

async function render(size, file, { maskable = false, inset = 0 } = {}) {
  await page.setViewportSize({ width: size, height: size })
  const pad = Math.round(size * inset)
  await page.setContent(
    `<html><body style="margin:0;background:${maskable ? '#1f201d' : 'transparent'}">
      <div style="padding:${pad}px;width:${size}px;height:${size}px;box-sizing:border-box">
        ${svg.replace('<svg ', `<svg width="${size - pad * 2}" height="${size - pad * 2}" `)}
      </div></body></html>`,
  )
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: !maskable })
}

await render(192, 'pwa-192.png')
await render(512, 'pwa-512.png')
await render(512, 'pwa-maskable-512.png', { maskable: true, inset: 0.1 })
await render(180, 'apple-touch-icon.png', { maskable: true })
await browser.close()
