import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { addJournal, clearAll, createDb, deleteIdea, newIdea, removeAttachment, restoreIdea, updateIdea, type IdeosDB } from '../db'
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
    expect(await B.meta.get('sync.attsSeq')).toBeUndefined()
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

  describe('gộp khi hai máy cùng sửa lúc chưa đồng bộ', () => {
    const setup = async () => {
      const idea = newIdea({ title: 'gốc' })
      await A.ideas.add(idea)
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      return idea
    }
    const both = async (id: string) => [(await A.ideas.get(id))!, (await B.ideas.get(id))!]

    it('điện thoại ghi thêm nhật ký, laptop sửa tiêu đề sau: giữ cả hai', async () => {
      const idea = await setup()
      await sleep()
      await addJournal(idea.id, 'nghĩ thêm lúc đi bộ', 'note', B)
      await sleep()
      await updateIdea(idea.id, { title: 'tiêu đề mới' }, A)
      await syncOnce(B, server.remote('u1'))
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      for (const i of await both(idea.id)) {
        expect(i.title).toBe('tiêu đề mới')
        expect(i.journal.map((j) => j.text)).toEqual(['nghĩ thêm lúc đi bộ'])
      }
      expect(await pendingCount(A)).toBe(0)
      expect(await pendingCount(B)).toBe(0)
    })

    it('laptop sửa tiêu đề trước, điện thoại ghi nhật ký sau, laptop đồng bộ trước: vẫn giữ cả hai', async () => {
      const idea = await setup()
      await sleep()
      await updateIdea(idea.id, { title: 'tiêu đề mới' }, A)
      await sleep()
      await addJournal(idea.id, 'ghi trên điện thoại', 'note', B)
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      await syncOnce(A, server.remote('u1'))
      for (const i of await both(idea.id)) {
        expect(i.journal.map((j) => j.text)).toEqual(['ghi trên điện thoại'])
        // tiêu đề chỉ laptop sửa, điện thoại không đụng tới: dù bản của điện thoại "mới hơn" cả ý tưởng, tiêu đề mới không được mất
        expect(i.title).toBe('tiêu đề mới')
      }
    })

    it('sửa các trường khác nhau trên hai máy: giữ cả hai, bất kể máy nào sửa sau', async () => {
      const idea = await setup()
      await sleep()
      await updateIdea(idea.id, { title: 'tên mới từ A', 'canvas.problem': 'vấn đề từ A' }, A)
      await sleep()
      await updateIdea(idea.id, { body: 'mô tả từ B', 'scores.impact': 9 }, B)
      await syncOnce(B, server.remote('u1'))
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      for (const i of await both(idea.id)) {
        expect(i.title).toBe('tên mới từ A')
        expect(i.canvas.problem).toBe('vấn đề từ A')
        expect(i.body).toBe('mô tả từ B')
        expect(i.scores.impact).toBe(9)
      }
      expect(await pendingCount(A)).toBe(0)
      expect(await pendingCount(B)).toBe(0)
    })

    it('cùng sửa MỘT trường: bản sửa sau thắng, trường khác của bên thua vẫn giữ', async () => {
      const idea = await setup()
      await sleep()
      await updateIdea(idea.id, { title: 'A đặt', body: 'mô tả của A' }, A)
      await sleep()
      await updateIdea(idea.id, { title: 'B đặt' }, B)
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      await syncOnce(A, server.remote('u1'))
      for (const i of await both(idea.id)) {
        expect(i.title).toBe('B đặt')
        expect(i.body).toBe('mô tả của A')
      }
    })

    it('tag và giả định: thêm ở hai máy thì hợp lại, xoá ở một máy (bên kia chưa động tới) thì mất', async () => {
      const idea = await setup()
      const as = (id: string, text: string) => ({ id, text, risk: 2 as const, test: '', status: 'untested' as const, createdAt: 1 })
      await updateIdea(idea.id, { tags: ['a', 'b'], assumptions: [as('x', 'giả định x'), as('y', 'giả định y')] }, A)
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      await sleep()
      // A: thêm tag c, xoá giả định x. B: thêm tag d, sửa trạng thái giả định y
      await updateIdea(idea.id, { tags: ['a', 'b', 'c'], assumptions: [as('y', 'giả định y')] }, A)
      await sleep()
      await updateIdea(idea.id, { tags: ['a', 'b', 'd'], assumptions: [as('x', 'giả định x'), { ...as('y', 'giả định y'), status: 'holds' as const }] }, B)
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      await syncOnce(A, server.remote('u1'))
      for (const i of await both(idea.id)) {
        expect([...i.tags].sort()).toEqual(['a', 'b', 'c', 'd'])
        // x: A xoá, B không đổi → mất. y: chỉ B sửa → giữ bản của B
        expect(i.assumptions.map((x) => [x.id, x.status])).toEqual([['y', 'holds']])
      }
    })

    it('một mục: A sửa chữ, B đổi trạng thái → cả hai giữ; A xoá mục mà B đã sửa → mục được giữ', async () => {
      const idea = await setup()
      const as = (over = {}) => ({ id: 'x', text: 'gốc', risk: 2 as const, test: '', status: 'untested' as const, createdAt: 1, ...over })
      await updateIdea(idea.id, { assumptions: [as()] }, A)
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      await sleep()
      await updateIdea(idea.id, { assumptions: [as({ test: 'hỏi 5 người' })] }, A)
      await sleep()
      await updateIdea(idea.id, { assumptions: [as({ status: 'testing' })] }, B)
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      await syncOnce(A, server.remote('u1'))
      for (const i of await both(idea.id)) expect(i.assumptions.map((x) => [x.test, x.status])).toEqual([['hỏi 5 người', 'testing']])

      await sleep()
      await updateIdea(idea.id, { assumptions: [] }, A) // A xoá
      await sleep()
      await updateIdea(idea.id, { assumptions: [as({ test: 'hỏi 5 người', status: 'holds' })] }, B) // B vừa sửa
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      await syncOnce(A, server.remote('u1'))
      for (const i of await both(idea.id)) expect(i.assumptions.map((x) => x.status)).toEqual(['holds'])
    })

    it('bài toán tiền: A đổi giá, B đổi chi phí kéo khách → giữ cả hai', async () => {
      const idea = await setup()
      const money = (price: number, cac: number) => ({ inputs: { model: 'saas', currency: 'VND', price, cac } as never, assumed: ['price', 'cac'] as never })
      await updateIdea(idea.id, { money: money(100, 10) }, A)
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      await sleep()
      await updateIdea(idea.id, { money: { ...money(250, 10), assumed: ['cac'] as never } }, A)
      await sleep()
      await updateIdea(idea.id, { money: { ...money(100, 77), assumed: ['price'] as never } }, B)
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      await syncOnce(A, server.remote('u1'))
      for (const i of await both(idea.id)) {
        expect((i.money!.inputs as unknown as { price: number }).price).toBe(250)
        expect((i.money!.inputs as unknown as { cac: number }).cac).toBe(77)
      }
    })

    it('chưa có bản gốc (dữ liệu cũ): quay về cách gộp cũ, vẫn không mất nhật ký', async () => {
      const idea = await setup()
      await A.bases.clear()
      await sleep()
      await updateIdea(idea.id, { title: 'A sửa' }, A)
      await sleep()
      await addJournal(idea.id, 'B ghi', 'note', B)
      await syncOnce(B, server.remote('u1'))
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      for (const i of await both(idea.id)) expect(i.journal.map((j) => j.text)).toEqual(['B ghi'])
    })

    it('hai máy cùng thêm giả định và nhật ký: hợp lại đủ, theo thứ tự thời gian', async () => {
      const idea = await setup()
      await sleep()
      await addJournal(idea.id, 'A1', 'note', A)
      await updateIdea(idea.id, { assumptions: [{ id: 'as-a', text: 'người ta chịu trả tiền', risk: 3, test: '', status: 'untested', createdAt: 1 }] }, A)
      await sleep()
      await addJournal(idea.id, 'B1', 'note', B)
      await updateIdea(idea.id, { evidence: [{ id: 'ev-b', at: 2, text: '3/5 người nói có', source: 'phỏng vấn', signal: 'for' }] }, B)
      await syncOnce(A, server.remote('u1'))
      await syncOnce(B, server.remote('u1'))
      await syncOnce(A, server.remote('u1'))
      for (const i of await both(idea.id)) {
        expect(i.journal.map((j) => j.text)).toEqual(['A1', 'B1'])
        expect(i.assumptions.map((x) => x.id)).toEqual(['as-a'])
        expect(i.evidence.map((x) => x.id)).toEqual(['ev-b'])
      }
    })

    it('ý tưởng kiểu cũ từ máy chưa cập nhật (không có nhật ký) vẫn đọc được', async () => {
      const old = newIdea({ title: 'kiểu cũ' }) as Partial<ReturnType<typeof newIdea>>
      delete old.journal
      delete old.assumptions
      delete old.evidence
      await server.remote('u1').pushIdeas([{ id: old.id!, data: old as never, updatedAt: old.updatedAt!, deleted: false }])
      await syncOnce(B, server.remote('u1'))
      const got = await B.ideas.get(old.id!)
      expect(got?.journal).toEqual([])
      expect(got?.assumptions).toEqual([])
    })
  })
})
