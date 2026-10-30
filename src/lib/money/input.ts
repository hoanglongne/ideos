// Đọc và kiểm tra số người dùng gõ vào ô của bài toán tiền.
// Người Việt gõ "1.500.000" (dấu chấm là dấu nghìn), "1,5" (dấu phẩy là phần thập phân), "500k", "1,5tr".

import type { InputKey } from './models'

const SUFFIX: [RegExp, number][] = [
  [/(tỷ|ty|ti|b)$/, 1e9],
  [/(triệu|trieu|tr|m)$/, 1e6],
  [/(nghìn|nghin|ngàn|ngan|k)$/, 1e3],
]

/**
 * Đọc một số. `money`: một dấu phân cách đứng trước đúng 3 chữ số là dấu nghìn ("1.500" = 1500);
 * với tỉ lệ và số đếm thì đó là phần thập phân ("1,500" = 1,5). Không đọc được thì trả null.
 */
export function parseNumber(raw: string, opts: { money?: boolean } = {}): number | null {
  let s = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null
  let mult = 1
  let suffixed = false
  for (const [re, m] of SUFFIX) {
    if (re.test(s)) {
      mult = m
      suffixed = true
      s = s.replace(re, '')
      break
    }
  }
  s = s.replace(/[đd₫$]$/, '')
  if (!s || !/^[0-9.,]+$/.test(s) || /^[.,]|[.,]$/.test(s)) return null
  const dots = (s.match(/\./g) ?? []).length
  const commas = (s.match(/,/g) ?? []).length
  let normalized: string
  if (dots && commas) {
    // cả hai: dấu đứng cuối là phần thập phân, dấu còn lại là dấu nghìn
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
    const thou = dec === '.' ? ',' : '.'
    if (s.split(dec).length > 2 || s.split(thou).some((p, k, a) => (k > 0 && k < a.length - 1 ? p.length !== 3 : false))) return null
    normalized = s.split(thou).join('').replace(dec, '.')
  } else if (dots > 1 || commas > 1) {
    const sep = dots > 1 ? '.' : ','
    const parts = s.split(sep)
    if (parts.slice(1).some((p) => p.length !== 3)) return null
    normalized = parts.join('')
  } else if (dots || commas) {
    const sep = dots ? '.' : ','
    const [head, tail] = s.split(sep)
    const thousands = opts.money && !suffixed && tail.length === 3 && head.length >= 1 && head.length <= 3
    normalized = thousands ? head + tail : head + '.' + tail
  } else normalized = s
  const n = Number(normalized) * mult
  return Number.isFinite(n) ? n : null
}

interface Limit {
  min: number
  max: number
  int?: boolean
  /** Giải thích khi vượt khoảng, nói theo nghĩa của ô */
  hint: string
}

const BIG = 1e13

export const LIMITS: Record<InputKey, Limit> = {
  model: { min: 0, max: 0, hint: '' },
  currency: { min: 0, max: 0, hint: '' },
  goal_type: { min: 0, max: 0, hint: '' },
  price: { min: 0, max: BIG, hint: 'Giá không âm và không quá 10.000 tỷ.' },
  orders_per_month: { min: 0, max: 1000, hint: 'Từ 0 đến 1.000 lần mỗi tháng.' },
  repeat_pct: { min: 0, max: 99, hint: 'Từ 0 đến 99%: nếu ai cũng mua lại mãi mãi thì giá trị một khách là vô hạn, app không tính được.' },
  take_rate_pct: { min: 0, max: 100, hint: 'Từ 0 đến 100%.' },
  churn_pct: { min: 0, max: 100, hint: 'Từ 0 đến 100%: tối đa là cả tháng ai cũng rời đi.' },
  var_cost_pct: { min: 0, max: 200, hint: 'Từ 0 đến 200% doanh thu.' },
  fee_pct: { min: 0, max: 100, hint: 'Từ 0 đến 100%.' },
  tax_pct: { min: 0, max: 100, hint: 'Từ 0 đến 100%.' },
  fixed_cost: { min: 0, max: BIG, hint: 'Chi phí không âm và không quá 10.000 tỷ.' },
  cac: { min: 0, max: BIG, hint: 'Chi phí không âm và không quá 10.000 tỷ.' },
  marketing_budget: { min: 0, max: BIG, hint: 'Ngân sách không âm và không quá 10.000 tỷ.' },
  organic_new: { min: 0, max: 1e7, hint: 'Từ 0 đến 10 triệu khách mỗi tháng.' },
  start_customers: { min: 0, max: 1e9, hint: 'Từ 0 đến 1 tỷ khách.' },
  start_cash: { min: 0, max: BIG, hint: 'Vốn không âm và không quá 10.000 tỷ.' },
  goal_amount: { min: 0, max: BIG, hint: 'Số tiền không âm và không quá 10.000 tỷ.' },
  horizon: { min: 1, max: 120, int: true, hint: 'Từ 1 đến 120 tháng (tối đa 10 năm).' },
}

export type InputCheck = { ok: true; value: number } | { ok: false; message: string }

/** Đọc chữ người dùng gõ và kiểm tra theo khoảng của ô. Không hợp lệ thì nói rõ vì sao, không âm thầm cắt. */
export function checkInput(key: InputKey, raw: string, money: boolean): InputCheck {
  const n = parseNumber(raw, { money })
  if (n == null) return { ok: false, message: money ? 'Chưa hiểu số này. Gõ như 1.500.000, 1,5tr hoặc 500k.' : 'Chưa hiểu số này. Gõ một con số như 12 hoặc 2,5.' }
  const l = LIMITS[key]
  if (n < l.min || n > l.max) return { ok: false, message: l.hint }
  if (l.int && !Number.isInteger(n)) return { ok: false, message: l.hint }
  return { ok: true, value: n }
}
