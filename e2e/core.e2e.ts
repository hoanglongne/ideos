import { expect, test } from '@playwright/test'
import { capture } from './helpers'

test('ghi ý tưởng, tìm không dấu, và dùng được khi mất mạng', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByText('Ý tưởng đầu tiên sẽ nằm ở đây')).toBeVisible()

  await capture(page, 'App tìm bạn chạy bộ quanh hồ Tây #fitness @app')
  await capture(page, 'Web so sánh giá vé xe khách #travel @web')
  await expect(page.locator('.row')).toHaveCount(2)

  await page.fill('.search', 'ban chay')
  await expect(page.locator('.row')).toHaveCount(1)
  await page.fill('.search', '')

  // Chờ service worker lưu xong bản app, rồi rút mạng
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.waitForFunction(async () => (await caches.keys()).length > 0)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.row')).toHaveCount(2)
  await capture(page, 'Ý tưởng ghi lúc offline #offline')
  await expect(page.locator('.row')).toHaveCount(3)

  // Màn tải theo yêu cầu (chunk) vẫn mở được khi offline
  await page.goto('/#/stats')
  await expect(page.locator('.stats')).toBeVisible()
  await context.setOffline(false)
})

test('nhận nội dung chia sẻ từ app khác', async ({ page }) => {
  await page.goto('/?share_title=Bai%20hay&share_url=https%3A%2F%2Fexample.com')
  await expect(page.locator('.capture-input')).toHaveValue(/Bai hay[\s\S]*example\.com/)
  expect(page.url()).not.toContain('share_title')
})
