import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, linkIdeas, newIdea, updateIdea } from '../db'
import { go } from '../lib/router'
import { useSettings } from '../lib/settings'
import { iceScore, kindMeta, timeAgo } from '../lib/util'
import { REVIEWABLE, type Idea } from '../types'
import { StatusPill } from './IdeaRow'

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
      <header className="title-row">
        <div className="title-text">
          <h1 className="page-title">{tab === 'review' ? 'Ôn lại' : 'Ghép ý tưởng'}</h1>
          <p className="lede">{tab === 'review' ? 'Xem lại từng ý tưởng cũ để không cái nào bị chôn vùi.' : 'Ghép ngẫu nhiên hai ý tưởng. Đôi khi một cặp lạ lại ra thứ hay.'}</p>
        </div>
        <div className="seg" role="tablist" aria-label="Chế độ">
          <button role="tab" aria-selected={tab === 'review'} className={tab === 'review' ? 'on' : ''} onClick={() => setTab('review')}>
            Ôn lại
          </button>
          <button role="tab" aria-selected={tab === 'mix'} className={tab === 'mix' ? 'on' : ''} onClick={() => setTab('mix')}>
            Ghép
          </button>
        </div>
      </header>
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
  const upcoming = useLiveQuery(async () => (queue ? (await db.ideas.bulkGet(queue.slice(idx + 1, idx + 6))).filter((x): x is Idea => !!x) : []), [queue, idx], [])

  if (!queue) return null
  if (!currentId)
    return (
      <section className="panel done-panel" aria-labelledby="done-h">
        <h2 id="done-h">{queue.length ? `Đã ôn xong ${queue.length} ý tưởng.` : 'Chưa có gì cần ôn.'}</h2>
        <p className="panel-note">Ý tưởng chưa được xem lại sau {reviewAfterDays} ngày sẽ vào đây. Đổi khoảng này trong Cài đặt.</p>
        <a className="btn" href="#/">
          Về danh sách
        </a>
      </section>
    )
  if (!idea) return null

  const act = async (changes: Partial<Idea>) => {
    await updateIdea(idea.id, { ...changes, reviewedAt: Date.now() })
    setIdx((i) => i + 1)
  }
  const ice = iceScore(idea)
  const done = idea.tasks.filter((t) => t.done).length
  const last = idea.reviewedAt ?? idea.createdAt

  return (
    <div className="review-grid">
      <div className="review-flow">
        <div className="progress" aria-label={`Ý tưởng ${idx + 1} trên ${queue.length}`}>
          <span className="num">
            {idx + 1} trên {queue.length}
          </span>
          <span className="progress-track" aria-hidden="true">
            <span style={{ width: `${((idx + 1) / queue.length) * 100}%` }} />
          </span>
        </div>
        <article className="panel review-card" aria-labelledby="rv-h">
          <p className="meta-line">
            <span>{kindMeta(idea.kind).label}</span>
            <StatusPill status={idea.status} />
            <span>ghi {timeAgo(idea.createdAt)}</span>
          </p>
          <h2 id="rv-h" className="review-title">
            {idea.title}
          </h2>
          {idea.body && <p className="pre review-body">{idea.body}</p>}
          {idea.canvas.problem && (
            <p className="review-body">
              <span className="muted">Vấn đề: </span>
              {idea.canvas.problem}
            </p>
          )}
          <dl className="facts">
            <div>
              <dt>Điểm ICE</dt>
              <dd className={'num' + (ice === null ? ' none' : ' ice-figure')}>{ice === null ? '—' : ice.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Bước tiếp theo</dt>
              <dd className={'num' + (idea.tasks.length ? '' : ' none')}>{idea.tasks.length ? `${done}/${idea.tasks.length}` : '—'}</dd>
            </div>
            <div>
              <dt>Tag</dt>
              <dd className={idea.tags.length ? '' : 'none'}>{idea.tags.length ? idea.tags.map((t) => '#' + t).join(' ') : '—'}</dd>
            </div>
            <div>
              <dt>{idea.reviewedAt ? 'Xem lần cuối' : 'Chưa xem lại'}</dt>
              <dd className="num">{Math.floor((Date.now() - last) / 86400_000)} ngày trước</dd>
            </div>
          </dl>
          <p className="prompt">
            <span className="muted">Thử nghĩ: </span>
            {PROMPTS[(idea.title.length + idx) % PROMPTS.length]}
          </p>
          <div className="review-actions">
            <button className="btn primary" onClick={() => act({ status: idea.status === 'parked' ? 'exploring' : idea.status })}>
              Vẫn đáng theo
            </button>
            <button className="btn" onClick={() => act({ status: 'parked' })}>
              Để sau
            </button>
            <button className="text-btn danger" onClick={() => act({ status: 'dropped' })}>
              Bỏ ý tưởng
            </button>
            <span className="push" />
            <button className="text-btn" onClick={() => go('/idea/' + idea.id)}>
              Mở chi tiết
            </button>
            <button className="text-btn" onClick={() => setIdx((i) => i + 1)}>
              Bỏ qua
            </button>
          </div>
        </article>
      </div>
      <aside className="panel review-side" aria-labelledby="next-h">
        <div className="panel-head">
          <h2 id="next-h">Tiếp theo trong hàng</h2>
          <span className="muted num">{queue.length - idx - 1}</span>
        </div>
        {upcoming.length ? (
          <ul className="mini-list">
            {upcoming.map((i) => (
              <li key={i.id}>
                <span className="next-title">{i.title}</span>
                <span className="muted num">{Math.floor((Date.now() - (i.reviewedAt ?? i.createdAt)) / 86400_000)} ngày</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel-note">Đây là ý tưởng cuối cùng trong hàng.</p>
        )}
        <p className="panel-note review-hint">Ý tưởng cũ nhất được đưa ra trước. Mỗi lần bạn chọn, nó sẽ quay lại sau {reviewAfterDays} ngày.</p>
      </aside>
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
      <section className="panel done-panel" aria-labelledby="mix-empty-h">
        <h2 id="mix-empty-h">Cần ít nhất 2 ý tưởng để ghép.</h2>
        <p className="panel-note">Hiện có {ideas.length}. Ghi thêm vài cái rồi quay lại.</p>
      </section>
    )

  const combine = async () => {
    if (!pair) return
    const [a, b] = pair
    const idea = newIdea({
      title: `${a.title} × ${b.title}`,
      body: `Ghép từ:\n• ${a.title}\n• ${b.title}`,
      tags: [...new Set([...a.tags, ...b.tags, 'ghep'])],
      kind: a.kind,
    })
    await db.ideas.add(idea)
    await linkIdeas(idea.id, a.id, true)
    await linkIdeas(idea.id, b.id, true)
    go('/idea/' + idea.id)
  }

  return (
    <div className="mixer">
      {pair && (
        <div className="mix">
          {pair.map((i, n) => (
            <a key={i.id} className="panel mix-card" href={'#/idea/' + i.id}>
              <span className="muted">
                {n === 0 ? 'Ý tưởng thứ nhất' : 'Ý tưởng thứ hai'} · {kindMeta(i.kind).label}
              </span>
              <h2>{i.title}</h2>
              {i.body && <p className="clamp">{i.body}</p>}
            </a>
          ))}
        </div>
      )}
      <div className="row-actions">
        <button className="btn primary" onClick={combine}>
          Tạo ý tưởng từ cặp này
        </button>
        <button className="btn" onClick={shuffle}>
          Ghép cặp khác
        </button>
      </div>
      <section className="panel prompt-panel" aria-labelledby="prompt-h">
        <div className="panel-head">
          <h2 id="prompt-h">Câu hỏi gợi mở</h2>
          <button className="text-btn" onClick={() => setPrompt(pick(PROMPTS))}>
            Câu khác
          </button>
        </div>
        <p className="prompt-big">{prompt}</p>
      </section>
    </div>
  )
}
