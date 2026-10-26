import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { db, newIdea } from '../db'
import { importJson } from './backup'

it('khôi phục từ file sao lưu đánh dấu ý tưởng là "chờ đồng bộ", kể cả khi ghi đè bản đã đồng bộ', async () => {
  const idea = newIdea({ title: 'cũ' })
  await db.ideas.add(idea)
  // giả lập: ý tưởng đã được máy chủ xác nhận
  await db.ideas.where('id').equals(idea.id).modify({ _remote: true } as never)
  expect((await db.ideas.get(idea.id))!.dirty).toBe(0)

  const backup = { app: 'ideos', version: 1, exportedAt: Date.now(), ideas: [{ ...idea, title: 'từ bản sao lưu', updatedAt: idea.updatedAt + 1000 }], attachments: [] }
  const r = await importJson(new Blob([JSON.stringify(backup)]))
  expect(r.updated).toBe(1)
  const got = (await db.ideas.get(idea.id))!
  expect(got.title).toBe('từ bản sao lưu')
  expect(got.dirty).toBe(1)
  expect('_remote' in got).toBe(false)
})
