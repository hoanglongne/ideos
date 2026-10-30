import { describe, expect, it } from 'vitest'
import { newIdea } from '../db'
import type { Assumption, Idea } from '../types'
import { deepEqual, mergeThreeWay, sameContent } from './merge'

const base = (over: Partial<Idea> = {}): Idea => ({ ...newIdea({ id: 'i1', title: 'gốc', createdAt: 1, updatedAt: 10 }), ...over })
const as = (id: string, over: Partial<Assumption> = {}): Assumption => ({ id, text: id, risk: 2, test: '', status: 'untested', createdAt: 1, ...over })

describe('deepEqual', () => {
  it('so sánh sâu, bỏ qua khoá undefined, phân biệt thứ tự mảng', () => {
    expect(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true)
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual(null, {})).toBe(false)
  })
})

describe('mergeThreeWay', () => {
  it('trường nào chỉ một bên đổi thì lấy bên đó', () => {
    const b = base()
    const l = base({ title: 'từ local', updatedAt: 20 })
    const r = base({ body: 'từ remote', updatedAt: 30 })
    const m = mergeThreeWay(b, l, r)
    expect([m.title, m.body]).toEqual(['từ local', 'từ remote'])
    expect(m.updatedAt).toBe(30)
  })
  it('cả hai đổi cùng trường: bản mới hơn thắng, theo thứ tự nào cũng vậy', () => {
    const b = base()
    const l = base({ title: 'L', updatedAt: 20 })
    const r = base({ title: 'R', updatedAt: 30 })
    expect(mergeThreeWay(b, l, r).title).toBe('R')
    expect(mergeThreeWay(b, { ...l, updatedAt: 40 }, r).title).toBe('L')
  })
  it('đối tượng lồng (canvas, scores) gộp theo từng ô', () => {
    const b = base()
    const l = base({ canvas: { ...b.canvas, problem: 'p-L' }, scores: { ...b.scores, impact: 7 }, updatedAt: 20 })
    const r = base({ canvas: { ...b.canvas, audience: 'a-R' }, scores: { ...b.scores, ease: 4 }, updatedAt: 30 })
    const m = mergeThreeWay(b, l, r)
    expect(m.canvas.problem).toBe('p-L')
    expect(m.canvas.audience).toBe('a-R')
    expect([m.scores.impact, m.scores.ease]).toEqual([7, 4])
  })
  it('mảng đơn giản (tag, liên kết) gộp theo tập: thêm của hai bên, xoá của một bên', () => {
    const b = base({ tags: ['a', 'b', 'c'] })
    const l = base({ tags: ['a', 'b', 'c', 'd'], updatedAt: 20 }) // thêm d
    const r = base({ tags: ['a', 'c', 'e'], updatedAt: 30 }) // xoá b, thêm e
    expect([...mergeThreeWay(b, l, r).tags].sort()).toEqual(['a', 'c', 'd', 'e'])
  })
  it('danh sách có id: thêm ở hai bên thì hợp lại, nhật ký xếp theo giờ', () => {
    const b = base()
    const l = base({ journal: [{ id: 'j2', at: 200, kind: 'note', text: 'L' }], updatedAt: 20 })
    const r = base({ journal: [{ id: 'j1', at: 100, kind: 'note', text: 'R' }], updatedAt: 30 })
    expect(mergeThreeWay(b, l, r).journal.map((j) => j.id)).toEqual(['j1', 'j2'])
  })
  it('xoá một mục: bên kia chưa động tới thì mất; đã sửa thì giữ', () => {
    const b = base({ assumptions: [as('x'), as('y')] })
    const deleted = base({ assumptions: [as('y')], updatedAt: 20 })
    const untouched = base({ assumptions: [as('x'), as('y')], updatedAt: 30 })
    expect(mergeThreeWay(b, deleted, untouched).assumptions.map((x) => x.id)).toEqual(['y'])
    expect(mergeThreeWay(b, untouched, deleted).assumptions.map((x) => x.id)).toEqual(['y'])
    const edited = base({ assumptions: [as('x', { status: 'holds' }), as('y')], updatedAt: 30 })
    expect(mergeThreeWay(b, deleted, edited).assumptions.map((x) => [x.id, x.status])).toEqual([['y', 'untested'], ['x', 'holds']])
  })
  it('một mục: sửa hai trường khác nhau ở hai bên thì giữ cả hai', () => {
    const b = base({ assumptions: [as('x')] })
    const l = base({ assumptions: [as('x', { test: 'hỏi 5 người' })], updatedAt: 20 })
    const r = base({ assumptions: [as('x', { status: 'testing' })], updatedAt: 30 })
    expect(mergeThreeWay(b, l, r).assumptions[0]).toMatchObject({ test: 'hỏi 5 người', status: 'testing' })
  })
  it('trường mới xuất hiện ở một bên (money) được giữ', () => {
    const b = base()
    const l = base({ updatedAt: 20 })
    const r = base({ money: { inputs: { price: 5 } as never, assumed: [] }, updatedAt: 30 })
    expect(mergeThreeWay(b, l, r).money).toEqual(r.money)
  })
  it('không thay đổi gì ở máy này thì ra đúng bản từ máy chủ', () => {
    const b = base()
    const r = base({ title: 'remote', tags: ['x'], updatedAt: 30 })
    expect(sameContent(mergeThreeWay(b, b, r), r)).toBe(true)
  })
})
