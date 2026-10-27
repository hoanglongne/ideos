// Con số nào làm đổ kế hoạch nhanh nhất? Làm xấu từng con số đi 30% rồi xem tiền cuối kỳ tụt bao nhiêu.
// Kết quả đổi thẳng thành giả định có mức rủi ro: đây là cái cần kiểm chứng trước.

import { money, moneyShort, num } from './format'
import { MODELS, type InputKey, type PlanInputs, type PlanMode } from './models'
import { simulate, summarize, type PlanSummary } from './plan'

/** Mức làm xấu mỗi con số khi thử */
export const WORSEN = 0.3

interface Driver {
  key: InputKey
  label: string
  /** -1: giảm là xấu (giá, mua lại…); +1: tăng là xấu (chi phí, khách rời đi…) */
  dir: 1 | -1
  modes: PlanMode[]
  claim: (i: PlanInputs) => string
  test: string
}

const ALL: PlanMode[] = ['subscription', 'transaction', 'marketplace', 'audience']

const DRIVERS: Driver[] = [
  {
    key: 'price',
    label: 'Giá',
    dir: -1,
    modes: ALL,
    claim: (i) => (MODELS[i.model].planMode === 'audience' ? `Mỗi 1.000 lượt xem mang về ${money(i.price, i.currency)}` : `Khách chịu trả ${money(i.price, i.currency)} ${MODELS[i.model].priceUnit}`),
    test: 'Hỏi 10 người đúng đối tượng. Chỉ tính người chịu đặt cọc hoặc trả trước ở mức giá này, không tính người chỉ nói "nghe hay đấy".',
  },
  {
    key: 'churn_pct',
    label: 'Khách rời đi mỗi tháng',
    dir: 1,
    modes: ['subscription', 'audience'],
    claim: (i) => `Mỗi tháng không quá ${num(i.churn_pct, 1)}% ${MODELS[i.model].customer} rời đi`,
    test: 'Theo dõi 10–20 khách đầu tiên trong 2–3 tháng. Hỏi từng người bỏ đi vì sao.',
  },
  {
    key: 'repeat_pct',
    label: 'Khách mua lại',
    dir: -1,
    modes: ['transaction', 'marketplace'],
    claim: (i) => `Ít nhất ${num(i.repeat_pct, 0)}% ${MODELS[i.model].customer} mua lại`,
    test: 'Xem 20 khách đầu: bao nhiêu người mua lần hai mà không cần giảm giá?',
  },
  {
    key: 'orders_per_month',
    label: 'Mức dùng mỗi khách',
    dir: -1,
    modes: ['transaction', 'marketplace', 'audience'],
    claim: (i) =>
      MODELS[i.model].planMode === 'audience' ? `Mỗi người xem khoảng ${num(i.orders_per_month, 1)} lượt mỗi tháng` : `Mỗi ${MODELS[i.model].customer} mua khoảng ${num(i.orders_per_month, 2)} lần mỗi tháng khi còn mua`,
    test: 'Ghi lại tần suất mua thật của 10 khách đầu. Đừng hỏi họ "bao lâu bạn sẽ mua một lần", người ta hay nói quá.',
  },
  {
    key: 'take_rate_pct',
    label: 'Phí sàn giữ lại',
    dir: -1,
    modes: ['marketplace'],
    claim: (i) => `Giữ được ${num(i.take_rate_pct, 1)}% mỗi giao dịch mà người bán không bỏ đi`,
    test: 'Hỏi 10 người bán xem họ có chịu mức phí này không, hay sẽ chuyển giao dịch ra ngoài sàn.',
  },
  {
    key: 'cac',
    label: 'Chi phí kéo một khách',
    dir: 1,
    modes: ALL,
    claim: (i) => `Kéo được một ${MODELS[i.model].customer} trả tiền với chi phí không quá ${money(i.cac, i.currency)}`,
    test: 'Chạy thử một kênh nhỏ (vài trăm nghìn) và đếm số người thực sự trả tiền, không đếm lượt bấm.',
  },
  {
    key: 'var_cost_pct',
    label: 'Chi phí biến đổi',
    dir: 1,
    modes: ALL,
    claim: (i) => `Chi phí biến đổi chỉ khoảng ${num(i.var_cost_pct, 0)}% doanh thu`,
    test: 'Làm thử 5 đơn hoặc 5 khách bằng tay và cộng đủ chi phí cho từng cái.',
  },
  {
    key: 'fixed_cost',
    label: 'Chi phí cố định',
    dir: 1,
    modes: ALL,
    claim: (i) => `Chi phí cố định không vượt ${money(i.fixed_cost, i.currency)} mỗi tháng`,
    test: 'Liệt kê từng khoản phải trả đều đặn mỗi tháng, kể cả khoản đang được miễn phí tạm thời.',
  },
]

