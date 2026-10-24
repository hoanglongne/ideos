import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearAll, createDb, deleteIdea, newIdea, removeAttachment, restoreIdea, updateIdea, type IdeosDB } from '../db'
import { pendingCount, syncOnce } from './engine'
import { MemoryServer } from './memoryRemote'

let n = 0
let server: MemoryServer
let A: IdeosDB
let B: IdeosDB

beforeEach(async () => {
  server = new MemoryServer()
  A = createDb(`a${++n}`)
  B = createDb(`b${n}`)
  await Promise.all([A.open(), B.open()])
})

const sleep = (ms = 3) => new Promise((r) => setTimeout(r, ms))

describe('syncOnce', () => {
  it('đưa ý tưởng mới từ máy A sang máy B', async () => {
    const idea = newIdea({ title: 'App chạy bộ', tags: ['fitness'] })
    await A.ideas.add(idea)
    expect(await pendingCount(A)).toBe(1)

    const r = await syncOnce(A, server.remote('u1'))
    expect(r.pushed).toBe(1)
    expect(await pendingCount(A)).toBe(0)

    await syncOnce(B, server.remote('u1'))
    const got = await B.ideas.get(idea.id)
    expect(got?.title).toBe('App chạy bộ')
    expect(got?.tags).toEqual(['fitness'])
    expect(got?.dirty).toBe(0)
    expect(await pendingCount(B)).toBe(0)
  })

  it('sửa trên B rồi về lại A, không tạo vòng lặp đẩy', async () => {
    const idea = newIdea({ title: 'v1' })
    await A.ideas.add(idea)
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))

    await sleep()
    await updateIdea(idea.id, { title: 'v2', 'scores.impact': 8 }, B)
    await syncOnce(B, server.remote('u1'))
    await syncOnce(A, server.remote('u1'))

    const a = await A.ideas.get(idea.id)
    expect(a?.title).toBe('v2')
    expect(a?.scores.impact).toBe(8)
    expect(await pendingCount(A)).toBe(0)
    expect((await syncOnce(A, server.remote('u1'))).pushed).toBe(0)
  })

  it('xung đột: bản sửa sau cùng thắng bất kể thứ tự đồng bộ', async () => {
    const idea = newIdea({ title: 'gốc' })
    await A.ideas.add(idea)
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))

    // cả hai cùng sửa khi offline; B sửa sau
    await sleep()
    await updateIdea(idea.id, { title: 'của A' }, A)
    await sleep()
    await updateIdea(idea.id, { title: 'của B' }, B)

    // B đồng bộ trước, A sau → server phải giữ bản của B
    await syncOnce(B, server.remote('u1'))
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))

    expect((await A.ideas.get(idea.id))?.title).toBe('của B')
    expect((await B.ideas.get(idea.id))?.title).toBe('của B')
    expect(await pendingCount(A)).toBe(0)
  })

  it('liên kết ý tưởng cũng được tính là thay đổi mới', async () => {
    const x = newIdea({ title: 'x' })
    const y = newIdea({ title: 'y' })
    await A.ideas.bulkAdd([x, y])
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))
    await sleep()
    const { linkIdeas } = await import('../db')
    await linkIdeas(x.id, y.id, true, A)
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))
    expect((await B.ideas.get(x.id))?.related).toEqual([y.id])
    expect((await B.ideas.get(y.id))?.related).toEqual([x.id])
  })

  it('xoá lan sang máy khác, hoàn tác thì hiện lại', async () => {
    const idea = newIdea({ title: 'sẽ xoá' })
    await A.ideas.add(idea)
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))

    await sleep()
    const snap = await deleteIdea(idea.id, A)
    await syncOnce(A, server.remote('u1'))
    expect(await A.tombstones.count()).toBe(0)
    await syncOnce(B, server.remote('u1'))
    expect(await B.ideas.get(idea.id)).toBeUndefined()

    await sleep()
    await restoreIdea(snap, A)
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))
    expect((await B.ideas.get(idea.id))?.title).toBe('sẽ xoá')
  })

  it('bản sửa mới hơn lần xoá thì không bị xoá', async () => {
    const idea = newIdea({ title: 'gốc' })
    await A.ideas.add(idea)
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))

    await sleep()
    await deleteIdea(idea.id, A)
    await sleep()
    await updateIdea(idea.id, { title: 'B vẫn sửa' }, B)
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))
    await syncOnce(A, server.remote('u1'))
    expect((await A.ideas.get(idea.id))?.title).toBe('B vẫn sửa')
  })

  it('không mất chỉnh sửa xảy ra đúng lúc đang đẩy', async () => {
    const idea = newIdea({ title: 'v1' })
    await A.ideas.add(idea)
    const remote = server.remote('u1')
    const push = remote.pushIdeas
    remote.pushIdeas = async (rows) => {
      await push(rows)
      await sleep()
      await updateIdea(idea.id, { title: 'v2 lúc đang đẩy' }, A)
    }
    await syncOnce(A, remote)
    expect((await A.ideas.get(idea.id))?.dirty).toBe(1)
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))
    expect((await B.ideas.get(idea.id))?.title).toBe('v2 lúc đang đẩy')
  })

  it('đồng bộ đính kèm (ảnh/ghi âm) và việc xoá đính kèm', async () => {
    const idea = newIdea({ title: 'có ảnh' })
    await A.ideas.add(idea)
    await A.attachments.add({ id: 'att1', ideaId: idea.id, type: 'audio', mime: 'audio/webm', blob: new Blob(['hello']), createdAt: 1, duration: 3.5 })
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))

    const att = await B.attachments.get('att1')
    expect(att?.duration).toBe(3.5)
    expect(await att!.blob.text()).toBe('hello')
    expect(await pendingCount(B)).toBe(0)

    await removeAttachment('att1', B)
    await syncOnce(B, server.remote('u1'))
    expect(server.blobs.size).toBe(0)
    await syncOnce(A, server.remote('u1'))
    expect(await A.attachments.get('att1')).toBeUndefined()
  })

  it('tải file lỗi thì thử lại ở lần sau', async () => {
    await A.attachments.add({ id: 'p1', ideaId: 'x', type: 'image', mime: 'image/png', blob: new Blob(['img']), createdAt: 1 })
    await syncOnce(A, server.remote('u1'))

    await syncOnce(B, server.remote('u1', { failDownloads: new Set(['p1']) }))
    expect(await B.attachments.get('p1')).toBeUndefined()
    // con trỏ không được vượt qua hàng lỗi
    expect(await B.meta.get('sync.attsCursor')).toBeUndefined()
    await syncOnce(B, server.remote('u1'))
    expect(await (await B.attachments.get('p1'))!.blob.text()).toBe('img')
  })

  it('dữ liệu tài khoản khác không lẫn vào nhau; đổi tài khoản thì gộp dữ liệu máy vào', async () => {
    await A.ideas.add(newIdea({ title: 'của u1' }))
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u2'))
    expect(await B.ideas.count()).toBe(0)

    await B.ideas.add(newIdea({ title: 'của B' }))
    await syncOnce(B, server.remote('u2'))
    await syncOnce(B, server.remote('u1')) // B đăng nhập u1
    await syncOnce(A, server.remote('u1'))
    expect((await A.ideas.toArray()).map((i) => i.title).sort()).toEqual(['của B', 'của u1'])
  })

  it('xoá tất cả "mọi nơi" lan sang máy khác, "chỉ máy này" thì không', async () => {
    await A.ideas.bulkAdd([newIdea({ title: '1' }), newIdea({ title: '2' })])
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))

    await clearAll(false, B)
    await syncOnce(B, server.remote('u1'))
    expect(await B.ideas.count()).toBe(2) // kéo lại từ server
    await syncOnce(A, server.remote('u1'))
    expect(await A.ideas.count()).toBe(2)

    await sleep()
    await clearAll(true, A)
    await syncOnce(A, server.remote('u1'))
    await syncOnce(B, server.remote('u1'))
    expect(await B.ideas.count()).toBe(0)
  })
})
