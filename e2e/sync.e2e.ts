import { expect, test } from '@playwright/test'
import { capture, enableSync, joinSync, syncNow } from './helpers'

test('hai máy: ghép bằng mã, sửa lệch nhau thì gộp lại, xoá thì mất ở máy kia', async ({ browser }) => {
  const A = await (await browser.newContext()).newPage()
  await A.goto('/')
  await capture(A, 'Cho thuê đồ cắm trại cuối tuần #travel')
  const code = await enableSync(A)
  expect(code).toMatch(/^[0-9A-Z-]{20,}$/)

  // mã sai bị báo, mã đúng (gõ thường, dấu cách) ghép được và thấy ý tưởng
  const B = await (await browser.newContext()).newPage()
  await B.goto('/#/settings')
  await B.fill('input[aria-label="Mã đồng bộ"]', code.slice(0, -1) + (code.endsWith('0') ? '2' : '0'))
  await B.click('button:has-text("Ghép máy này")')
  await expect(B.locator('.toast')).toContainText(/không đúng|không có|chưa/i)
  await joinSync(B, code.toLowerCase().replace(/-/g, ' '))
  await B.goto('/#/')
  await expect(B.locator('.row-title')).toHaveText(['Cho thuê đồ cắm trại cuối tuần'])

  // A mất mạng và đổi tên; B ghi thêm nhật ký cùng lúc
  await A.goto('/#/')
  await A.locator('.row').click()
  await B.locator('.row').click()
  await A.context().setOffline(true)
  await A.locator('.detail-title textarea').fill('Cho thuê đồ cắm trại (tên mới trên A)')
  await A.locator('.body-input').click()
  await B.fill('textarea[aria-label="Ghi thêm vào nhật ký"]', 'Nhật ký viết trên B')
  await B.click('.journal-add .btn')
  await expect(B.locator('.tl-entry')).toHaveCount(1)
  await syncNow(B)
  await A.context().setOffline(false)
  await syncNow(A)
  await syncNow(B)

  // cả hai máy đều có cả tên mới lẫn dòng nhật ký: không bên nào đè mất bên nào
  for (const page of [A, B]) {
    await page.goto('/#/')
    await page.locator('.row').click()
    await expect(page.locator('.detail-title textarea')).toHaveValue('Cho thuê đồ cắm trại (tên mới trên A)')
    await expect(page.locator('.tl-entry')).toContainText('Nhật ký viết trên B')
  }

  // A xoá, B đồng bộ thì mất theo
  await A.getByRole('button', { name: 'Xoá ý tưởng này' }).click()
  await expect(A).toHaveURL(/#\/$/) // xoá xong app tự về danh sách
  await expect(A.locator('.row')).toHaveCount(0)
  await syncNow(A)
  await syncNow(B)
  await B.goto('/#/')
  await expect(B.locator('.row')).toHaveCount(0)
})

test('máy kia tự nhận thay đổi mà không cần bấm gì', async ({ browser }) => {
  test.setTimeout(120_000)
  const A = await (await browser.newContext()).newPage()
  await A.goto('/')
  await capture(A, 'Ý tưởng để thử tự nhận')
  const code = await enableSync(A)
  const B = await (await browser.newContext()).newPage()
  await joinSync(B, code)
  await B.goto('/#/')
  await expect(B.locator('.row')).toHaveCount(1)
  await A.goto('/#/')
  await capture(A, 'Thêm một ý tưởng trên A')
  // B hỏi máy chủ định kỳ (20 giây một lần) nên sẽ tự thấy
  await expect(B.locator('.row')).toHaveCount(2, { timeout: 60_000 })
})
