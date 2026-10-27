import { useMemo, useState } from 'react'
import { patchIdea, updateIdea } from '../db'
import { money, moneyShort, num } from '../lib/money/format'
import { fieldsFor, MODEL_IDS, MODELS, newMoneyPlan, switchModel, type Currency, type GoalType, type InputKey, type MoneyPlan, type PlanInputs } from '../lib/money/models'
import { simulate, summarize, type PlanRow } from '../lib/money/plan'
import { sensitivities, verdict, WORSEN, type Sensitivity } from '../lib/money/sensitivity'
import { uid } from '../lib/util'
import { RISKS, type Assumption, type Idea } from '../types'
import { useToast } from './Toast'

type Unit = 'money' | 'pct' | 'count'

const FIELD_UNIT: Partial<Record<InputKey, Unit>> = {
  price: 'money',
  fixed_cost: 'money',
  cac: 'money',
  marketing_budget: 'money',
  start_cash: 'money',
  goal_amount: 'money',
  churn_pct: 'pct',
  repeat_pct: 'pct',
  take_rate_pct: 'pct',
  var_cost_pct: 'pct',
  fee_pct: 'pct',
  tax_pct: 'pct',
  orders_per_month: 'count',
  organic_new: 'count',
  start_customers: 'count',
  horizon: 'count',
}

function labelOf(key: InputKey, i: PlanInputs): string {
  const t = MODELS[i.model]
  switch (key) {
    case 'price':
      return t.priceLabel
    case 'orders_per_month':
      return t.planMode === 'audience' ? 'Số lượt xem mỗi người mỗi tháng' : 'Số lần mua mỗi khách mỗi tháng (khi còn mua)'
    case 'repeat_pct':
      return `${t.customer[0].toUpperCase() + t.customer.slice(1)} mua lại (%)`
    case 'take_rate_pct':
      return 'Phần sàn giữ lại mỗi giao dịch (%)'
    case 'churn_pct':
      return `${t.customer[0].toUpperCase() + t.customer.slice(1)} rời đi mỗi tháng (%)`
    case 'var_cost_pct':
      return 'Chi phí biến đổi (% doanh thu)'
    case 'cac':
      return `Chi phí để có một ${t.customer} trả tiền`
    case 'marketing_budget':
      return 'Ngân sách marketing mỗi tháng'
    case 'fixed_cost':
      return 'Chi phí cố định mỗi tháng'
    case 'start_cash':
      return 'Vốn đang có'
    case 'fee_pct':
      return 'Phí cổng thanh toán / store (%)'
    case 'tax_pct':
      return 'Thuế (% doanh thu)'
    case 'organic_new':
      return 'Khách tự đến mỗi tháng (giới thiệu, SEO…)'
    case 'start_customers':
      return 'Khách đã có lúc bắt đầu'
    case 'horizon':
      return 'Tính trong bao nhiêu tháng'
    case 'goal_amount':
      return i.goal_type === 'salary' ? 'Lương muốn trả cho mình mỗi tháng' : 'Lãi muốn có mỗi tháng'
    default:
      return key
  }
}

/** Ô nhập một con số. Số còn là mặc định của mô hình thì viền nét đứt và ghi rõ là ước lượng. */
function NumField({ k, plan, onChange }: { k: InputKey; plan: MoneyPlan; onChange: (k: InputKey, v: number) => void }) {
  const i = plan.inputs
  const unit = FIELD_UNIT[k] ?? 'count'
  const value = i[k] as number
  const [draft, setDraft] = useState<string | null>(null)
  const assumed = plan.assumed.includes(k)
  const id = 'mf-' + k
  return (
    <div className={'money-field' + (assumed ? ' assumed' : '')}>
      <label htmlFor={id}>{labelOf(k, i)}</label>
      <input
        id={id}
        className="num"
        inputMode="decimal"
        value={draft ?? String(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(',', '.')
          setDraft(e.target.value)
          const n = Number(raw)
          if (raw.trim() !== '' && Number.isFinite(n) && n >= 0) onChange(k, n)
        }}
        onBlur={() => setDraft(null)}
      />
      <span className="money-hint num">
        {unit === 'money' ? `= ${money(value, i.currency)}` : ''}
        {assumed && <span className="money-est">{unit === 'money' ? ' · ' : ''}ước lượng, chưa phải số của bạn</span>}
      </span>
    </div>
  )
}

