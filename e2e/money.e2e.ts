import { expect, test } from '@playwright/test'
import { newIdea, setFold } from './helpers'

async function openMoney(page: import('@playwright/test').Page, model = 'SaaS') {
  const id = await newIdea(page, 'App tìm bạn chạy bộ #fitness')
  await setFold(page, 'money', true)
  await page.click(`.model-opt:has-text("${model}")`)
  await expect(page.locator('.money-verdict')).toBeVisible()
  return id
}

const price = (page: import('@playwright/test').Page) => page.locator('#mf-price')

test('kết luận không bao giờ xanh khi còn số mặc định, và nói rõ', async ({ page }) => {
  await openMoney(page)
  await expect(page.locator('.money-verdict')).toHaveClass(/tone-neutral/)
  await expect(page.locator('.money-verdict')).toContainText('chưa phải số của bạn')
  // tự nhập hết 4 số chính thì mới được xanh
  for (const [id, v] of [['price', '300k'], ['churn_pct', '4'], ['cac', '100k'], ['fixed_cost', '2tr'], ['marketing_budget', '2tr']] as const) {
    await page.fill('#mf-' + id, v)
    await page.locator('#mf-start_cash').focus()
  }
  await expect(page.locator('.money-verdict')).toHaveClass(/tone-positive/)
})

test('gõ số kiểu Việt: 1.500.000, 99k, 1,5tr', async ({ page }) => {
  await openMoney(page)
  await price(page).fill('1.500.000')
  await page.locator('#mf-fixed_cost').focus()
  await expect(price(page)).toHaveValue('1.500.000')
  await price(page).fill('99k')
  await page.locator('#mf-fixed_cost').focus()
  await expect(price(page)).toHaveValue('99.000')
  await page.fill('#mf-cac', '1,5tr')
  await page.locator('#mf-fixed_cost').focus()
  await expect(page.locator('#mf-cac')).toHaveValue('1.500.000')
  // sửa tiếp trên số đã định dạng không bị đọc sai dấu chấm
  await price(page).focus()
  await expect(price(page)).toHaveValue('99000')
})

test('số vô lý bị từ chối kèm lý do, không bị cắt âm thầm', async ({ page }) => {
  await openMoney(page)
  await page.fill('#mf-churn_pct', '500')
  await expect(page.locator('#mf-churn_pct-hint')).toContainText('0 đến 100')
  await expect(page.locator('#mf-churn_pct')).toHaveAttribute('aria-invalid', 'true')
  await price(page).fill('một triệu')
  await expect(page.locator('#mf-price-hint')).toContainText('Chưa hiểu')
  await page.locator('#mf-fixed_cost').focus()
  await page.click('summary:has-text("Chi tiết thêm")')
  await page.fill('#mf-horizon', '0')
  await expect(page.locator('#mf-horizon-hint')).toContainText('1 đến 120')
})

test('chi phí kéo khách bằng 0: nói thiếu nguồn khách, có khách tự đến thì tính bình thường', async ({ page }) => {
  await openMoney(page)
  await page.fill('#mf-cac', '0')
  await page.fill('#mf-marketing_budget', '0')
  await page.locator('#mf-fixed_cost').focus()
  await expect(page.locator('.money-verdict')).toContainText('Chưa có nguồn khách')
  await page.fill('#mf-organic_new', '20')
  await page.locator('#mf-fixed_cost').focus()
  await expect(page.locator('.money-verdict')).toContainText('Hoà vốn vào tháng')
})

test('con số rủi ro nhất thành giả định, và xuất sang Sổ Cái', async ({ page }) => {
  const id = await openMoney(page)
  await setFold(page, 'assumptions', true)
  await page.evaluate(() => ((document.querySelector('.money-sub') as HTMLDetailsElement).open = true))
  await page.click('button:has-text("Thêm 3 con số rủi ro nhất")')
  await expect(page.locator('.assumption')).toHaveCount(3)
  await page.click('button.status-opt:has-text("Đang làm")')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Tải file cho Sổ Cái')])
  const file = JSON.parse(await (await import('node:fs/promises')).readFile((await dl.path())!, 'utf8'))
  expect(file.app).toBe('so-cai-unit-economics')
  expect(file.data.projects[0].model).toBe('saas')
  expect(file.data.plans[0].inputs.conversion_pct).toBeGreaterThan(0)
  expect(id).toBeTruthy()
})
