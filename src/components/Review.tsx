import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, linkIdeas, newIdea, updateIdea } from '../db'
import { go } from '../lib/router'
import { useSettings } from '../lib/settings'
import { iceScore, kindMeta, timeAgo } from '../lib/util'
import type { Idea, IdeaStatus } from '../types'
import { StatusBadge } from './IdeaCard'

const REVIEWABLE: IdeaStatus[] = ['spark', 'exploring', 'validating', 'building', 'parked']

const PROMPTS = [
  'Nếu chỉ có 1 cuối tuần để làm bản đầu tiên, bạn sẽ cắt bớt gì?',
  'Ai sẽ trả tiền cho cái này ngay hôm nay?',
  'Phiên bản dành cho sinh viên / người già / doanh nghiệp nhỏ trông thế nào?',
  'Nếu miễn phí hoàn toàn thì kiếm tiền từ đâu?',
  'Làm sao để kiểm chứng ý tưởng mà không cần viết dòng code nào?',
  'Đối thủ lớn nhất của nó thực ra là… Excel? Zalo? Giấy bút?',
  'Nếu làm thành tính năng trong app có sẵn thay vì app riêng thì sao?',
  'Điều gì khiến người dùng quay lại mỗi ngày?',
  'Nếu dùng AI thì phần nào tự động hoá được?',
  'Có thể bán cái này cho 100 người đầu tiên bằng cách nào?',
  'Nếu ra mắt ở một nước khác thì có khác gì?',
  'Bản "10 lần tốt hơn" của giải pháp hiện tại là gì?',
]

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

export function Review() {
  const [tab, setTab] = useState<'review' | 'mix'>('review')
  return (
    <div className="review">
      <div className="seg">
        <button className={tab === 'review' ? 'on' : ''} onClick={() => setTab('review')}>
          🔁 Ôn lại
        </button>
        <button className={tab === 'mix' ? 'on' : ''} onClick={() => setTab('mix')}>
          🎲 Trộn & gợi mở
        </button>
      </div>
      {tab === 'review' ? <ReviewQueue /> : <Mixer />}
    </div>
  )
}

function ReviewQueue() {
  const { reviewAfterDays } = useSettings()
  const [queue, setQueue] = useState<string[] | null>(null)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const cutoff = Date.now() - reviewAfterDays * 86400_000
    db.ideas.toArray().then((all) =>
      setQueue(
        all
          .filter((i) => REVIEWABLE.includes(i.status) && (i.reviewedAt ?? i.createdAt) < cutoff)
          .sort((a, b) => (a.reviewedAt ?? a.createdAt) - (b.reviewedAt ?? b.createdAt))
          .map((i) => i.id),
      ),
    )
  }, [reviewAfterDays])

  const currentId = queue?.[idx]
  const idea = useLiveQuery(() => (currentId ? db.ideas.get(currentId) : undefined), [currentId])

  if (!queue) return null
  if (!currentId)
    return (
      <div className="empty">
        <div className="empty-emoji">🎉</div>
        <h2>{queue.length ? 'Ôn xong rồi!' : 'Không có gì cần ôn'}</h2>
        <p className="muted">Ý tưởng chưa được xem lại sau {reviewAfterDays} ngày sẽ xuất hiện ở đây, để không ý nào bị chôn vùi.</p>
      </div>
    )
  if (!idea) return null

  const act = async (changes: Partial<Idea>) => {
    await updateIdea(idea.id, { ...changes, reviewedAt: Date.now() })
    setIdx((i) => i + 1)
  }
  const k = kindMeta(idea.kind)
  const ice = iceScore(idea)

  return (
    <div>
      <p className="muted small center">
        {idx + 1} / {queue.length} ý tưởng đang chờ ôn
      </p>
      <div className="review-card">
        <div className="row gap">
          <span className="kind big">{k.emoji}</span>
          <StatusBadge status={idea.status} />
          {ice !== null && <span className="ice">⚡ {ice}</span>}
          <span className="muted small push">{timeAgo(idea.createdAt)}</span>
        </div>
        <h2>{idea.title}</h2>
        {idea.body && <p className="pre">{idea.body}</p>}
        {idea.canvas.problem && (
          <p>
            <b>Vấn đề:</b> {idea.canvas.problem}
          </p>
        )}
        <p className="prompt">💭 {PROMPTS[(idea.title.length + idx) % PROMPTS.length]}</p>
      </div>
      <div className="review-actions">
        <button className="btn big good" onClick={() => act({ status: idea.status === 'parked' ? 'exploring' : idea.status })}>
          🔥 Vẫn hay
        </button>
        <button className="btn big" onClick={() => act({ status: 'parked' })}>
          ⏸ Để sau
        </button>
        <button className="btn big danger" onClick={() => act({ status: 'dropped' })}>
          ✕ Bỏ
        </button>
      </div>
      <div className="row center gap">
        <button className="btn ghost" onClick={() => go('/idea/' + idea.id)}>
          Mở chi tiết
        </button>
        <button className="btn ghost" onClick={() => setIdx((i) => i + 1)}>
          Bỏ qua →
        </button>
      </div>
    </div>
  )
}

