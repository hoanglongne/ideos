import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import worker from './index'
import { createD1, migrate, type Meter } from './testing/d1-sqlite'

// Mô phỏng một ngày dùng RẤT nhiều và đếm dòng D1 đọc/ghi so với hạn mức gói free
// (100.000 dòng ghi/ngày, 5.000.000 dòng đọc/ngày), chạy đúng mã Worker trên SQLite thật.
const FREE_WRITES = 100_000
const FREE_READS = 5_000_000

let sqlite: typeof import('node:sqlite') | null = null
try {
  sqlite = await import('node:sqlite')
} catch {
  /* Node cũ không có node:sqlite: bỏ qua bài này */
}

describe.skipIf(!sqlite)('tải D1 một ngày dùng nhiều', () => {
  it('nằm xa dưới hạn mức miễn phí', async () => {
    const db = new sqlite!.DatabaseSync(':memory:')
    migrate(db)
    const meter: Meter = { statements: 0, rowsRead: 0, rowsWritten: 0 }
    const env = { DB: createD1(db, meter), ASSETS: { fetch: async () => new Response('') }, AI_FAKE: '1', MAX_VAULTS: '3' } as never
    const V = 'ab'.repeat(16)
    const auth = { Authorization: 'Bearer token-token-token-token-1234' }
    const call = async (path: string, init: RequestInit = {}) => {
      const res = await worker.fetch(new Request('http://x/api/v1/vaults/' + V + path, { ...init, headers: { ...auth, ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}) } }), env)
      if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`)
      return res
    }
    await call('', { method: 'POST' })

    const mark = () => ({ ...meter })
    const delta = (a: Meter, b: Meter) => ({ reads: b.rowsRead - a.rowsRead, writes: b.rowsWritten - a.rowsWritten })
    const steps: Record<string, { n: number; reads: number; writes: number }> = {}
    const run = async (name: string, n: number, fn: (i: number) => Promise<void>) => {
      const before = mark()
      for (let i = 0; i < n; i++) await fn(i)
      steps[name] = { n, ...delta(before, mark()) }
    }

    let seq = 0
    const body = 'x'.repeat(3000) // một ý tưởng dài đã mã hoá
    // 300 lần sửa, mỗi lần đẩy riêng một ý tưởng (60 ý tưởng khác nhau), và máy thứ hai kéo về
    await run('sửa và đẩy ý tưởng', 300, async (i) => {
      await call('/ideas', { method: 'POST', body: JSON.stringify({ rows: [{ id: 'idea-' + (i % 60), data: body, updatedAt: 1000 + i, deleted: false }] }) })
    })
    await run('máy kia kéo ý tưởng', 300, async () => {
      await call(`/ideas?after=${Math.max(0, seq)}&limit=50`)
      seq += 1
    })
    // hỏi nhẹ máy chủ mỗi 20 giây suốt 24 giờ
    await run('hỏi nhẹ (poll)', 4320, async () => void (await call('')))
    // 40 ảnh/ghi âm 60 KB
    await run('tải đính kèm', 40, async (i) => {
      await call(`/blobs/att-${i}`, { method: 'PUT', body: new Uint8Array(60_000) })
      await call('/attachments', { method: 'POST', body: JSON.stringify({ rows: [{ id: 'att-' + i, meta: 'm'.repeat(200), deleted: false }] }) })
    })
    // 30 lượt AI (hạn mức mặc định mỗi ngày)
    await run('AI giả', 30, async () => {
      await call('/ai/structure', { method: 'POST', body: JSON.stringify({ text: 'Ý tưởng app tìm bạn chạy bộ' }) })
    })
    // 20 ý tưởng bị xoá
    await run('xoá ý tưởng', 20, async (i) => {
      await call('/ideas', { method: 'POST', body: JSON.stringify({ rows: [{ id: 'idea-' + i, data: null, updatedAt: 9000 + i, deleted: true }] }) })
    })

    const total = { reads: meter.rowsRead, writes: meter.rowsWritten }
    const lines = Object.entries(steps).map(([k, v]) => `${k.padEnd(22)} ${String(v.n).padStart(5)} lần  ghi ${String(v.writes).padStart(6)}  đọc ${String(v.reads).padStart(6)}`)
    const report = [...lines, `${'TỔNG'.padEnd(22)}              ghi ${total.writes} (${((total.writes / FREE_WRITES) * 100).toFixed(1)}% hạn mức)  đọc ${total.reads} (${((total.reads / FREE_READS) * 100).toFixed(2)}% hạn mức)`].join('\n')
    if (process.env.D1_REPORT) writeFileSync(process.env.D1_REPORT, report + '\n')

    expect(total.writes).toBeLessThan(FREE_WRITES * 0.1)
    expect(total.reads).toBeLessThan(FREE_READS * 0.05)
    // dung lượng kho đếm đúng so với dữ liệu thật
    const head = (await (await call('')).json()) as { bytes: number }
    const real = Number((db.prepare('SELECT (SELECT COALESCE(SUM(LENGTH(data)),0) FROM ideas) + (SELECT COALESCE(SUM(LENGTH(meta)),0) FROM attachments) + (SELECT COALESCE(SUM(LENGTH(data)),0) FROM blobs) AS n').get() as { n: number }).n)
    expect(head.bytes).toBe(real)
  })
})
