import { expect, test } from '@playwright/test'
import { capture, newIdea, phoneContext } from './helpers'

test.describe('điện thoại', () => {
  test('các mục đóng sẵn, nhảy nhanh mở và cuộn tới, trạng thái nhớ theo từng ý tưởng', async ({ browser }) => {
    const ctx = await phoneContext(browser)
    const page = await ctx.newPage()
    await page.goto('/')
    const a = await newIdea(page, 'Ý tưởng thứ nhất')
    const open = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('details.fold')].map((d) => [d.id.replace('sec-', ''), (d as HTMLDetailsElement).open])))
    expect(Object.values(await open()).every((v) => v === false)).toBe(true)

    await page.click('.jump-nav button:has-text("Bằng chứng")')
    await expect.poll(async () => (await open()).evidence).toBe(true)
    // cuộn tới sát thanh dính phía trên
    await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('sec-evidence')!.getBoundingClientRect().top))).toBeLessThan(200)

    await page.reload()
    await page.waitForSelector('#sec-journal')
    expect((await open()).evidence).toBe(true)

    // ý tưởng khác không bị ảnh hưởng
    await page.goto('/#/')
    await capture(page, 'Ý tưởng thứ hai')
    await page.locator('.row', { hasText: 'Ý tưởng thứ hai' }).click()
    await page.waitForSelector('#sec-journal')
    expect((await open()).evidence).toBe(false)
    expect(a).toBeTruthy()
    await ctx.close()
  })

  test('vùng chạm đủ lớn: thử bấm 4 điểm cách tâm 20px trên mọi nút của màn danh sách và chi tiết', async ({ browser }) => {
    const ctx = await phoneContext(browser)
    const page = await ctx.newPage()
    await page.goto('/')
    await newIdea(page, 'Ý tưởng để đo vùng chạm #a')
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)))
    const measure = () =>
      page.evaluate(() => {
        const bad: string[] = []
        for (const e of document.querySelectorAll<HTMLElement>('button, a[href], select, input:not([type=hidden]), summary, textarea')) {
          const cs = getComputedStyle(e)
          if (cs.visibility === 'hidden' || cs.display === 'none') continue
          if (e.tagName === 'A' && !e.className && e.closest('p, .panel-note, .lede')) continue // link trong câu được miễn
          if (!e.getBoundingClientRect().width) continue
          e.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
          const r = e.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          const ok = (h: Element | null) => !!h && (e.contains(h) || [...((e as HTMLInputElement).labels ?? [])].some((l) => l.contains(h)) || !!e.closest('label')?.contains(h))
          const pts = [[cx, cy - 20], [cx, cy + 20]]
          if (r.width < 44) pts.push([cx - 16, cy], [cx + 16, cy])
          if (pts.some(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && !ok(document.elementFromPoint(x, y)))) bad.push(`${e.tagName.toLowerCase()}.${e.className} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 20)}"`)
        }
        return bad
      })
    expect(await measure(), 'trang chi tiết').toEqual([])
    await page.goto('/#/')
    await page.waitForSelector('.row')
    expect(await measure(), 'danh sách').toEqual([])
    await ctx.close()
  })
})