function Mixer() {
  const ideas = useLiveQuery(() => db.ideas.filter((i) => i.status !== 'dropped').toArray(), [])
  const [pair, setPair] = useState<[Idea, Idea] | null>(null)
  const [prompt, setPrompt] = useState(() => pick(PROMPTS))

  const shuffle = () => {
    if (!ideas || ideas.length < 2) return
    const a = pick(ideas)
    let b = pick(ideas)
    while (b.id === a.id) b = pick(ideas)
    setPair([a, b])
    setPrompt(pick(PROMPTS))
  }

  useEffect(() => {
    if (ideas && !pair) shuffle()
  }, [ideas])

  if (!ideas) return null
  if (ideas.length < 2)
    return (
      <div className="empty">
        <div className="empty-emoji">🎲</div>
        <p className="muted">Cần ít nhất 2 ý tưởng để trộn. Ghi thêm vài cái nhé!</p>
      </div>
    )

  const combine = async () => {
    if (!pair) return
    const [a, b] = pair
    const idea = newIdea({
      title: `${a.title} × ${b.title}`,
      body: `Kết hợp từ:\n• ${a.title}\n• ${b.title}`,
      tags: [...new Set([...a.tags, ...b.tags, 'combo'])],
      kind: a.kind,
    })
    await db.ideas.add(idea)
    await linkIdeas(idea.id, a.id, true)
    await linkIdeas(idea.id, b.id, true)
    go('/idea/' + idea.id)
  }

  return (
    <div>
      <p className="muted center">Ghép ngẫu nhiên hai ý tưởng — đôi khi combo lạ lại ra thứ hay.</p>
      {pair && (
        <div className="mix">
          {pair.map((i) => (
            <a key={i.id} className="mix-card" href={'#/idea/' + i.id}>
              <span className="kind big">{kindMeta(i.kind).emoji}</span>
              <b>{i.title}</b>
              {i.body && <span className="muted small clamp">{i.body}</span>}
            </a>
          ))}
          <div className="mix-x">×</div>
        </div>
      )}
      <div className="row center gap">
        <button className="btn big" onClick={shuffle}>
          🎲 Trộn lại
        </button>
        <button className="btn big primary" onClick={combine}>
          ✨ Tạo ý tưởng combo
        </button>
      </div>
      <div className="prompt-box">
        <p className="muted small">Câu hỏi gợi mở</p>
        <p className="prompt-big">{prompt}</p>
        <button className="btn ghost" onClick={() => setPrompt(pick(PROMPTS))}>
          Câu khác
        </button>
      </div>
    </div>
  )
}
