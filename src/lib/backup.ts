import { db, stripSync } from '../db'
import type { Attachment, Idea } from '../types'
import { ASSUMPTION_STATUSES, CANVAS_FIELDS, RISKS, SIGNALS, STATUSES } from '../types'
import { iceScore, kindMeta } from './util'

interface BackupFile {
  app: 'ideos'
  version: 1
  exportedAt: number
  ideas: Idea[]
  attachments: (Omit<Attachment, 'blob'> & { data: string })[]
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

const dataUrlToBlob = async (d: string) => (await fetch(d)).blob()

export async function exportJson(): Promise<Blob> {
  const ideas = (await db.ideas.toArray()).map(stripSync)
  const atts = (await db.attachments.toArray()).map(stripSync)
  const attachments = await Promise.all(
    atts.map(async ({ blob, ...rest }) => ({ ...rest, data: await blobToDataUrl(blob) })),
  )
  const file: BackupFile = { app: 'ideos', version: 1, exportedAt: Date.now(), ideas, attachments }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

/** Gộp bản sao lưu: ý tưởng trùng id thì giữ bản cập nhật mới hơn. */
export async function importJson(file: Blob): Promise<{ added: number; updated: number; skipped: number }> {
  const data = JSON.parse(await file.text()) as BackupFile
  if (data.app !== 'ideos' || !Array.isArray(data.ideas)) throw new Error('File không phải bản sao lưu Ideos')
  let added = 0
  let updated = 0
  let skipped = 0
  const atts: Attachment[] = await Promise.all(
    (data.attachments ?? []).map(async ({ data: d, ...rest }) => ({ ...rest, blob: await dataUrlToBlob(d) })),
  )
  await db.transaction('rw', db.ideas, db.attachments, async () => {
    for (const idea of data.ideas) {
      const existing = await db.ideas.get(idea.id)
      if (!existing) added++
      else if (existing.updatedAt < idea.updatedAt) updated++
      else {
        skipped++
        continue
      }
      await db.ideas.put({ ...stripSync(idea), dirty: 1 })
    }
    for (const a of atts) if (!(await db.attachments.get(a.id))) await db.attachments.put({ ...stripSync(a), dirty: 1 })
  })
  return { added, updated, skipped }
}

export function ideaToMarkdown(idea: Idea): string {
  const out: string[] = []
  const k = kindMeta(idea.kind)
  const st = STATUSES.find((s) => s.value === idea.status)?.label
  out.push(`## ${idea.title || '(không tiêu đề)'}`)
  const meta = [`Loại: ${k.label}`, `Trạng thái: ${st}`]
  const ice = iceScore(idea)
  if (ice !== null) meta.push(`ICE: ${ice}`)
  meta.push(`Tạo: ${new Date(idea.createdAt).toLocaleString('vi-VN')}`)
  out.push(`_${meta.join(' · ')}_`)
  if (idea.tags.length) out.push(idea.tags.map((t) => '#' + t).join(' '))
  if (idea.body) out.push('', idea.body)
  for (const f of CANVAS_FIELDS) if (idea.canvas[f.key]) out.push('', `**${f.label}:** ${idea.canvas[f.key]}`)
  if (idea.tasks.length) {
    out.push('', '**Việc cần làm:**')
    for (const t of idea.tasks) out.push(`- [${t.done ? 'x' : ' '}] ${t.text}`)
  }
  if (idea.assumptions.length) {
    out.push('', '**Giả định:**')
    for (const a of idea.assumptions) {
      const st = ASSUMPTION_STATUSES.find((x) => x.value === a.status)?.label
      out.push(`- ${a.text} _(${RISKS.find((r) => r.value === a.risk)?.label.toLowerCase()}, ${st?.toLowerCase()})_${a.test ? ` — thử: ${a.test}` : ''}`)
    }
  }
  if (idea.evidence.length) {
    out.push('', '**Bằng chứng:**')
    for (const e of idea.evidence) out.push(`- [${SIGNALS.find((x) => x.value === e.signal)?.label}] "${e.text}"${e.source ? ` — ${e.source}` : ''}`)
  }
  if (idea.journal.length) {
    out.push('', '**Nhật ký:**')
    for (const j of [...idea.journal].sort((a, b) => a.at - b.at)) out.push(`- ${new Date(j.at).toLocaleString('vi-VN')}: ${j.text.replace(/\n+/g, ' ')}`)
  }
  if (idea.links.length) {
    out.push('', '**Liên kết:**')
    for (const l of idea.links) out.push(`- ${l}`)
  }
  return out.join('\n')
}

export async function exportMarkdown(): Promise<Blob> {
  const ideas = await db.ideas.orderBy('createdAt').reverse().toArray()
  const md = [`# Ideos — ${ideas.length} ý tưởng`, `_Xuất lúc ${new Date().toLocaleString('vi-VN')}_`, '', ...ideas.map((i) => ideaToMarkdown(i) + '\n\n---\n')]
  return new Blob([md.join('\n')], { type: 'text/markdown' })
}
