import { X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { db } from '../db'
import { uid } from '../lib/util'
import type { Idea, JournalEntry } from '../types'
import { MediaTools } from './MediaTools'

const KIND_LABEL: Record<JournalEntry['kind'], string | null> = {
  note: null,
  coach: 'Mài ý tưởng',
  ai: 'AI phản biện',
  status: 'Đổi giai đoạn',
}

const dayKey = (ts: number) => new Date(ts).toDateString()

function dayLabel(ts: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400_000)
  if (diff === 0) return 'Hôm nay'
  if (diff === 1) return 'Hôm qua'
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' }).format(d)
}

const time = (ts: number) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(ts)

/**
 * Nhật ký của một ý tưởng: mỗi lần nghĩ thêm là một dòng có ngày giờ, mới nhất ở trên,
 * để thấy ý tưởng đã lớn lên thế nào. Kết quả mài ý tưởng, AI phản biện, đổi giai đoạn cũng nằm ở đây.
 */
export function Journal({ idea }: { idea: Idea }) {
  const [draft, setDraft] = useState('')
  const [interim, setInterim] = useState('')

  const add = async () => {
    const text = draft.trim()
    if (!text) return
    await db.ideas.update(idea.id, { journal: [...idea.journal, { id: uid(), at: Date.now(), kind: 'note', text }], updatedAt: Date.now() })
    setDraft('')
  }

  const remove = (id: string) => db.ideas.update(idea.id, { journal: idea.journal.filter((j) => j.id !== id), updatedAt: Date.now() })

  const appendText = useCallback((t: string) => setDraft((cur) => (cur && !/\s$/.test(cur) ? cur + ' ' : cur) + t), [])

  const entries = [...idea.journal].sort((a, b) => b.at - a.at)
  const groups: { key: string; label: string; items: JournalEntry[] }[] = []
  for (const e of entries) {
    const k = dayKey(e.at)
    const g = groups[groups.length - 1]
    if (g?.key === k) g.items.push(e)
    else groups.push({ key: k, label: dayLabel(e.at), items: [e] })
  }

  return (
    <div className="journal">
      <form
        className="journal-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              add()
            }
          }}
          rows={2}
          placeholder="Nghĩ thêm được gì? Một góc nhìn mới, một người cần nó, một lý do nó có thể thất bại…"
          aria-label="Ghi thêm vào nhật ký"
        />
        {interim && <div className="interim">{interim}</div>}
        <div className="journal-add-foot">
          <MediaTools onText={appendText} onInterim={setInterim} onAttach={(a) => db.attachments.add({ ...a, id: uid(), ideaId: idea.id, createdAt: Date.now() })} />
          <button className="btn" type="submit" disabled={!draft.trim()}>
            Ghi
          </button>
        </div>
      </form>

      {groups.length === 0 ? (
        <p className="panel-note">Chưa có ghi chú nào. Mỗi lần nghĩ thêm về ý tưởng này, ghi ở đây hoặc chọn "Ghi tiếp vào…" khi bấm Ghi, để sau này thấy nó đã lớn lên ra sao.</p>
      ) : (
        <ol className="timeline">
          {groups.map((g) => (
            <li key={g.key} className="tl-day">
              <h3 className="tl-day-label">{g.label}</h3>
              <ul>
                {g.items.map((e) => (
                  <li key={e.id} className={'tl-entry kind-' + e.kind}>
                    <span className="tl-time num">{time(e.at)}</span>
                    <div className="tl-body">
                      {KIND_LABEL[e.kind] && <span className="tl-kind">{KIND_LABEL[e.kind]}</span>}
                      <p className="pre">{e.text}</p>
                    </div>
                    <button className="icon-btn small tl-del" aria-label="Xoá ghi chú này" onClick={() => remove(e.id)}>
                      <X size={14} strokeWidth={1.8} />
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
