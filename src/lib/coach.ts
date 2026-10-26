import type { Canvas, Idea, IdeaStatus } from '../types'

/**
 * Bộ câu hỏi mài ý tưởng. Mỗi câu nhắm vào một chỗ cụ thể của ý tưởng (một ô canvas, danh sách giả định,
 * bằng chứng, việc tiếp theo…) và chỉ được hỏi ở những giai đoạn nó có ích.
 */
export type Target =
  | { type: 'canvas'; key: keyof Canvas }
  | { type: 'journal'; label: string }
  | { type: 'assumptions' }
  | { type: 'riskiest' }
  | { type: 'evidence' }
  | { type: 'scores' }
  | { type: 'task' }

export interface Question {
  id: string
  prompt: string
  hint: string
  stages: IdeaStatus[]
  target: Target
  /** Ý tưởng đã có câu trả lời cho câu này chưa (thì khỏi hỏi). */
  answered: (idea: Idea) => boolean
}

const EARLY: IdeaStatus[] = ['spark', 'exploring', 'parked']
const MID: IdeaStatus[] = ['exploring', 'validating']
const LATE: IdeaStatus[] = ['validating', 'building']
const ALL: IdeaStatus[] = ['spark', 'exploring', 'validating', 'building', 'parked', 'shipped']

const filled = (key: keyof Canvas) => (i: Idea) => i.canvas[key].trim().length > 0
const journaled = (label: string) => (i: Idea) => i.journal.some((j) => j.kind === 'coach' && j.text.includes(label + ':'))

/** Thứ tự trong danh sách là thứ tự ưu tiên. */
export const QUESTIONS: Question[] = [
  {
    id: 'problem',
    prompt: 'Kể lại lần gần nhất có người gặp đúng vấn đề này. Chuyện gì đã xảy ra?',
    hint: 'Có thể là chính bạn. Một câu chuyện có ngày giờ, có người thật, đáng giá hơn một mô tả chung chung.',
    stages: [...EARLY, 'validating'],
    target: { type: 'canvas', key: 'problem' },
    answered: filled('problem'),
  },
  {
    id: 'audience',
    prompt: 'Ai đau nhất vì vấn đề này? Tả một người cụ thể.',
    hint: 'Tuổi, nghề, đang ở đâu, một ngày của họ thế nào. "Mọi người" không phải câu trả lời.',
    stages: [...EARLY, 'validating'],
    target: { type: 'canvas', key: 'audience' },
    answered: filled('audience'),
  },
  {
    id: 'competitors',
    prompt: 'Hiện giờ họ đang xoay xở bằng cách nào?',
    hint: 'Excel, Zalo, nhờ người quen, một app khác, hay đành chịu. Cách xoay xở đó mới là đối thủ thật của bạn.',
    stages: [...EARLY, 'validating'],
    target: { type: 'canvas', key: 'competitors' },
    answered: filled('competitors'),
  },
  {
    id: 'whynow',
    prompt: 'Vì sao là bây giờ? Điều gì vừa thay đổi khiến ý tưởng này làm được?',
    hint: 'Một công nghệ mới, một thói quen mới, một quy định mới. Nếu không có gì thay đổi, vì sao chưa ai làm?',
    stages: EARLY,
    target: { type: 'journal', label: 'Vì sao là bây giờ' },
    answered: journaled('Vì sao là bây giờ'),
  },
  {
    id: 'assumptions',
    prompt: 'Điều gì phải đúng thì ý tưởng này mới sống?',
    hint: 'Mỗi dòng một điều. Ví dụ: "Người ta chịu trả 200 nghìn mỗi lần", "Mình tìm được 20 người dùng đầu trong một tháng".',
    stages: [...MID, 'spark', 'building'],
    target: { type: 'assumptions' },
    answered: (i) => i.assumptions.length >= 2,
  },
  {
    id: 'riskiest',
    prompt: 'Trong những điều đó, cái nào sai thì ý tưởng chết ngay? Cách rẻ nhất để biết nó sai, ngay trong tuần này?',
    hint: 'Chọn một giả định, rồi viết phép thử: hỏi ai, đăng gì, đo con số nào. Không cần viết code.',
    stages: [...MID, 'building'],
    target: { type: 'riskiest' },
    answered: (i) => i.assumptions.length === 0 || i.assumptions.some((a) => a.risk === 3 && a.test.trim().length > 0),
  },
  {
    id: 'solution',
    prompt: 'Phiên bản nhỏ nhất, làm xong trong một cuối tuần, trông thế nào?',
    hint: 'Bỏ hết mọi thứ, chỉ giữ cái giải đúng nỗi đau trong câu chuyện ở trên. Có thể chỉ là một trang web, một nhóm Zalo, một file Excel.',
    stages: MID,
    target: { type: 'canvas', key: 'solution' },
    answered: filled('solution'),
  },
  {
    id: 'evidence',
    prompt: 'Lần gần nhất bạn hỏi ai đó về ý tưởng này, họ nói gì?',
    hint: 'Ghi lại đúng lời họ nói, càng sát càng tốt. Một lời từ chối cũng là bằng chứng quý.',
    stages: LATE,
    target: { type: 'evidence' },
    answered: (i) => i.evidence.length >= 3,
  },
  {
    id: 'monetization',
    prompt: 'Ai sẽ trả tiền, trả bao nhiêu, và vì sao họ không tự làm lấy?',
    hint: 'Người dùng và người trả tiền có thể là hai người khác nhau. Thử nói một con số cụ thể.',
    stages: [...MID, 'building'],
    target: { type: 'canvas', key: 'monetization' },
    answered: filled('monetization'),
  },
  {
    id: 'unfair',
    prompt: 'Vì sao lại là bạn? Bạn biết gì, quen ai, có gì mà người khác không có?',
    hint: 'Không có cũng không sao, nhưng nên biết sớm.',
    stages: MID,
    target: { type: 'canvas', key: 'unfair' },
    answered: filled('unfair'),
  },
  {
    id: 'kill',
    prompt: 'Dấu hiệu nào cho thấy nên dừng ý tưởng này?',
    hint: 'Viết ra từ bây giờ, khi còn tỉnh táo. Ví dụ: "Hỏi 10 người mà không ai chịu trả tiền thì dừng".',
    stages: LATE,
    target: { type: 'journal', label: 'Khi nào nên dừng' },
    answered: journaled('Khi nào nên dừng'),
  },
  {
    id: 'scores',
    prompt: 'Chấm nhanh: ý tưởng này tác động lớn cỡ nào, bạn tự tin đến đâu, và dễ làm không?',
    hint: 'Không cần chính xác. Điểm giúp so các ý tưởng với nhau và chọn cái nên làm trước.',
    stages: ALL,
    target: { type: 'scores' },
    answered: (i) => i.scores.impact > 0 && i.scores.confidence > 0 && i.scores.ease > 0,
  },
]

