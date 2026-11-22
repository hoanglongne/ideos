import { expect, test } from '@playwright/test'
import { capture, newIdea, setFold } from './helpers'

// Đường đi chính: một ý tưởng luôn có đúng MỘT bước tiếp theo, và làm xong bước đó thì bước sau tự hiện ra.
const card = (page: import('@playwright/test').Page) => page.locator('.next-card')

test('hôm nay chỉ ra việc quan trọng nhất và dẫn thẳng tới đó', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Ý tưởng đầu tiên sẽ nằm ở đây')).toBeVisible()
  await capture(page, 'App ghép cặp người chạy bộ #fitness')
  await expect(page.locator('.hero')).toContainText('Mài ý tưởng')
  await expect(page.locator('.hero')).toContainText('App ghép cặp người chạy bộ')
  await page.locator('.hero a.btn.primary').click()
  await expect(page).toHaveURL(/\/coach$/)
})

test('đi hết một vòng: Ghi → Mài → Thử → tính tiền → Quyết → Làm, mỗi lúc một bước', async ({ page }) => {
  await newIdea(page, 'App ghép cặp người chạy bộ #fitness')
  await expect(card(page)).toContainText('Mài ý tưởng')
  await expect(page.locator('.rail li.current')).toContainText('Ghi')

  // điền vấn đề và người dùng (bước mài) → bước sau là tìm điều phải đúng
  await setFold(page, 'canvas', true)
  await page.getByLabel('Vấn đề', { exact: true }).fill('Chạy một mình buổi sáng thấy chán')
  await page.getByLabel('Người dùng', { exact: true }).fill('Dân văn phòng quanh hồ Tây')
  await page.locator('.idea-title').click()
  await expect(card(page)).toContainText('Tìm điều phải đúng')

  // có giả định → sẵn sàng kiểm chứng → chuyển giai đoạn bằng đúng nút trong thẻ
  await setFold(page, 'assumptions', true)
  await page.fill('input[aria-label="Thêm giả định"]', 'Người ta chịu ghép cặp với người lạ')
  await page.getByRole('button', { name: 'Thêm', exact: true }).first().click()
  await expect(card(page)).toContainText('Sẵn sàng kiểm chứng?')
  await card(page).getByRole('button', { name: 'Chuyển sang Kiểm chứng' }).click()
  await expect(page.locator('.rail li.current')).toContainText('Thử')

  // thử giả định: chọn kết quả ngay trên thẻ
  await expect(card(page)).toContainText('Người ta chịu ghép cặp với người lạ')
  await card(page).getByRole('button', { name: 'Đúng', exact: true }).click()
  await expect(card(page)).toContainText('Tính xem có đứng được về tiền không')

  // tính tiền → quyết định
  await card(page).getByRole('button', { name: 'Tính bài toán tiền' }).click()
  await page.click('.model-opt:has-text("SaaS")')
  await expect(card(page)).toContainText('Đi tiếp hay dừng?')
  await card(page).getByRole('button', { name: 'Đi tiếp: bắt đầu làm' }).click()
  await expect(page.locator('.rail li.current')).toContainText('Làm')
  await expect(card(page)).toContainText('Sẵn sàng ra mắt?')
})

test('ý tưởng để sau không còn việc nào, và mở lại được ngay trên thẻ', async ({ page }) => {
  await newIdea(page, 'Ý tưởng để sau')
  await page.locator('summary[aria-label="Thêm tuỳ chọn"]').click()
  await page.getByRole('combobox', { name: 'Giai đoạn' }).selectOption('parked')
  await expect(card(page)).toContainText('Đang để sau')
  await card(page).getByRole('button', { name: 'Mở lại' }).click()
  await expect(card(page)).toContainText('Mài ý tưởng')
})
