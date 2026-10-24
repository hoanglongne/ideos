import { AudioLines, Camera, Mic, PenLine, Square } from 'lucide-react'
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
      <div className="media-tools" role="group" aria-label="Thêm giọng nói, ảnh hoặc bản phác">
        {onText && dict.supported && (
          <button
            type="button"
            className={'tool' + (dict.listening ? ' live' : '')}
            onClick={() => (dict.listening ? dict.stop() : dict.start())}
            aria-pressed={dict.listening}
            title={online ? 'Nói để nhập chữ' : 'Nói thành chữ thường cần mạng, khi offline hãy dùng Ghi âm'}
          >
            <Mic size={16} strokeWidth={1.7} aria-hidden />
            <span>{dict.listening ? 'Đang nghe' : 'Nói'}</span>
          </button>
        )}
        {rec.supported && (
          <button type="button" className={'tool' + (rec.recording ? ' live' : '')} onClick={toggleRecord} aria-pressed={rec.recording} title="Ghi âm, dùng được khi offline">
            {rec.recording ? <Square size={14} strokeWidth={2} aria-hidden /> : <AudioLines size={16} strokeWidth={1.7} aria-hidden />}
            <span className="num">{rec.recording ? formatDuration(rec.elapsed) : 'Ghi âm'}</span>
          </button>
        )}
        <button type="button" className="tool" onClick={() => fileRef.current?.click()} title="Chụp hoặc chọn ảnh">
          <Camera size={16} strokeWidth={1.7} aria-hidden />
          <span>Ảnh</span>
        </button>
        <button type="button" className="tool" onClick={() => setSketching(true)} title="Phác nhanh giao diện, sơ đồ">
          <PenLine size={16} strokeWidth={1.7} aria-hidden />
          <span>Phác</span>
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
