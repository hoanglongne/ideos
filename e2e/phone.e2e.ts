import { expect, test } from '@playwright/test'
import { capture, newIdea, phoneContext } from './helpers'

test.describe('điện thoại', () => {
  test('thẻ bước tiếp theo nằm ngay màn đầu, các phần đóng sẵn, mở hay đóng được nhớ theo từng ý tưởng', async ({ browser }) => {
    const ctx = await phoneContext(browser)
    const page = await ctx.newPage()
    await page.goto('/')
    await newIdea(page, 'Ý tưởng thứ nhất')
    const open = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('details.part')].map((d) => [d.id.replace('sec-', ''), (d as HTMLDetailsElement).open])))
    expect(Object.values(await open()).every((v) => v === false)).toBe(true)

    // không cần cuộn: thẻ và nút chính đã nằm trong màn hình đầu
    const card = await page.locator('.next-card .btn.primary').boundingBox()
    expect(card!.y + card!.height).toBeLessThan(844)

    await page.locator('#sec-evidence > summary').click()
    expect((await open()).evidence).toBe(true)
    await page.reload()
    await page.waitForSelector('.idea')
    expect((await open()).evidence).toBe(true)

    // ý tưởng khác không bị ảnh hưởng
    await capture(page, 'Ý tưởng thứ hai')
    await page.goto('/#/ideas')
    await page.locator('.ideas .row', { hasText: 'Ý tưởng thứ hai' }).click()
    await page.waitForSelector('.idea')
    expect((await open()).evidence).toBe(false)
    await ctx.close()
  })

  test('vùng chạm đủ lớn: thử bấm 4 điểm cách tâm 20px trên mọi nút của màn danh sách và chi tiết', async ({ browser }) => {
    const ctx = await phoneContext(browser)
    const page = await ctx.newPage()
    await page.goto('/')
    await newIdea(page, 'Ý tưởng để đo vùng chạm #a')
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 15_000 }) // thông báo tạm thời che nút ở cuối trang
    await page.evaluate(() => document.querySelectorAll('details.part').forEach((d) => ((d as HTMLDetailsElement).open = true)))
    const measure = (scope = 'body') =>
      page.evaluate((scope) => {
        const bad: string[] = []
        for (const e of document.querySelector(scope)!.querySelectorAll<HTMLElement>('button, a[href], select, input:not([type=hidden]), summary, textarea')) {
          const cs = getComputedStyle(e)
          if (cs.visibility === 'hidden' || cs.display === 'none') continue
          if (e.tagName === 'A' && !e.className && e.closest('p, .panel-note, .lede')) continue // link trong câu được miễn
          // nội dung trong <details> đang đóng không bấm được, không đo
          let hidden = false
          for (let d = e.closest('details'); d; d = d.parentElement?.closest('details') ?? null) if (!d.open && !(e.tagName === 'SUMMARY' && e.parentElement === d)) hidden = true
          if (hidden) continue
          if (!e.getBoundingClientRect().width) continue
          e.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
          const r = e.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          const ok = (h: Element | null) => !!h && (e.contains(h) || [...((e as HTMLInputElement).labels ?? [])].some((l) => l.contains(h)) || !!e.closest('label')?.contains(h))
          const pts = [[cx, cy - 20], [cx, cy + 20]]
          if (r.width < 44) pts.push([cx - 16, cy], [cx + 16, cy])
          const miss = pts.find(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && !ok(document.elementFromPoint(x, y)))
          if (miss) {
            const h = document.elementFromPoint(miss[0], miss[1])
            bad.push(`${e.tagName.toLowerCase()}.${e.className} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 20)}" (${Math.round(r.width)}x${Math.round(r.height)}) bị ${h ? h.tagName.toLowerCase() + '.' + h.className : 'null'} che`)
          }
        }
        return bad
      }, scope)
    expect(await measure(), 'trang chi tiết').toEqual([])
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.locator('summary[aria-label="Thêm tuỳ chọn"]').click()
    await expect(page.locator('details.menu')).toHaveJSProperty('open', true)
    expect(await measure('.menu-pop'), 'menu ⋯').toEqual([])
    for (const [hash, name] of [['/#/', 'hôm nay'], ['/#/ideas', 'danh sách']] as const) {
      await page.goto(hash)
      await page.waitForSelector('.today, .ideas')
      expect(await measure(), name).toEqual([])
    }
    await ctx.close()
  })
})
