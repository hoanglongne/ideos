import { expect, test } from '@playwright/test'
import { capture } from './helpers'

test('ghi ý tưởng, tìm không dấu, và dùng được khi mất mạng', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByText('Ý tưởng đầu tiên sẽ nằm ở đây')).toBeVisible()

  await capture(page, 'App tìm bạn chạy bộ quanh hồ Tây #fitness @app')
  await capture(page, 'Web so sánh giá vé xe khách #travel @web')
  await expect(page.locator('.item')).toHaveCount(2)

  // từ 7 ý tưởng trở lên mới hiện ô tìm; tìm không cần dấu
  for (const t of ['Một', 'Hai', 'Ba', 'Bốn', 'Năm']) await capture(page, 'Ý tưởng số ' + t)
  await expect(page.locator('.item')).toHaveCount(7)
  await page.fill('.home-search input', 'ban chay')
  await expect(page.locator('.item')).toHaveCount(1)
  await page.fill('.home-search input', '')

  // Chờ service worker lưu xong bản app, rồi rút mạng
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.waitForFunction(async () => (await caches.keys()).length > 0)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.item')).toHaveCount(7)
  await capture(page, 'Ý tưởng ghi lúc offline #offline')
  await expect(page.locator('.item')).toHaveCount(8)

  // Màn tải theo yêu cầu (chunk) vẫn mở được khi offline
  await page.goto('/#/settings')
  await expect(page.locator('.settings')).toBeVisible()
  await context.setOffline(false)
})

test('nhận nội dung chia sẻ từ app khác', async ({ page }) => {
  await page.goto('/?share_title=Bai%20hay&share_url=https%3A%2F%2Fexample.com')
  await expect(page.locator('.capture-input')).toHaveValue(/Bai hay[\s\S]*example\.com/)
  expect(page.url()).not.toContain('share_title')
})