export interface Sensitivity {
  key: InputKey
  label: string
  /** Giá trị hiện tại và giá trị khi xấu đi */
  base: number
  worse: number
  /** Tiền cuối kỳ tụt bao nhiêu khi con số này xấu đi 30% */
  loss: number
  /** loss so với tổng chi phí cả kỳ, để biết nặng hay nhẹ */
  share: number
  /** Làm xấu đi thì đang hoà vốn thành không hoà vốn */
  flips: boolean
  risk: 1 | 2 | 3
  /** Con số này chưa phải bạn tự nhập */
  assumed: boolean
  claim: string
  test: string
}

const reachesGoal = (s: PlanSummary) => s.goalMonth != null

export function sensitivities(i: PlanInputs, assumed: readonly InputKey[] = []): Sensitivity[] {
  const baseRows = simulate(i)
  const base = summarize(i, baseRows)
  const mode = MODELS[i.model].planMode
  const scale = Math.max(1, (goalFixed(i) + i.marketing_budget) * i.horizon)
  const out: Sensitivity[] = []
  for (const d of DRIVERS) {
    if (!d.modes.includes(mode)) continue
    const v = i[d.key] as number
    if (!(v > 0)) continue
    let worse = v * (1 + d.dir * WORSEN)
    if (d.key === 'repeat_pct') worse = Math.min(worse, 99)
    const s = summarize({ ...i, [d.key]: worse }, simulate(i, { [d.key]: worse }))
    const loss = Math.max(0, base.endCash - s.endCash)
    const share = loss / scale
    const flips = reachesGoal(base) && !reachesGoal(s)
    const isAssumed = assumed.includes(d.key)
    const raw = flips || share >= 0.25 ? 3 : share >= 0.08 ? 2 : 1
    const risk = (isAssumed && raw < 3 ? raw + 1 : raw) as 1 | 2 | 3
    out.push({ key: d.key, label: d.label, base: v, worse, loss, share, flips, risk, assumed: isAssumed, claim: d.claim(i), test: d.test })
  }
  return out.sort((a, b) => Number(b.flips) - Number(a.flips) || b.loss - a.loss)
}

const goalFixed = (i: PlanInputs) => i.fixed_cost + (i.goal_type === 'salary' ? i.goal_amount : 0)

/** Tóm tắt một câu bằng tiếng người: kế hoạch này nói gì. */
export function verdict(i: PlanInputs, s: PlanSummary): { tone: 'negative' | 'neutral' | 'positive'; text: string } {
  const c = MODELS[i.model].customer
  if (s.unit.contribution <= 0) return { tone: 'negative', text: 'Mỗi khách đang lỗ ngay trước khi tính marketing: giá chưa đủ trả chi phí biến đổi, phí và thuế.' }
  if (s.ltvCac.value != null && s.ltvCac.value < 1) return { tone: 'negative', text: `Một ${c} chưa mang về đủ tiền để bù chi phí kéo họ về (${num(s.ltvCac.value, 1)}×). Càng chạy quảng cáo càng lỗ.` }
  if (s.breakEvenMonth == null)
    return {
      tone: 'negative',
      text: `Trong ${i.horizon} tháng chưa hoà vốn. Cần chuẩn bị khoảng ${moneyShort(s.fundingNeeded, i.currency)}${s.breakEvenCustomers.value != null ? ` và ít nhất ${num(s.breakEvenCustomers.value)} ${c} đang hoạt động` : ''}.`,
    }
  const need = s.fundingNeeded > 0 ? `Cần chuẩn bị khoảng ${moneyShort(s.fundingNeeded, i.currency)} để không hết tiền giữa chừng.` : 'Không cần thêm vốn ngoài số đang có.'
  const weak = s.ltvCac.value != null && s.ltvCac.value < 3
  return { tone: weak ? 'neutral' : 'positive', text: `Hoà vốn vào tháng ${s.breakEvenMonth}. ${need}${weak ? ` Mỗi ${c} mang về ${num(s.ltvCac.value!, 1)}× chi phí kéo họ về, hơi mỏng.` : ''}` }
}
