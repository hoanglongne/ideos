import { useState } from 'react'
import type { Attachment, AttachmentType } from '../types'
import { useObjectUrl } from '../lib/media'
import { formatDuration } from '../lib/util'

export interface PendingAttachment {
  type: AttachmentType
  blob: Blob
  mime: string
  duration?: number
}

function Thumb({ att, onRemove }: { att: PendingAttachment | Attachment; onRemove?: () => void }) {
  const url = useObjectUrl(att.blob)
  const [zoom, setZoom] = useState(false)
  if (!url) return null
  return (
    <div className={'att att-' + att.type}>
      {att.type === 'audio' ? (
        <div className="att-audio">
          <span className="att-audio-icon">🎙️</span>
          <audio controls src={url} preload="metadata" />
          {att.duration ? <span className="muted small">{formatDuration(att.duration)}</span> : null}
        </div>
      ) : (
        <>
          <img src={url} alt={att.type === 'sketch' ? 'Bản phác' : 'Ảnh'} onClick={() => setZoom(true)} />
          {zoom && (
            <div className="lightbox" onClick={() => setZoom(false)}>
              <img src={url} alt="" />
            </div>
          )}
        </>
      )}
      {onRemove && (
        <button className="att-remove" aria-label="Xoá đính kèm" onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  )
}

export function AttachmentList({
  items,
  onRemove,
}: {
  items: (PendingAttachment | Attachment)[]
  onRemove?: (index: number) => void
}) {
  if (!items.length) return null
  return (
    <div className="att-list">
      {items.map((a, i) => (
        <Thumb key={'id' in a ? a.id : i} att={a} onRemove={onRemove ? () => onRemove(i) : undefined} />
      ))}
    </div>
  )
}
