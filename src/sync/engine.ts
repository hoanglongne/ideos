import type { IdeosDB } from '../db'
import { mergeIdeas, normalizeIdea, stripSync } from '../db'
import type { Attachment, AttachmentType, Idea } from '../types'

/* Hàng dữ liệu phía server. `seq` do server gán, tăng theo thứ tự commit, dùng làm con trỏ kéo về. */
export interface RemoteIdea {
  id: string
  data: Idea | null
  updatedAt: number
  deleted: boolean
  seq: number
}

export interface RemoteAttachment {
  id: string
  ideaId: string
  type: AttachmentType
  mime: string
  duration: number | null
  createdAt: number
  deleted: boolean
  seq: number
}

type Push<T> = Omit<T, 'seq'>

/**
 * Hợp đồng với backend. Server phải:
 *  - bỏ qua upsert ý tưởng có updatedAt nhỏ hơn bản đang có (bản mới hơn thắng)
 *  - gán seq tăng dần theo đúng thứ tự commit, để kéo "seq > con trỏ" không bỏ sót dòng nào
 *  - trả các hàng theo seq tăng dần
 */
export interface SyncRemote {
  /** Định danh kho dữ liệu; đổi kho thì dữ liệu trên máy được gộp vào kho mới. */
  scope: string
  pushIdeas(rows: Push<RemoteIdea>[]): Promise<void>
  pullIdeas(after: number): Promise<RemoteIdea[]>
  pushAttachments(rows: Push<RemoteAttachment>[]): Promise<void>
  pullAttachments(after: number): Promise<RemoteAttachment[]>
  uploadBlob(id: string, blob: Blob, mime: string): Promise<void>
  downloadBlob(id: string): Promise<Blob>
  deleteBlobs(ids: string[]): Promise<void>
}

export interface SyncResult {
  pushed: number
  pulled: number
}

const BATCH = 100

const META = { scope: 'sync.scope', ideas: 'sync.ideasSeq', atts: 'sync.attsSeq' }

async function getMeta<T>(db: IdeosDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}
const setMeta = (db: IdeosDB, key: string, value: unknown) => db.meta.put({ key, value })


function chunk<T>(xs: T[], n = BATCH): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

const toRemoteAtt = (a: Attachment): Push<RemoteAttachment> => ({
  id: a.id,
  ideaId: a.ideaId,
  type: a.type,
  mime: a.mime,
  duration: a.duration ?? null,
  createdAt: a.createdAt,
  deleted: false,
})

const listSize = (i: Idea) => i.journal.length + i.assumptions.length + i.evidence.length + i.tasks.length + i.related.length