/** Tiền mặt theo tháng. Đường chạm vạch 0 là lúc hết tiền; màu theo kết quả cuối kỳ. */
function CashChart({ rows, start, cur }: { rows: PlanRow[]; start: number; cur: Currency }) {
  const pts = [start, ...rows.map((r) => r.cash)]
  const lo = Math.min(0, ...pts)
  const hi = Math.max(0, ...pts)
  const span = hi - lo || 1
  const W = 320
  const H = 96
  const x = (k: number) => (k / (pts.length - 1)) * W
  const y = (v: number) => 6 + (1 - (v - lo) / span) * (H - 12)
  const d = pts.map((v, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const end = pts[pts.length - 1]
  const minK = pts.indexOf(Math.min(...pts))
  return (
    <figure className="cash-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tiền mặt qua ${rows.length} tháng: thấp nhất ${moneyShort(pts[minK], cur)}, cuối kỳ ${moneyShort(end, cur)}`} preserveAspectRatio="none">
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="cash-zero" />
        <path d={d} className={end >= 0 ? 'cash-line pos' : 'cash-line neg'} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="num">
        <span>Thấp nhất {moneyShort(pts[minK], cur)}{minK > 0 ? ` (tháng ${minK})` : ''}</span>
        <span>Tháng {rows.length}: {moneyShort(end, cur)}</span>
      </figcaption>
    </figure>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="money-stat">
      <span className="money-stat-label">{label}</span>
      <span className="money-stat-value num">{value}</span>
      {sub && <span className="money-stat-sub">{sub}</span>}
    </div>
  )
}

const GOALS: { value: GoalType; label: string }[] = [
  { value: 'breakeven', label: 'Hoà vốn' },
  { value: 'profit', label: 'Có lãi' },
  { value: 'salary', label: 'Trả lương cho mình' },
]

/**
 * Bài toán tiền của ý tưởng: vài con số giả định → cần bao nhiêu khách, bao nhiêu vốn, bao lâu hoà vốn.
 * Rồi chỉ ra con số nào làm đổ kế hoạch nhanh nhất để biến thành giả định cần kiểm chứng trước.
 */
export function MoneyPanel({ idea }: { idea: Idea }) {
  const plan = idea.money
  const toast = useToast()
  const calc = useMemo(() => {
    if (!plan) return null
    const rows = simulate(plan.inputs)
    const s = summarize(plan.inputs, rows)
    return { rows, s, v: verdict(plan.inputs, s), sens: sensitivities(plan.inputs, plan.assumed) }
  }, [plan])

  const save = (money: MoneyPlan | undefined) => updateIdea(idea.id, { money })

  if (!plan || !calc) {
    return (
      <div className="money-start">
        <p className="panel-note">
          Ý tưởng này có đứng được về tiền không? Chọn mô hình gần nhất, app điền sẵn số trung bình để bạn sửa dần. Chưa biết số nào thì cứ để nguyên, app sẽ nói rõ số nào đang là ước lượng và số nào làm đổ kế hoạch nhanh nhất.
        </p>
        <div className="model-grid">
          {MODEL_IDS.map((m) => (
            <button key={m} className="model-opt" onClick={() => save(newMoneyPlan(m, 'VND'))}>
              {MODELS[m].name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const i = plan.inputs
  const t = MODELS[i.model]
  const { s, v, rows, sens } = calc
  const edit = (k: InputKey, value: number) =>
    patchIdea(idea.id, (cur) => (cur.money ? { money: { inputs: { ...cur.money.inputs, [k]: value }, assumed: cur.money.assumed.filter((a) => a !== k) } } : null))
  const setGoal = (goal_type: GoalType) => patchIdea(idea.id, (cur) => (cur.money ? { money: { ...cur.money, inputs: { ...cur.money.inputs, goal_type } } } : null))
  const have = (key: InputKey) => idea.assumptions.some((a) => a.key === 'money:' + key)

  const toAssumption = (r: Sensitivity): Assumption => ({ id: uid(), text: r.claim, risk: r.risk, test: r.test, status: 'untested', createdAt: Date.now(), key: 'money:' + r.key })
  const addOne = (r: Sensitivity) => {
    patchIdea(idea.id, (cur) => (cur.assumptions.some((a) => a.key === 'money:' + r.key) ? null : { assumptions: [...cur.assumptions, toAssumption(r)] }))
  }
  const addTop = () => {
    const fresh = sens.filter((r) => !have(r.key)).slice(0, 3)
    if (!fresh.length) return toast('Ba con số đầu đã có trong danh sách giả định')
    patchIdea(idea.id, (cur) => ({ assumptions: [...cur.assumptions, ...fresh.filter((r) => !cur.assumptions.some((a) => a.key === 'money:' + r.key)).map(toAssumption)] }))
    toast(`Đã thêm ${fresh.length} giả định`)
  }

  const maxLoss = Math.max(1, ...sens.map((r) => r.loss))
  const top = sens.slice(0, 5)

  return (
    <div className="money">
      <div className="money-bar">
        <select className="quiet-select" value={i.model} aria-label="Mô hình kinh doanh" onChange={(e) => save(switchModel(plan, e.target.value as typeof i.model, i.currency))}>
          {MODEL_IDS.map((m) => (
            <option key={m} value={m}>
              {MODELS[m].name}
            </option>
          ))}
        </select>
        <div className="mini-seg" role="radiogroup" aria-label="Tiền tệ">
          {(['VND', 'USD'] as const).map((c) => (
            <button key={c} role="radio" aria-checked={i.currency === c} className={i.currency === c ? 'on tone-neutral' : ''} onClick={() => i.currency !== c && save(switchModel(plan, i.model, c))}>
              {c}
            </button>
          ))}
        </div>
        <button
          className="text-btn danger"
          onClick={() => {
            const prev = plan
            save(undefined)
            toast('Đã xoá bài toán tiền', { label: 'Hoàn tác', run: () => save(prev) })
          }}
        >
          Xoá
        </button>
      </div>

      <p className={'money-verdict tone-' + v.tone} role="status">
        {v.text}
      </p>

      <div className="money-stats">
        <Stat label="Khách để hoà vốn" value={s.breakEvenCustomers.value == null ? '—' : num(s.breakEvenCustomers.value)} sub={s.breakEvenCustomers.value == null ? 'Chưa tính được' : t.customer + ' đang hoạt động'} />
        <Stat label="Hoà vốn" value={s.breakEvenMonth == null ? `Chưa trong ${i.horizon} th` : `Tháng ${s.breakEvenMonth}`} />
        <Stat label="Vốn cần chuẩn bị" value={moneyShort(s.fundingNeeded, i.currency)} sub={s.cashOutMonth ? `Hết tiền từ tháng ${s.cashOutMonth} nếu không có vốn` : 'Không âm trong kỳ'} />
        <Stat label="Giá trị một khách / chi phí kéo" value={s.ltvCac.value == null ? '—' : `${num(s.ltvCac.value, 1)}×`} sub={s.payback.value == null ? undefined : `Hoàn vốn sau ${num(s.payback.value, 1)} tháng`} />
      </div>
      {s.ltvCac.value == null && s.ltvCac.reason && <p className="money-note">{s.ltvCac.reason}</p>}
      {s.breakEvenCustomers.value == null && s.breakEvenCustomers.reason && <p className="money-note">{s.breakEvenCustomers.reason}</p>}

      <CashChart rows={rows} start={i.start_cash} cur={i.currency} />

      <h3 className="money-h">Các con số</h3>
      <div className="money-fields">
        {fieldsFor(t.planMode).map((k) => (
          <NumField key={k} k={k} plan={plan} onChange={edit} />
        ))}
      </div>

      <div className="money-goal">
        <span className="money-goal-label">Mục tiêu</span>
        <div className="mini-seg" role="radiogroup" aria-label="Mục tiêu">
          {GOALS.map((g) => (
            <button key={g.value} role="radio" aria-checked={i.goal_type === g.value} className={i.goal_type === g.value ? 'on tone-neutral' : ''} onClick={() => setGoal(g.value)}>
              {g.label}
            </button>
          ))}
        </div>
      </div>
      {i.goal_type !== 'breakeven' && (
        <div className="money-fields">
          <NumField k="goal_amount" plan={plan} onChange={edit} />
          {s.goalCustomers.value != null && (
            <p className="money-note">
              Cần khoảng <b className="num">{num(s.goalCustomers.value)}</b> {t.customer} đang hoạt động{s.goalMonth ? `, đạt vào tháng ${s.goalMonth}` : `, chưa đạt trong ${i.horizon} tháng`}.
            </p>
          )}
          {s.goalCustomers.value == null && s.goalCustomers.reason && <p className="money-note">{s.goalCustomers.reason}</p>}
        </div>
      )}

      <details className="money-adv">
        <summary>Chi tiết thêm</summary>
        <div className="money-fields">
          {(['fee_pct', 'tax_pct', 'organic_new', 'start_customers', 'horizon'] as const).map((k) => (
            <NumField key={k} k={k} plan={plan} onChange={edit} />
          ))}
        </div>
      </details>

      <h3 className="money-h">Con số nào dễ làm đổ kế hoạch nhất</h3>
      {top.length === 0 ? (
        <p className="money-note">Chưa có con số nào để thử. Nhập giá và chi phí trước.</p>
      ) : (
        <>
          <p className="money-note">
            App thử làm xấu từng con số đi {Math.round(WORSEN * 100)}% (giá thấp hơn, khách rời đi nhiều hơn…) rồi xem tiền cuối kỳ tụt bao nhiêu. Con số tụt nhiều nhất là điều bạn nên kiểm chứng trước.
          </p>
          <ol className="sens">
            {top.map((r) => (
              <li key={r.key} className="sens-row">
                <div className="sens-head">
                  <span className="sens-label">{r.label}</span>
                  <span className={'sens-risk risk-' + r.risk}>{RISKS.find((x) => x.value === r.risk)?.label}</span>
                  {r.assumed && <span className="money-est">chưa phải số của bạn</span>}
                </div>
                <div className="sens-bar" aria-hidden>
                  <span style={{ width: `${Math.max(3, (r.loss / maxLoss) * 100)}%` }} />
                </div>
                <p className="sens-text">
                  Nếu xấu đi {Math.round(WORSEN * 100)}%: {r.flips && <b>từ hoà vốn thành không hoà vốn, </b>}cuối kỳ mất thêm <b className="num">{moneyShort(r.loss, i.currency)}</b>.
                </p>
                <p className="sens-claim">{r.claim}</p>
                <button className="text-btn" disabled={have(r.key)} onClick={() => addOne(r)}>
                  {have(r.key) ? 'Đã có trong giả định' : 'Thêm vào giả định'}
                </button>
              </li>
            ))}
          </ol>
          <button className="btn" onClick={addTop} disabled={top.slice(0, 3).every((r) => have(r.key))}>
            Thêm 3 con số rủi ro nhất vào giả định
          </button>
        </>
      )}
    </div>
  )
}
