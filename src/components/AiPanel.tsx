import { Plus } from 'lucide-react'
import { useState } from 'react'
import { addJournal, db, updateIdea } from '../db'
import { aiErrorText, critique, structure, transcribe, useAi, type AiAvailability, type Critique } from '../sync/ai'
import { uid } from '../lib/util'
import type { Attachment, Idea } from '../types'
import { useToast } from './Toast'

/** Ý tưởng tạo từ một đoạn ghi âm mà chưa ai đặt tên: tiêu đề do app tự sinh. */
export const isRawIdea = (i: Idea) => /^Ghi âm \d/.test(i.title) || i.title === 'Ý tưởng chưa đặt tên'

function remaining(a: AiAvailability) {
  return a.state === 'ready' ? Math.max(0, a.status.limit - a.status.used) : 0
}

/** Lý do chưa dùng được AI, nói đúng việc người dùng cần làm. */
function Unavailable({ avail }: { avail: AiAvailability }) {
  if (avail.state === 'loading') return <p className="panel-note">Đang kiểm tra AI…</p>
  if (avail.state === 'disabled')
    return (
      <p className="panel-note">
        AI đang tắt. Không có chữ nào của bạn được gửi đi. Bật lại ở <a href="#/settings">Cài đặt</a>.
      </p>
    )
  if (avail.state === 'unpaired')
    return (
      <p className="panel-note">
        AI chạy trên máy chủ Cloudflare của bạn, nên cần <a href="#/settings">bật đồng bộ</a> trước.
      </p>
    )
  if (avail.state === 'off') return <p className="panel-note">Máy chủ chưa bật AI. Thêm binding AI vào wrangler.jsonc rồi deploy lại (xem README).</p>
  if (avail.state === 'error') return <p className="panel-note">Chưa kết nối được AI: {avail.message}</p>
  return null
}

/**
 * AI phản biện: chỉ ra điểm yếu, giả định chưa ghi ra và câu nên hỏi người dùng.
 * Kết quả được ghi vào nhật ký; giả định gợi ý thêm vào danh sách bằng một chạm.
 */
export function AiCritiquePanel({ idea }: { idea: Idea }) {
  const { avail, refresh } = useAi()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Critique | null>(null)

  const run = async () => {
    setBusy(true)
    try {
      const r = await critique(idea)
      setResult(r)
      const text = [
        r.weaknesses.length ? 'Điểm yếu:\n' + r.weaknesses.map((w) => `• ${w}`).join('\n') : '',
        r.questions.length ? 'Nên hỏi người dùng:\n' + r.questions.map((q) => `• ${q}`).join('\n') : '',
      ]
        .filter(Boolean)
        .join('\n')
      await addJournal(idea.id, text, 'ai')
    } catch (e) {
      toast(aiErrorText(e))
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const have = new Set(idea.assumptions.map((a) => a.text.trim().toLowerCase()))
  const addAssumption = (text: string, risk: 1 | 2 | 3) =>
    updateIdea(idea.id, { assumptions: [...idea.assumptions, { id: uid(), text, risk, test: '', status: 'untested', createdAt: Date.now() }] })

  return (
    <section className="panel ai-panel" aria-labelledby="ai-h">
      <div className="panel-head">
        <h2 id="ai-h">AI phản biện</h2>
        {avail.state === 'ready' && <span className="muted num">còn {remaining(avail)} lượt</span>}
      </div>
      {avail.state !== 'ready' ? (
        <Unavailable avail={avail} />
      ) : (
        <>
          <p className="panel-note">Một nhà đầu tư khó tính đọc ý tưởng và chỉ ra chỗ yếu, giả định bạn chưa nghĩ tới, câu nên đi hỏi người dùng.</p>
          <button className="btn" disabled={busy || remaining(avail) === 0} onClick={run}>
            {busy ? 'AI đang đọc…' : result ? 'Phản biện lại' : 'Phản biện ý tưởng này'}
          </button>
          {result && (
            <div className="ai-result">
              {result.weaknesses.length > 0 && (
                <>
                  <h3>Điểm yếu</h3>
                  <ul>
                    {result.weaknesses.map((w, k) => (
                      <li key={k}>{w}</li>
                    ))}
                  </ul>
                </>
              )}
              {result.assumptions.length > 0 && (
                <>
                  <h3>Giả định bạn chưa ghi</h3>
                  <ul className="ai-assumptions">
                    {result.assumptions.map((a, k) => {
                      const added = have.has(a.text.trim().toLowerCase())
                      return (
                        <li key={k}>
                          <span>{a.text}</span>
                          <button className="text-btn" disabled={added} onClick={() => addAssumption(a.text, a.risk)}>
                            {added ? 'Đã thêm' : (
                              <>
                                <Plus size={13} strokeWidth={2} aria-hidden /> Thêm
                              </>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
              {result.questions.length > 0 && (
                <>
                  <h3>Nên hỏi người dùng</h3>
                  <ul>
                    {result.questions.map((q, k) => (
                      <li key={k}>{q}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="ai-note">Đã lưu vào nhật ký.</p>
            </div>
          )}
          <p className="ai-note">{avail.status.fake ? 'Đang dùng AI giả khi chạy trên máy.' : 'Nội dung ý tưởng được gửi tới Workers AI qua máy chủ của bạn, không mã hoá đầu cuối cho lần gửi này.'}</p>
        </>
      )}
    </section>
  )
}

/**
 * Chép lời một đoạn ghi âm thành dòng nhật ký. Nếu ý tưởng mới chỉ là "Ghi âm 14:30" thì sắp xếp luôn
 * thành tiêu đề, mô tả, vấn đề, người dùng (chỉ điền chỗ còn trống, không ghi đè thứ bạn đã viết).
 */
export function useTranscribe(idea: Idea) {
  const { avail, refresh } = useAi()
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  const run = async (att: Attachment) => {
    setBusyId(att.id)
    try {
      const text = await transcribe(att.blob)
      await addJournal(idea.id, `Chép lời ghi âm: ${text}`, 'note')
      const fresh = await db.ideas.get(idea.id)
      if (fresh && isRawIdea(fresh)) {
        const s = await structure(text)
        await updateIdea(idea.id, {
          title: s.title || fresh.title,
          body: fresh.body.trim() ? fresh.body : s.body,
          kind: fresh.kind === 'other' ? s.kind : fresh.kind,
          tags: [...new Set([...fresh.tags, ...s.tags])],
          canvas: { ...fresh.canvas, problem: fresh.canvas.problem || s.problem, audience: fresh.canvas.audience || s.audience },
        })
        toast('Đã chép lời và sắp xếp thành ý tưởng')
      } else toast('Đã chép lời vào nhật ký')
    } catch (e) {
      toast(aiErrorText(e))
    } finally {
      setBusyId(null)
      refresh()
    }
  }
  return { ready: avail.state === 'ready' && remaining(avail) > 0, busyId, run }
}
