import type { Currency } from './models'

const vnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const dec = (v: number, digits = 1) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(v)

/** 1.234.567 đ  hoặc  $1,234.56 */
export function money(v: number, cur: Currency): string {
  if (!Number.isFinite(v)) return '—'
  const neg = v < 0 ? '−' : ''
  const a = Math.abs(v)
  if (cur === 'VND') return `${neg}${vnd.format(Math.round(a))} đ`
  return `${neg}$${a.toLocaleString('en-US', { minimumFractionDigits: a < 100 ? 2 : 0, maximumFractionDigits: a < 100 ? 2 : 0 })}`
}

/** Rút gọn cho ô nhỏ: 1,2 tr · 350k · $1.2k */
export function moneyShort(v: number, cur: Currency): string {
  if (!Number.isFinite(v)) return '—'
  const neg = v < 0 ? '−' : ''
  const a = Math.abs(v)
  if (a === 0) return cur === 'VND' ? '0 đ' : '$0'
  if (cur === 'VND') {
    if (a >= 1e9) return `${neg}${dec(a / 1e9)} tỷ`
    if (a >= 1e6) return `${neg}${dec(a / 1e6)} tr`
    if (a >= 1e3) return `${neg}${dec(a / 1e3, 0)}k`
    return `${neg}${vnd.format(a)} đ`
  }
  if (a >= 1e6) return `${neg}$${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${neg}$${(a / 1e3).toFixed(1)}k`
  return `${neg}$${a.toFixed(a < 10 ? 2 : 0)}`
}

export const num = (v: number, digits = 0) => dec(v, digits)
