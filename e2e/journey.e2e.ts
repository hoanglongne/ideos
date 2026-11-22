import { expect, test } from '@playwright/test'
import { capture, newIdea } from './helpers'

// Đường đi chính: một ý tưởng luôn có đúng MỘT việc "Bây giờ", làm xong thì việc sau tự hiện ra.
const now = (page: import('@playwright/test').Page) => page.locator('.now')

test('trang chủ chỉ ra việc cần bạn và dẫn thẳng tới đó', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Ý tưởng đầu tiên sẽ nằm ở đây')).toBeVisible()
  await capture(page, 'App ghép cặp người chạy bộ #fitness')
  await expect(page.locator('.item.hot')).toContainText('Mài ý tưởng')
  await page.locator('.item.hot').click()
  await expect(now(page)).toContainText('Mài ý tưởng')
  await now(page).getByRole('link', { name: 'Bắt đầu mài' }).click()
  await expect(page).toHaveURL(/\/coach$/)
})

test('đi hết một vòng: Ghi → Mài → Thử → tính tiền → Quyết → Làm, mỗi lúc một việc', async ({ page }) => {
  const id = await newIdea(page, 'App ghép cặp người chạy bộ #fitness')
  await expect(now(page)).toContainText('Mài ý tưởng')

  // mài: trả lời hai câu đầu (vấn đề, người dùng) rồi quay lại
  await page.goto(`/#/idea/${id}/coach`)
  await page.waitForSelector('.coach-prompt')
  await page.fill('textarea[aria-label="Câu trả lời"]', 'Chạy một mình buổi sáng thấy chán')
  await page.click('.coach-actions .btn.primary')
  await page.waitForTimeout(300)
  await page.fill('textarea[aria-label="Câu trả lời"]', 'Dân văn phòng quanh hồ Tây')
  await page.click('.coach-actions .btn.primary')
  await page.waitForTimeout(300)
  await page.goto(`/#/idea/${id}`)
  await expect(now(page)).toContainText('Tìm điều phải đúng')

  // có giả định → sẵn sàng kiểm chứng
  await page.fill('input[aria-label="Thêm giả định"]', 'Người ta chịu ghép cặp với người lạ')
  await page.locator('form.q-new').getByRole('button', { name: 'Thêm' }).click()
  await expect(now(page)).toContainText('Sẵn sàng kiểm chứng?')
  await now(page).getByRole('button', { name: 'Chuyển sang Kiểm chứng' }).click()

  // thử giả định: chọn kết quả ngay trên thẻ
  await expect(now(page)).toContainText('Người ta chịu ghép cặp với người lạ')
  await now(page).getByRole('button', { name: 'Đúng', exact: true }).click()
  await expect(now(page)).toContainText('Tính xem có đứng được về tiền không')

  // tính tiền → quyết định
  await now(page).getByRole('button', { name: 'Tính bài toán tiền' }).click()
  await page.click('.model-opt:has-text("SaaS")')
  await expect(now(page)).toContainText('Đi tiếp hay dừng?')
  await now(page).getByRole('button', { name: 'Đi tiếp: bắt đầu làm' }).click()
  await expect(now(page)).toContainText('Sẵn sàng ra mắt?')
})

test('ý tưởng để sau không còn việc nào, và mở lại được ngay trên thẻ', async ({ page }) => {
  await newIdea(page, 'Ý tưởng để sau')
  await page.locator('summary[aria-label="Thêm tuỳ chọn"]').click()
  await page.getByRole('combobox', { name: 'Giai đoạn' }).selectOption('parked')
  await expect(now(page)).toContainText('Đang để sau')
  await now(page).getByRole('button', { name: 'Mở lại' }).click()
  await expect(now(page)).toContainText('Mài ý tưởng')
})

test('ý tưởng lâu không động tới thì được hỏi lại, thay cho màn "Ôn lại"', async ({ page }) => {
  const DAY = 86_400_000
  const now0 = Date.now()
  const canvas = { problem: '', audience: '', solution: '', monetization: '', competitors: '', unfair: '' }
  const old = {
    id: 'old-1', title: 'Ý tưởng cũ', body: '', kind: 'app', status: 'exploring', tags: [], pinned: false, scores: { impact: 0, confidence: 0, ease: 0 }, canvas,
    tasks: [], links: [], related: [], journal: [], assumptions: [], evidence: [], createdAt: now0 - 40 * DAY, updatedAt: now0 - 30 * DAY,
  }
  await page.goto('/#/settings')
  await page.setInputFiles('input[type=file]', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'ideos', version: 1, exportedAt: now0, ideas: [old], attachments: [] })) })
  await page.goto('/#/')
  await expect(page.locator('.item.hot')).toContainText('Còn muốn làm không?')
  await page.locator('.item.hot').click()
  await expect(now(page)).toContainText('30 ngày chưa động tới')
  await now(page).getByRole('button', { name: 'Còn, làm tiếp' }).click()
  await expect(now(page)).toContainText('Mài ý tưởng')
})
