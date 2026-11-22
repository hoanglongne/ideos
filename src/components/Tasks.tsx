import { X } from 'lucide-react'
import { useState } from 'react'
import { uid } from '../lib/util'
import type { Idea } from '../types'
import { EditableText } from './Editable'

const SUGGESTIONS = ['Tìm 3 đối thủ', 'Hỏi 5 người xem họ có cần không', 'Làm một landing page', 'Vẽ wireframe']

/** Danh sách việc cần làm: dùng khi đã bắt tay làm. */
export function Tasks({ idea, onChange }: { idea: Idea; onChange: (t: Idea['tasks']) => void }) {
  const [v, setV] = useState('')
  const add = (text: string) => {
    if (!text.trim()) return
    onChange([...idea.tasks, { id: uid(), text: text.trim(), done: false }])
    setV('')
  }
  return (
    <div className="tasks">
      {idea.tasks.map((t) => (
        <div key={t.id} className={'task' + (t.done ? ' done' : '')}>
          <label className="check-hit">
            <input type="checkbox" checked={t.done} onChange={() => onChange(idea.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} aria-label={t.text} />
          </label>
          <EditableText value={t.text} multiline={false} ariaLabel="Nội dung việc" onSave={(text) => onChange(idea.tasks.map((x) => (x.id === t.id ? { ...x, text } : x)))} />
          <button className="icon-btn small" aria-label="Xoá việc" onClick={() => onChange(idea.tasks.filter((x) => x.id !== t.id))}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      ))}
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault()
          add(v)
        }}
      >
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Việc nhỏ nhất để tiến thêm một bước" aria-label="Thêm việc" />
        <button className="btn" type="submit" disabled={!v.trim()}>
          Thêm
        </button>
      </form>
      {idea.tasks.length === 0 && (
        <p className="panel-note">
          Gợi ý:{' '}
          {SUGGESTIONS.map((s, i) => (
            <span key={s}>
              <button className="text-btn" onClick={() => add(s)}>
                {s}
              </button>
              {i < SUGGESTIONS.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
