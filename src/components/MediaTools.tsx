import { useEffect, useRef, useState } from 'react'
import { useDictation, useOnline, useRecorder } from '../lib/media'
import { useSettings } from '../lib/settings'
import { downscaleImage, formatDuration } from '../lib/util'
import type { PendingAttachment } from './Attachments'
import { Sketch } from './Sketch'
import { useToast } from './Toast'

export function MediaTools({
  onText,
  onAttach,
  onInterim,
}: {
  onText?: (t: string) => void
  onAttach: (a: PendingAttachment) => void
  onInterim?: (t: string) => void
}) {
  const { speechLang } = useSettings()
  const online = useOnline()
  const toast = useToast()
  const rec = useRecorder()
  const dict = useDictation(speechLang, (t) => onText?.(t))
  const fileRef = useRef<HTMLInputElement>(null)
  const [sketching, setSketching] = useState(false)

  useEffect(() => {
    onInterim?.(dict.interim)
  }, [dict.interim, onInterim])

  const toggleRecord = async () => {
    if (rec.recording) {
      const r = await rec.stop()
      if (r) onAttach({ type: 'audio', blob: r.blob, mime: r.blob.type, duration: r.duration })
    } else {
      await rec.start()
    }
  }

  const onFiles = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      if (!f.type.startsWith('image/')) continue
      const blob = await downscaleImage(f)
      onAttach({ type: 'image', blob, mime: blob.type })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const err = rec.error || dict.error
  useEffect(() => {
    if (err) toast(err)
  }, [err, toast])

  return (
    <>
      <div className="media-tools">
        {onText && dict.supported && (
          <button
            type="button"
            className={'tool' + (dict.listening ? ' live' : '')}
            onClick={() => (dict.listening ? dict.stop() : dict.start())}
            title={online ? 'Nói để nhập chữ' : 'Đọc chính tả thường cần mạng'}
          >
            <span>🗣️</span>
            <span className="tool-label">{dict.listening ? 'Đang nghe…' : 'Nói→chữ'}</span>
          </button>
        )}
        {rec.supported && (
          <button type="button" className={'tool' + (rec.recording ? ' live rec' : '')} onClick={toggleRecord} title="Ghi âm (dùng được offline)">
            <span>{rec.recording ? '⏹' : '🎙️'}</span>
            <span className="tool-label">{rec.recording ? formatDuration(rec.elapsed) : 'Ghi âm'}</span>
          </button>
        )}
        <button type="button" className="tool" onClick={() => fileRef.current?.click()} title="Chụp / chọn ảnh">
          <span>📷</span>
          <span className="tool-label">Ảnh</span>
        </button>
        <button type="button" className="tool" onClick={() => setSketching(true)} title="Phác nhanh">
          <span>✏️</span>
          <span className="tool-label">Phác</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>
      {sketching && (
        <Sketch
          onCancel={() => setSketching(false)}
          onDone={(blob) => {
            onAttach({ type: 'sketch', blob, mime: 'image/png' })
            setSketching(false)
          }}
        />
      )}
    </>
  )
}
