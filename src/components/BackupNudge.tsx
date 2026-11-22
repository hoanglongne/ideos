import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db'
import { exportJson } from '../lib/backup'
import { backupAgo, dismissNudge, lastBackupAt, markBackup, needsBackupNudge, nudgeDays, nudgeDismissedUntil } from '../lib/safety'
import { downloadBlob } from '../lib/util'
import { useSync } from '../sync/manager'
import { useToast } from './Toast'

/**
 * Dải nhắc sao lưu. Chỉ hiện khi dữ liệu mới nằm trên máy này (chưa bật đồng bộ), đã có vài ý tưởng,
 * và lâu rồi chưa tải bản sao lưu. Lúc có ý tưởng đầu tiên cũng xin lại quyền giữ dữ liệu của trình duyệt.
 */
export function BackupNudge() {
  const sync = useSync()
  const toast = useToast()
  const stats = useLiveQuery(async () => {
    const n = await db.ideas.count()
    const oldest = n ? (await db.ideas.orderBy('createdAt').first())?.createdAt ?? null : null
    return { n, oldest }
  }, [])
  const [, bump] = useState(0)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  const hasIdeas = (stats?.n ?? 0) > 0
  useEffect(() => {
    if (!hasIdeas || !navigator.storage?.persist) return
    // xin lại khi đã có ý tưởng: trình duyệt hay từ chối lúc mới mở lần đầu vì chưa thấy mình dùng thật
    navigator.storage
      .persisted()
      .then((p) => (p ? true : navigator.storage.persist()))
      .then(setPersisted)
      .catch(() => setPersisted(null))
  }, [hasIdeas])

  if (!stats) return null
  const input = { ideaCount: stats.n, synced: !!sync.code, lastBackup: lastBackupAt(), oldestIdeaAt: stats.oldest, dismissedUntil: nudgeDismissedUntil(), now: Date.now() }
  if (!needsBackupNudge(input)) return null
  const days = nudgeDays(input)

  return (
    <div className="notice nudge" role="region" aria-label="Nhắc sao lưu">
      <span>
        <b>{input.lastBackup == null ? 'Chưa sao lưu lần nào.' : `Sao lưu gần nhất ${backupAgo(input.lastBackup)}.`}</b> {stats.n} ý tưởng của bạn chỉ nằm trên máy này
        {persisted === false ? ', và trình duyệt chưa hứa giữ dữ liệu' : ''}
        {days != null && input.lastBackup == null ? ` (ý tưởng cũ nhất đã ${days} ngày)` : ''}.
      </span>
      <span className="nudge-actions">
        <button
          className="btn"
          onClick={async () => {
            downloadBlob(await exportJson(), `ideos-backup-${new Date().toISOString().slice(0, 10)}.json`)
            markBackup()
            bump((x) => x + 1)
            toast('Đã tải bản sao lưu')
          }}
        >
          Tải bản sao lưu
        </button>
        <a className="btn" href="#/settings">
          Bật đồng bộ
        </a>
        <button
          className="text-btn"
          onClick={() => {
            dismissNudge()
            bump((x) => x + 1)
          }}
        >
          Để sau
        </button>
      </span>
    </div>
  )
}
