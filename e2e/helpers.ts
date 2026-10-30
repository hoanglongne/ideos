import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

/** Ghi một ý tưởng bằng phím tắt N. */
export async function capture(page: Page, text: string) {
  await page.keyboard.press('n')
  await page.fill('.capture-input', text)
  await page.keyboard.press('Control+Enter')
  await expect(page.locator('.sheet')).toBeHidden()
}

/** Bật đồng bộ trên máy này, trả về mã đồng bộ. */
export async function enableSync(page: Page): Promise<string> {
  await page.goto('/#/settings')
  await page.click('button:has-text("Bật đồng bộ")')
  await page.waitForSelector('.vault-code')
  await waitSynced(page)
  return ((await page.textContent('.vault-code')) ?? '').trim()
}

export async function joinSync(page: Page, code: string) {
  await page.goto('/#/settings')
  await page.fill('input[aria-label="Mã đồng bộ"]', code)
  await page.click('button:has-text("Ghép máy này")')
  await waitSynced(page)
}

export const waitSynced = (page: Page) =>
  page.waitForFunction(() => /Đã đồng bộ/.test(document.querySelector('.sync-line')?.textContent ?? ''), null, { timeout: 20_000 })

/** Đồng bộ ngay và chờ đúng một vòng đồng bộ hoàn tất (app đếm số vòng ở data-syncs). */
export async function syncNow(page: Page) {
  await page.goto('/#/settings')
  await waitSynced(page)
  const before = Number((await page.evaluate(() => document.documentElement.dataset.syncs)) ?? 0)
  await page.getByRole('button', { name: 'Đồng bộ ngay' }).click()
  await page.waitForFunction((n) => Number(document.documentElement.dataset.syncs ?? 0) > n, before, { timeout: 20_000 })
}

export async function phoneContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
}

/** Ghi một ý tưởng rồi mở trang chi tiết của nó. Trả về id. */
export async function newIdea(page: Page, text: string): Promise<string> {
  await page.goto('/#/')
  await capture(page, text)
  await page.locator('.row').first().click()
  await page.waitForSelector('#sec-journal')
  return page.url().split('/idea/')[1]
}

/** Mở hoặc đóng một mục của trang ý tưởng. */
export async function setFold(page: Page, id: string, open: boolean) {
  await page.evaluate(([i, o]) => ((document.getElementById('sec-' + i) as HTMLDetailsElement).open = o), [id, open] as const)
}
