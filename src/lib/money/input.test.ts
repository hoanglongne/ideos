import { describe, expect, it } from 'vitest'
import { checkInput, parseNumber } from './input'

const m = { money: true }

describe('parseNumber', () => {
  it('số kiểu Việt: dấu chấm là dấu nghìn', () => {
    expect(parseNumber('1.500.000', m)).toBe(1_500_000)
    expect(parseNumber('1.500', m)).toBe(1500)
    expect(parseNumber('12.345.678', m)).toBe(12_345_678)
  })
  it('số kiểu Anh: dấu phẩy là dấu nghìn, dấu chấm là thập phân', () => {
    expect(parseNumber('1,500,000', m)).toBe(1_500_000)
    expect(parseNumber('1,500.5', m)).toBe(1500.5)
    expect(parseNumber('1.500,5', m)).toBe(1500.5)
  })
  it('một dấu: tiền thì 3 chữ số sau là dấu nghìn, còn lại là thập phân', () => {
    expect(parseNumber('1,5', m)).toBe(1.5)
    expect(parseNumber('0.15')).toBe(0.15)
    expect(parseNumber('1,500')).toBe(1.5) // tỉ lệ hoặc số đếm: thập phân
    expect(parseNumber('1,500', m)).toBe(1500)
    expect(parseNumber('19.99', m)).toBe(19.99)
  })
  it('hậu tố k, tr, tỷ, kèm đơn vị', () => {
    expect(parseNumber('500k', m)).toBe(500_000)
    expect(parseNumber('1,5tr', m)).toBe(1_500_000)
    expect(parseNumber('1.5 triệu', m)).toBe(1_500_000)
    expect(parseNumber('2 tỷ', m)).toBe(2e9)
    expect(parseNumber('350.000 đ', m)).toBe(350_000)
  })
  it('khoảng trắng và số trơn', () => {
    expect(parseNumber(' 1 500 000 ', m)).toBe(1_500_000)
    expect(parseNumber('42')).toBe(42)
    expect(parseNumber('0')).toBe(0)
  })
  it('không đọc được thì trả null', () => {
    for (const bad of ['', 'abc', '1.2.3', '1..5', ',5', '5,', '1.50.000', '--1', '-5', '1e5', '12a']) expect(parseNumber(bad, m), bad).toBeNull()
  })
})

describe('checkInput', () => {
  it('nhận số hợp lệ', () => {
    expect(checkInput('price', '1.500.000', true)).toEqual({ ok: true, value: 1_500_000 })
    expect(checkInput('churn_pct', '5,5', false)).toEqual({ ok: true, value: 5.5 })
  })
  it('từ chối vượt khoảng và nói lý do', () => {
    const r = checkInput('churn_pct', '500', false)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.message).toMatch(/0 đến 100/)
    const h = checkInput('horizon', '0', false)
    expect(h.ok).toBe(false)
    expect(checkInput('horizon', '121', false).ok).toBe(false)
    expect(checkInput('horizon', '12,5', false).ok).toBe(false)
    expect(checkInput('horizon', '36', false)).toEqual({ ok: true, value: 36 })
  })
  it('mua lại 100% bị từ chối kèm giải thích thay vì bị cắt im lặng', () => {
    const r = checkInput('repeat_pct', '100', false)
    expect(!r.ok && r.message).toMatch(/vô hạn/)
  })
  it('chữ rác báo chưa hiểu', () => {
    const r = checkInput('price', 'một triệu', true)
    expect(!r.ok && r.message).toMatch(/Chưa hiểu/)
  })
})
