import Dexie, { type EntityTable } from 'dexie'
import type { Attachment, Idea } from './types'
import { emptyCanvas } from './types'
import { uid } from './lib/util'

export const db = new Dexie('ideos') as Dexie & {
  ideas: EntityTable<Idea, 'id'>
  attachments: EntityTable<Attachment, 'id'>
}

db.version(1).stores({
  ideas: 'id, status, kind, createdAt, updatedAt, reviewedAt, *tags',
  attachments: 'id, ideaId, createdAt',
})

export function newIdea(partial: Partial<Idea> = {}): Idea {
  const now = Date.now()
  return {
    id: uid(),
    title: '',
    body: '',
    kind: 'other',
    status: 'spark',
    tags: [],
    pinned: false,
    scores: { impact: 0, confidence: 0, ease: 0 },
    canvas: emptyCanvas(),
    tasks: [],
    links: [],
    related: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

/** `changes` nhận cả key path lồng nhau, ví dụ { 'scores.impact': 8 }. */
export async function updateIdea(id: string, changes: Partial<Idea> | Record<string, unknown>) {
  await db.ideas.update(id, { ...changes, updatedAt: Date.now() } as Partial<Idea>)
}

/** Xoá ý tưởng và trả về snapshot để có thể hoàn tác. */
export async function deleteIdea(id: string) {
  return db.transaction('rw', db.ideas, db.attachments, async () => {
    const idea = await db.ideas.get(id)
    const atts = await db.attachments.where('ideaId').equals(id).toArray()
    await db.attachments.where('ideaId').equals(id).delete()
    await db.ideas.delete(id)
    // gỡ liên kết từ các ý tưởng khác
    await db.ideas.filter((i) => i.related.includes(id)).modify((i) => {
      i.related = i.related.filter((r) => r !== id)
    })
    return { idea, atts }
  })
}

export async function restoreIdea(snapshot: { idea?: Idea; atts: Attachment[] }) {
  if (!snapshot.idea) return
  await db.transaction('rw', db.ideas, db.attachments, async () => {
    await db.ideas.put(snapshot.idea!)
    await db.attachments.bulkPut(snapshot.atts)
  })
}

export async function linkIdeas(a: string, b: string, link: boolean) {
  await db.transaction('rw', db.ideas, async () => {
    for (const [x, y] of [[a, b], [b, a]]) {
      const idea = await db.ideas.get(x)
      if (!idea) continue
      const set = new Set(idea.related)
      if (link) set.add(y)
      else set.delete(y)
      await db.ideas.update(x, { related: [...set] })
    }
  })
}