/** Một vòng đồng bộ đầy đủ: kéo thay đổi từ server (gộp với thay đổi trên máy), rồi đẩy thay đổi cục bộ lên. */
export async function syncOnce(db: IdeosDB, remote: SyncRemote): Promise<SyncResult> {
  let pushed = 0
  let pulled = 0

  // Đổi kho (máy mới ghép, hoặc chuyển sang mã khác) → gộp toàn bộ dữ liệu trên máy vào kho đó
  if ((await getMeta<string>(db, META.scope)) !== remote.scope) {
    await db.transaction('rw', [db.ideas, db.attachments, db.meta], async () => {
      await db.meta.bulkDelete([META.ideas, META.atts])
      await db.ideas.toCollection().modify({ dirty: 1 })
      await db.attachments.toCollection().modify({ dirty: 1 })
      await setMeta(db, META.scope, remote.scope)
    })
  }

  /* ---------- kéo về trước, để gộp được với thay đổi trên máy trước khi đẩy lên ---------- */

  const ideaCursor = (await getMeta<number>(db, META.ideas)) ?? 0
  const ideaRows = await remote.pullIdeas(ideaCursor)
  if (ideaRows.length) {
    await db.transaction('rw', [db.ideas, db.tombstones, db.meta], async () => {
      let cursor = ideaCursor
      for (const row of ideaRows) {
        cursor = Math.max(cursor, row.seq)
        const local = await db.ideas.get(row.id)
        if (row.deleted || !row.data) {
          if (local && local.updatedAt <= row.updatedAt) {
            await db.ideas.delete(row.id)
            pulled++
          }
          continue
        }
        const t = await db.tombstones.get(`ideas:${row.id}`)
        if (t && t.deletedAt >= row.updatedAt) continue
        const incoming = normalizeIdea({ ...row.data, updatedAt: row.updatedAt })
        if (local?.dirty === 1) {
          // Cả máy này và máy khác cùng sửa khi chưa đồng bộ: gộp danh sách theo id,
          // trường đơn lẻ theo bản mới hơn. Nếu bản gộp có thêm gì từ máy này thì giữ "dirty" để đẩy lên.
          const remoteNewer = row.updatedAt > local.updatedAt
          const merged = remoteNewer ? mergeIdeas(incoming, stripSync(local)) : mergeIdeas(stripSync(local), incoming)
          const base = remoteNewer ? incoming : stripSync(local)
          if (listSize(merged) > listSize(base)) {
            await db.ideas.put({ ...merged, updatedAt: Math.max(Date.now(), row.updatedAt + 1, local.updatedAt), dirty: 1 })
            pulled++
          } else if (remoteNewer) {
            await db.ideas.put({ ...incoming, dirty: 0, _remote: true })
            pulled++
          }
        } else if (!local || row.updatedAt > local.updatedAt) {
          await db.ideas.put({ ...incoming, dirty: 0, _remote: true })
          pulled++
        }
      }
      await setMeta(db, META.ideas, cursor)
    })
  }

  const attCursor = (await getMeta<number>(db, META.atts)) ?? 0
  const attRows = await remote.pullAttachments(attCursor)
  let cursor = attCursor
  for (const row of attRows) {
    if (row.deleted) {
      if (await db.attachments.get(row.id)) {
        await db.attachments.delete(row.id)
        pulled++
      }
    } else if (!(await db.attachments.get(row.id)) && !(await db.tombstones.get(`attachments:${row.id}`))) {
      let blob: Blob
      try {
        blob = await remote.downloadBlob(row.id)
        if (!blob.type && row.mime) blob = new Blob([blob], { type: row.mime })
      } catch {
        break // tải lại ở lần sau, không tiến con trỏ qua hàng này
      }
      await db.attachments.put({
        id: row.id,
        ideaId: row.ideaId,
        type: row.type,
        mime: row.mime,
        blob,
        createdAt: row.createdAt,
        ...(row.duration != null ? { duration: row.duration } : {}),
        dirty: 0,
        _remote: true,
      })
      pulled++
    }
    cursor = Math.max(cursor, row.seq)
  }
  if (cursor !== attCursor) await setMeta(db, META.atts, cursor)


  /* ---------- đẩy lên ---------- */

  const dirtyAtts = await db.attachments.where('dirty').equals(1).toArray()
  for (const group of chunk(dirtyAtts, 20)) {
    for (const a of group) await remote.uploadBlob(a.id, a.blob, a.mime)
    await remote.pushAttachments(group.map(toRemoteAtt))
    await db.attachments.where('id').anyOf(group.map((a) => a.id)).modify({ _remote: true })
    pushed += group.length
  }

  const dirtyIdeas = await db.ideas.where('dirty').equals(1).toArray()
  for (const group of chunk(dirtyIdeas)) {
    await remote.pushIdeas(group.map((i) => ({ id: i.id, data: stripSync(i), updatedAt: i.updatedAt, deleted: false })))
    const sent = new Map(group.map((i) => [i.id, i.updatedAt]))
    // chỉ tắt cờ nếu không bị sửa tiếp trong lúc đang đẩy
    await db.ideas
      .where('id')
      .anyOf([...sent.keys()])
      .modify((i) => {
        if (sent.get(i.id) === i.updatedAt) (i as { _remote?: true })._remote = true
      })
    pushed += group.length
  }

  const tombs = await db.tombstones.toArray()
  const ideaTombs = tombs.filter((t) => t.table === 'ideas')
  const attTombs = tombs.filter((t) => t.table === 'attachments')
  for (const group of chunk(ideaTombs)) {
    await remote.pushIdeas(group.map((t) => ({ id: t.id, data: null, updatedAt: t.deletedAt, deleted: true })))
  }
  for (const group of chunk(attTombs)) {
    await remote.pushAttachments(
      group.map((t) => ({ id: t.id, ideaId: '', type: 'image', mime: '', duration: null, createdAt: t.deletedAt, deleted: true })),
    )
    await remote.deleteBlobs(group.map((t) => t.id))
  }
  if (tombs.length) {
    await db.transaction('rw', db.tombstones, async () => {
      for (const t of tombs) {
        const cur = await db.tombstones.get(t.key)
        if (cur && cur.deletedAt === t.deletedAt) await db.tombstones.delete(t.key)
      }
    })
    pushed += tombs.length
  }

  return { pushed, pulled }
}

/** Số thay đổi trên máy chưa được đẩy lên. */
export async function pendingCount(db: IdeosDB) {
  const [i, a, t] = await Promise.all([db.ideas.where('dirty').equals(1).count(), db.attachments.where('dirty').equals(1).count(), db.tombstones.count()])
  return i + a + t
}
