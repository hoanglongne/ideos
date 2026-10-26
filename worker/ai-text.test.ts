import { describe, expect, it } from 'vitest'
import { briefText, extractJson, normCritique, normStructure } from './ai-text'

describe('xử lý câu trả lời của AI', () => {
  it('tách được JSON dù model bọc trong ```json và thêm lời dẫn', () => {
    expect(extractJson('Đây là kết quả:\n```json\n{"title": "A", "tags": ["x"]}\n```\nHy vọng có ích!')).toEqual({ title: 'A', tags: ['x'] })
  })
  it('báo lỗi khi không có JSON', () => {
    expect(() => extractJson('xin lỗi, tôi không hiểu')).toThrow()
  })
  it('làm sạch kết quả sắp xếp: loại sai, tag không dấu, cắt độ dài', () => {
    const s = normStructure({ title: '  App tìm bạn chạy bộ  ', kind: 'mobile', tags: ['#Thể Thao', 'Chạy bộ', 'thể thao', 42, 'a', 'b', 'c'], body: 'x'.repeat(2000) })
    expect(s.title).toBe('App tìm bạn chạy bộ')
    expect(s.kind).toBe('other')
    expect(s.tags).toEqual(['the-thao', 'chay-bo', 'a', 'b'])
    expect(s.body.length).toBe(800)
    expect(s.problem).toBe('')
  })
  it('làm sạch phản biện: nhận cả chuỗi lẫn object, rủi ro lạ thành 2, tối đa 5 mục', () => {
    const c = normCritique({ weaknesses: ['a', '', { text: 'b' }], assumptions: ['x', { text: 'y', risk: 3 }, { text: 'z', risk: 9 }], questions: 'không phải mảng' })
    expect(c.weaknesses).toEqual(['a', 'b'])
    expect(c.assumptions).toEqual([{ text: 'x', risk: 2 }, { text: 'y', risk: 3 }, { text: 'z', risk: 2 }])
    expect(c.questions).toEqual([])
  })
  it('tóm tắt ý tưởng cho model, bỏ phần trống, giới hạn độ dài', () => {
    const t = briefText({ title: 'T', body: '', canvas: { 'Vấn đề': 'đau', 'Người dùng': '' }, assumptions: ['a'], evidence: [], journal: ['j'.repeat(10000)] })
    expect(t).toContain('Vấn đề: đau')
    expect(t).not.toContain('Người dùng')
    expect(t.length).toBeLessThanOrEqual(6000)
  })
})
