/**
 * Phần thuần (không phụ thuộc Cloudflare) của AI: lời nhắc, tách JSON từ câu trả lời của model,
 * và làm sạch kết quả trước khi trả về app. Model nhỏ hay trả thừa chữ, sai kiểu, quá dài;
 * app chỉ nhận dữ liệu đã đúng hình dạng.
 */

export const KINDS = ['web', 'app', 'startup', 'product', 'feature', 'other'] as const

export interface Structured {
  title: string
  body: string
  problem: string
  audience: string
  kind: (typeof KINDS)[number]
  tags: string[]
}

export interface Critique {
  weaknesses: string[]
  assumptions: { text: string; risk: 1 | 2 | 3 }[]
  questions: string[]
}

export interface IdeaBrief {
  title: string
  body: string
  canvas: Record<string, string>
  assumptions: string[]
  evidence: { text: string; signal: string }[]
  journal: string[]
}

export const STRUCTURE_PROMPT = `Bạn giúp một người ghi lại ý tưởng sản phẩm. Họ vừa nói hoặc ghi vội một ý tưởng, có thể lộn xộn.
Sắp xếp lại thành đúng một object JSON với các khoá:
- "title": tiêu đề ngắn dưới 70 ký tự, nói rõ đây là sản phẩm gì
- "body": 2 đến 4 câu mô tả gọn, giữ đúng ý người nói
- "problem": vấn đề họ nhắc tới, để chuỗi rỗng nếu họ không nói
- "audience": ai cần sản phẩm này, để chuỗi rỗng nếu họ không nói
- "kind": một trong "web", "app", "startup", "product", "feature", "other"
- "tags": tối đa 4 tag ngắn, chữ thường, không dấu, không có dấu #
Chỉ dùng thông tin có trong lời người nói, không bịa thêm. Viết tiếng Việt. Chỉ trả về JSON, không giải thích.`

export const CRITIQUE_PROMPT = `Bạn là một nhà đầu tư thiên thần khó tính nhưng tử tế. Việc của bạn là giúp người sáng lập thấy điểm yếu của ý tưởng trước khi họ tốn công làm.
Dựa trên ý tưởng bên dưới, trả về đúng một object JSON với các khoá:
- "weaknesses": 3 đến 5 điểm yếu cụ thể nhất của chính ý tưởng này, mỗi điểm một câu
- "assumptions": 3 đến 5 điều phải đúng thì ý tưởng mới sống mà người đó chưa ghi ra; mỗi cái là {"text": "...", "risk": 3 | 2 | 1}, với 3 nghĩa là sai thì ý tưởng chết
- "questions": 2 đến 3 câu nên đi hỏi người dùng thật ngay trong tuần này
Viết tiếng Việt, cụ thể theo ý tưởng này, không chung chung, không khen. Chỉ trả về JSON.`

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+\n/g, '\n').slice(0, max) : '')

/** Lấy object JSON đầu tiên trong câu trả lời của model (model hay bọc trong ```json hoặc thêm lời dẫn). */
export function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI không trả về JSON')
  const parsed = JSON.parse(text.slice(start, end + 1))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('AI trả về sai định dạng')
  return parsed as Record<string, unknown>
}

const slug = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)

export function normStructure(o: Record<string, unknown>): Structured {
  const kind = KINDS.includes(o.kind as Structured['kind']) ? (o.kind as Structured['kind']) : 'other'
  const tags = Array.isArray(o.tags) ? [...new Set(o.tags.filter((t): t is string => typeof t === 'string').map(slug).filter(Boolean))].slice(0, 4) : []
  return {
    title: clip(o.title, 90),
    body: clip(o.body, 800),
    problem: clip(o.problem, 500),
    audience: clip(o.audience, 300),
    kind,
    tags,
  }
}

const strings = (v: unknown, n: number, max: number) =>
  Array.isArray(v)
    ? v
        .map((x) => clip(typeof x === 'string' ? x : (x as { text?: unknown })?.text, max))
        .filter(Boolean)
        .slice(0, n)
    : []

export function normCritique(o: Record<string, unknown>): Critique {
  const assumptions = Array.isArray(o.assumptions)
    ? o.assumptions
        .map((a) => {
          const text = clip(typeof a === 'string' ? a : (a as { text?: unknown })?.text, 240)
          const r = Number((a as { risk?: unknown })?.risk)
          return { text, risk: (r === 1 || r === 2 || r === 3 ? r : 2) as 1 | 2 | 3 }
        })
        .filter((a) => a.text)
        .slice(0, 5)
    : []
  return { weaknesses: strings(o.weaknesses, 5, 300), assumptions, questions: strings(o.questions, 3, 240) }
}

/** Ý tưởng dưới dạng chữ cho model đọc, cắt bớt để khỏi tốn hạn mức. */
export function briefText(b: IdeaBrief): string {
  const lines = [`Tên: ${clip(b.title, 200)}`]
  if (clip(b.body, 1500)) lines.push(`Mô tả: ${clip(b.body, 1500)}`)
  for (const [k, v] of Object.entries(b.canvas ?? {})) if (clip(v, 600)) lines.push(`${k}: ${clip(v, 600)}`)
  const as = (b.assumptions ?? []).map((a) => clip(a, 200)).filter(Boolean).slice(0, 10)
  if (as.length) lines.push('Giả định đã ghi:\n' + as.map((a) => `- ${a}`).join('\n'))
  const ev = (b.evidence ?? []).slice(0, 10).map((e) => `- (${clip(e.signal, 10)}) ${clip(e.text, 300)}`)
  if (ev.length) lines.push('Bằng chứng đã có:\n' + ev.join('\n'))
  const j = (b.journal ?? []).map((x) => clip(x, 300)).filter(Boolean).slice(-8)
  if (j.length) lines.push('Ghi chú gần đây:\n' + j.map((x) => `- ${x}`).join('\n'))
  return lines.join('\n').slice(0, 6000)
}

/* ---------- AI giả, chỉ dùng khi chạy trên máy (AI_FAKE=1) ---------- */

export function fakeStructure(text: string): Structured {
  const first = text.split(/[.\n]/)[0].trim()
  return normStructure({ title: first.slice(0, 70) || 'Ý tưởng từ ghi âm', body: text, problem: '', audience: '', kind: 'other', tags: ['ghi-am'] })
}

export function fakeCritique(b: IdeaBrief): Critique {
  return {
    weaknesses: [`(AI giả) Chưa rõ ai sẽ trả tiền cho "${clip(b.title, 60)}".`, '(AI giả) Chưa có bằng chứng người dùng thật cần nó.', '(AI giả) Đối thủ hiện tại có thể làm điều này rẻ hơn.'],
    assumptions: [
      { text: '(AI giả) Người dùng gặp vấn đề này ít nhất mỗi tuần', risk: 3 },
      { text: '(AI giả) Họ chịu đổi thói quen hiện tại để dùng thử', risk: 2 },
    ],
    questions: ['(AI giả) Lần gần nhất bạn gặp vấn đề này là khi nào?', '(AI giả) Bạn đang giải quyết nó bằng cách nào?'],
  }
}
