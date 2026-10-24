import type { RemoteAttachment, RemoteIdea, SyncRemote } from './engine'

/**
 * Backend giả lập trong bộ nhớ, cùng quy tắc với supabase/schema.sql
 * (bản mới hơn thắng + serverTs tăng dần). Dùng cho test.
 */
export class MemoryServer {
  ideas = new Map<string, RemoteIdea & { userId: string }>()
  atts = new Map<string, RemoteAttachment & { userId: string }>()
  blobs = new Map<string, Blob>()
  private clock = Date.parse('2026-01-01T00:00:00Z')

  private ts() {
    this.clock += 1000
    return new Date(this.clock).toISOString()
  }

  remote(userId: string, opts: { failDownloads?: Set<string> } = {}): SyncRemote & { failDownloads: Set<string> } {
    const k = (id: string) => `${userId}/${id}`
    const failDownloads = opts.failDownloads ?? new Set<string>()
    return {
      userId,
      failDownloads,
      pushIdeas: async (rows) => {
        for (const r of rows) {
          const cur = this.ideas.get(k(r.id))
          if (cur && r.updatedAt < cur.updatedAt) continue
          this.ideas.set(k(r.id), { ...structuredClone(r), userId, serverTs: this.ts() })
        }
      },
      pullIdeas: async (since) =>
        [...this.ideas.values()]
          .filter((r) => r.userId === userId && (!since || r.serverTs > since))
          .sort((a, b) => a.serverTs.localeCompare(b.serverTs))
          .map(({ userId: _u, ...r }) => structuredClone(r)),
      pushAttachments: async (rows) => {
        for (const r of rows) this.atts.set(k(r.id), { ...r, userId, serverTs: this.ts() })
      },
      pullAttachments: async (since) =>
        [...this.atts.values()]
          .filter((r) => r.userId === userId && (!since || r.serverTs > since))
          .sort((a, b) => a.serverTs.localeCompare(b.serverTs))
          .map(({ userId: _u, ...r }) => ({ ...r })),
      uploadBlob: async (id, blob) => {
        this.blobs.set(k(id), blob)
      },
      downloadBlob: async (id) => {
        const b = this.blobs.get(k(id))
        if (!b || failDownloads.has(id)) throw new Error('not found')
        return b
      },
      deleteBlobs: async (ids) => {
        for (const id of ids) this.blobs.delete(k(id))
      },
    }
  }
}
