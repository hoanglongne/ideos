import { describe, expect, it } from 'vitest'
import { attachmentsDelta, capBytes, exceeds, ideasDelta } from './quota'

const idea = (id: string, len: number, updatedAt: number, deleted = false) => ({ id, data: deleted ? null : 'x'.repeat(len), updatedAt, deleted })

describe('ideasDelta', () => {
  it('ý tưởng mới cộng đúng độ dài', () => {
    expect(ideasDelta([idea('a', 100, 1), idea('b', 50, 1)], new Map())).toBe(150)
  })
  it('ghi đè bản cũ chỉ cộng phần chênh', () => {
    expect(ideasDelta([idea('a', 80, 5)], new Map([['a', { n: 100, updatedAt: 1 }]]))).toBe(-20)
  })
  it('bản cũ hơn bị máy chủ bỏ qua nên không tính', () => {
    expect(ideasDelta([idea('a', 500, 1)], new Map([['a', { n: 100, updatedAt: 9 }]]))).toBe(0)
  })
  it('xoá thì trừ cả bản đang có', () => {
    expect(ideasDelta([idea('a', 0, 5, true)], new Map([['a', { n: 100, updatedAt: 1 }]]))).toBe(-100)
  })
  it('cùng id hai lần trong một lần gửi thì tính tuần tự', () => {
    expect(ideasDelta([idea('a', 100, 1), idea('a', 40, 2)], new Map())).toBe(40)
    expect(ideasDelta([idea('a', 100, 5), idea('a', 40, 2)], new Map())).toBe(100)
  })
})

describe('attachmentsDelta', () => {
  it('luôn ghi đè', () => {
    expect(attachmentsDelta([{ id: 'a', meta: 'x'.repeat(30), deleted: false }], new Map([['a', 10]]))).toBe(20)
    expect(attachmentsDelta([{ id: 'a', meta: null, deleted: true }], new Map([['a', 10]]))).toBe(-10)
  })
})

describe('trần dung lượng', () => {
  it('đọc MAX_VAULT_MB, mặc định 300 MB', () => {
    expect(capBytes(undefined)).toBe(300_000_000)
    expect(capBytes('50')).toBe(50_000_000)
    expect(capBytes('abc')).toBe(300_000_000)
  })
  it('ghi thêm vượt trần thì chặn, xoá bớt thì luôn cho', () => {
    expect(exceeds(99, 2, 100)).toBe(true)
    expect(exceeds(99, 1, 100)).toBe(false)
    expect(exceeds(150, -10, 100)).toBe(false) // kho đã vượt (vì hạ trần) vẫn dọn được
    expect(exceeds(150, 0, 100)).toBe(false)
  })
})
