import { expect, test } from '@playwright/test'
import { enableSync, newIdea, setFold } from './helpers'

// Máy chủ cục bộ dùng AI giả (AI_FAKE=1): câu trả lời có tiền tố "(AI giả)"

test('chưa bật đồng bộ thì AI báo cần đồng bộ, và Mài ý tưởng không hỏi tiếp', async ({ page }) => {
  const id = await newIdea(page, 'App ghép cặp người chạy bộ')
  await expect(page.locator('.ai-panel')).toContainText('bật đồng bộ')
  await page.goto(`/#/idea/${id}/coach`)
  await page.waitForSelector('.coach-prompt')
  await page.fill('textarea[aria-label="Câu trả lời"]', 'Mình hay chạy một mình, thấy chán')
  await page.click('.coach-actions .btn.primary')
  await expect(page.locator('.coach-prompt')).not.toContainText('AI giả')
})

test('AI phản biện: thêm giả định bằng một chạm, ghi vào nhật ký, trừ hạn mức', async ({ page }) => {
  const id = await newIdea(page, 'App ghép cặp người chạy bộ')
  await enableSync(page)
  await page.goto(`/#/idea/${id}`)
  await expect(page.locator('.ai-panel')).toContainText('còn 30 lượt')
  await page.click('button:has-text("Phản biện ý tưởng này")')
  await expect(page.locator('.ai-result')).toBeVisible()
  await expect(page.locator('.ai-panel')).toContainText('còn 29 lượt')
  await setFold(page, 'assumptions', true)
  await page.locator('.ai-assumptions button:has-text("Thêm")').first().click()
  await expect(page.locator('.assumption')).toHaveCount(1)
  await setFold(page, 'journal', true)
  await expect(page.locator('.tl-entry.kind-ai')).toContainText('Điểm yếu')
})

test('Mài ý tưởng: câu trả lời chung chung thì AI hỏi tiếp, tối đa 2 câu, không tính vào số câu', async ({ page }) => {
  const id = await newIdea(page, 'App ghép cặp người chạy bộ')
  await enableSync(page)
  await page.goto(`/#/idea/${id}/coach`)
  await page.waitForSelector('.coach-prompt')
  let followUps = 0
  for (let k = 0; k < 10; k++) {
    if (await page.getByText('Ý tưởng đã sắc hơn').count()) break
    const prompt = (await page.textContent('.coach-prompt')) ?? ''
    const isFollow = prompt.includes('AI giả')
    if (isFollow) {
      followUps++
      // câu hỏi tiếp không làm tăng "Câu X trên N"
      await expect(page.locator('.coach-progress')).toContainText(/Câu \d+ trên/)
    }
    if (await page.locator('.coach-score').count()) await page.click('.coach-actions .btn.primary')
    else if (await page.locator('.pick-list').count()) {
      await page.fill('textarea[aria-label="Phép thử"]', 'Hỏi 5 runner ở hồ Tây')
      await page.click('.coach-actions .btn.primary')
    } else if (await page.locator('textarea[aria-label="Lời họ nói"]').count()) await page.click('text=Chưa hỏi ai')
    else {
      await page.fill('textarea[aria-label="Câu trả lời"]', isFollow ? 'Tuần trước mình rủ chị Hà chạy nhưng chị ấy chậm hơn nhiều, hai đứa không khớp pace.' : 'Mình thấy chán')
      await page.click('.coach-actions .btn.primary')
    }
    await page.waitForTimeout(500)
  }
  expect(followUps).toBe(2)
  await page.click('text=Về ý tưởng')
  await page.waitForSelector('#sec-journal')
  await setFold(page, 'journal', true)
  await expect(page.locator('.tl-entry.kind-coach')).toContainText('Hỏi tiếp')
})