/** Câu chốt mọi phiên: luôn kết thúc bằng một việc cụ thể. */
export const NEXT_STEP: Question = {
  id: 'next',
  prompt: 'Việc nhỏ nhất bạn làm được trong 48 giờ tới là gì?',
  hint: 'Nhỏ đến mức không có lý do để hoãn: nhắn cho một người, phác một màn hình, tìm ba đối thủ.',
  stages: ALL,
  target: { type: 'task' },
  answered: () => false,
}

export const SESSION_SIZE = 5

/**
 * Chọn câu hỏi tiếp theo cho phiên: câu ưu tiên cao nhất hợp giai đoạn, chưa hỏi trong phiên này và
 * ý tưởng chưa có câu trả lời. Gọi lại sau mỗi câu trả lời, nên câu sau phản ứng theo câu trước
 * (vừa ghi giả định thì câu kế là chọn giả định rủi ro nhất). Hết câu (hoặc đủ SESSION_SIZE) thì chốt bằng NEXT_STEP.
 */
export function nextQuestion(idea: Idea, asked: string[]): Question | null {
  if (asked.includes(NEXT_STEP.id)) return null
  if (asked.length < SESSION_SIZE) {
    const q = QUESTIONS.find((q) => !asked.includes(q.id) && q.stages.includes(idea.status) && !q.answered(idea))
    if (q) return q
  }
  return NEXT_STEP
}

/** Ước lượng số câu của phiên để hiện "câu 2 trên 6". */
export function sessionLength(idea: Idea): number {
  const open = QUESTIONS.filter((q) => q.stages.includes(idea.status) && !q.answered(idea)).length
  return Math.min(SESSION_SIZE, open) + 1
}
