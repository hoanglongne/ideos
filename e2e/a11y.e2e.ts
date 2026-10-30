import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { capture, newIdea, setFold } from './helpers'

// Trợ năng: axe-core quét các màn chính, chỉ chấp nhận 0 lỗi mức "serious" và "critical".
async function scan(page: Page, name: string) {
  // chờ mọi hiệu ứng xong, kẻo axe đo màu của phần tử đang mờ dần
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const text = bad.map((v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n   ')}`).join('\n')
  expect(bad, `${name}\n${text}`).toEqual([])
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`trợ năng (${scheme})`, () => {
    test.use({ colorScheme: scheme })

    test('danh sách, chi tiết (mọi mục mở, có bài toán tiền), mài ý tưởng, ôn lại, thống kê, cài đặt', async ({ page }) => {
      await page.goto('/')
      await capture(page, 'App ghép cặp người chạy bộ #fitness @app')
      await capture(page, 'Web so sánh giá vé xe khách #travel @web')
      await expect(page.locator('.row')).toHaveCount(2)
      await scan(page, 'danh sách')

      await page.keyboard.press('n')
      await page.waitForSelector('.capture-input')
      await scan(page, 'khung ghi nhanh')
      await page.keyboard.press('Escape')

      const id = await newIdea(page, 'Ý tưởng để quét trợ năng')
      for (const s of ['journal', 'assumptions', 'money', 'evidence', 'tasks', 'canvas']) await setFold(page, s, true)
      await page.click('.model-opt:has-text("SaaS")')
      await page.locator('.money-sub').evaluate((d) => ((d as HTMLDetailsElement).open = true))
      await page.fill('#mf-churn_pct', '500') // trạng thái lỗi cũng phải đạt
      await scan(page, 'chi tiết ý tưởng')

      await page.goto(`/#/idea/${id}/coach`)
      await page.waitForSelector('.coach-prompt')
      await scan(page, 'mài ý tưởng')

      for (const [hash, sel, name] of [['#/review', '.review', 'ôn lại'], ['#/stats', '.stats', 'thống kê'], ['#/settings', '.settings', 'cài đặt']] as const) {
        await page.goto('/' + hash)
        await page.waitForSelector(sel)
        await scan(page, name)
      }
    })
  })
}
