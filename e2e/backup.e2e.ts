import { expect, test } from '@playwright/test'

const DAY = 86_400_000

function backupFile(n: number, oldestDaysAgo: number) {
  const now = Date.now()
  const canvas = { problem: '', audience: '', solution: '', monetization: '', competitors: '', unfair: '' }
  const ideas = Array.from({ length: n }, (_, i) => ({
    id: 'seed-' + i,
    title: 'Ý tưởng cũ ' + (i + 1),
    body: '',
    kind: 'app',
    status: 'spark',
    tags: [],
    pinned: false,
    scores: { impact: 0, confidence: 0, ease: 0 },
    canvas,
    tasks: [],
    links: [],
    related: [],
    journal: [],
    assumptions: [],
    evidence: [],
    createdAt: now - (oldestDaysAgo - i) * DAY,
    updatedAt: now - (oldestDaysAgo - i) * DAY,
  }))
  return Buffer.from(JSON.stringify({ app: 'ideos', version: 1, exportedAt: now, ideas, attachments: [] }))
}

test('nhắc sao lưu khi dữ liệu chỉ nằm trên một máy, để sau thì im, tải xong thì hết nhắc', async ({ page }) => {
  await page.goto('/#/settings')
  await page.setInputFiles('input[type=file]', { name: 'ideos-backup.json', mimeType: 'application/json', buffer: backupFile(4, 40) })
  await page.goto('/#/')
  await expect(page.locator('.row')).toHaveCount(4)
  const nudge = page.locator('.nudge')
  await expect(nudge).toContainText('Chưa sao lưu lần nào')
  await expect(nudge).toContainText('4 ý tưởng')

  await nudge.getByRole('button', { name: 'Để sau' }).click()
  await expect(nudge).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.row')).toHaveCount(4)
  await expect(nudge).toHaveCount(0)

  await page.evaluate(() => localStorage.removeItem('ideos:backupNudgeUntil'))
  await page.reload()
  await expect(nudge).toBeVisible()
  const [dl] = await Promise.all([page.waitForEvent('download'), nudge.getByRole('button', { name: 'Tải bản sao lưu' }).click()])
  expect(dl.suggestedFilename()).toMatch(/^ideos-backup-.*\.json$/)
  await expect(nudge).toHaveCount(0)
  await page.goto('/#/settings')
  await expect(page.getByText('Sao lưu gần nhất: hôm nay')).toBeVisible()
})

test('người mới (ít ý tưởng, mới ghi) không bị nhắc', async ({ page }) => {
  await page.goto('/#/settings')
  await page.setInputFiles('input[type=file]', { name: 'b.json', mimeType: 'application/json', buffer: backupFile(2, 40) })
  await page.goto('/#/')
  await expect(page.locator('.row')).toHaveCount(2)
  await expect(page.locator('.nudge')).toHaveCount(0)
})
