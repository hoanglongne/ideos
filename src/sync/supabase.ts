import type { SupabaseClient } from '@supabase/supabase-js'
import type { RemoteAttachment, RemoteIdea, SyncRemote } from './engine'

const PAGE = 1000
const BUCKET = 'attachments'

interface IdeaRow {
  id: string
  data: RemoteIdea['data']
  updated_at: number
  deleted: boolean
  server_updated_at: string
}

interface AttRow {
  id: string
  idea_id: string
  type: RemoteAttachment['type']
  mime: string
  duration: number | null
  created_at: number
  deleted: boolean
  server_updated_at: string
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/** Kéo hết các trang có server_updated_at > since, tăng dần. */
async function pullAll<T>(client: SupabaseClient, table: string, userId: string, since: string | null): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    let q = client.from(table).select('*').eq('user_id', userId)
    if (since) q = q.gt('server_updated_at', since)
    const rows = check(await q.order('server_updated_at').order('id').range(from, from + PAGE - 1)) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

export function supabaseRemote(client: SupabaseClient, userId: string): SyncRemote {
  const path = (id: string) => `${userId}/${id}`
  return {
    userId,
    async pushIdeas(rows) {
      check(
        await client.from('ideas').upsert(
          rows.map((r) => ({ user_id: userId, id: r.id, data: r.data, updated_at: r.updatedAt, deleted: r.deleted })),
          { onConflict: 'user_id,id' },
        ),
      )
    },
    async pullIdeas(since) {
      const rows = await pullAll<IdeaRow>(client, 'ideas', userId, since)
      return rows.map((r) => ({ id: r.id, data: r.data, updatedAt: Number(r.updated_at), deleted: r.deleted, serverTs: r.server_updated_at }))
    },
    async pushAttachments(rows) {
      check(
        await client.from('attachments').upsert(
          rows.map((r) => ({
            user_id: userId,
            id: r.id,
            idea_id: r.ideaId,
            type: r.type,
            mime: r.mime,
            duration: r.duration,
            created_at: r.createdAt,
            deleted: r.deleted,
          })),
          { onConflict: 'user_id,id' },
        ),
      )
    },
    async pullAttachments(since) {
      const rows = await pullAll<AttRow>(client, 'attachments', userId, since)
      return rows.map((r) => ({
        id: r.id,
        ideaId: r.idea_id,
        type: r.type,
        mime: r.mime,
        duration: r.duration,
        createdAt: Number(r.created_at),
        deleted: r.deleted,
        serverTs: r.server_updated_at,
      }))
    },
    async uploadBlob(id, blob, mime) {
      check(await client.storage.from(BUCKET).upload(path(id), blob, { upsert: true, contentType: mime || 'application/octet-stream' }))
    },
    async downloadBlob(id) {
      const blob = check(await client.storage.from(BUCKET).download(path(id)))
      if (!blob) throw new Error('Không tải được file ' + id)
      return blob
    },
    async deleteBlobs(ids) {
      if (ids.length) check(await client.storage.from(BUCKET).remove(ids.map(path)))
    },
  }
}
