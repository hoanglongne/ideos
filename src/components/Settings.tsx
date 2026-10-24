import { useEffect, useRef, useState } from 'react'
import { clearAll } from '../db'
import { exportJson, exportMarkdown, importJson } from '../lib/backup'
import { getLocation } from '../lib/media'
import { setSettings, useSettings } from '../lib/settings'
import { downloadBlob } from '../lib/util'
import { useSync } from '../sync/manager'
import { SyncPanel } from './SyncPanel'
import { useToast } from './Toast'

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const fmtBytes = (n: number) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB')
const stamp = () => new Date().toISOString().slice(0, 10)

export function Settings({ installEvent, onInstalled }: { installEvent: InstallPromptEvent | null; onInstalled: () => void }) {
  const st = useSettings()
  const sync = useSync()
  const signedIn = !!sync.email
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<{ usage?: number; quota?: number }>({})

  const refreshStorage = () => {
    navigator.storage?.persisted?.().then(setPersisted)
    navigator.storage?.estimate?.().then(setUsage)
  }
  useEffect(refreshStorage, [])

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = matchMedia('(display-mode: standalone)').matches

  return (
    <div className="settings">
      {!standalone && (
        <section className="card-plain">
          <h3>📲 Cài lên màn hình chính</h3>
          {installEvent ? (
            <button
              className="btn primary"
              onClick={async () => {
                await installEvent.prompt()
                if ((await installEvent.userChoice).outcome === 'accepted') onInstalled()
              }}
            >
              Cài Ideos
            </button>
          ) : (
            <p className="muted small">
              {isIOS ? 'Trên iPhone: bấm nút Chia sẻ ⎋ rồi chọn "Thêm vào MH chính".' : 'Mở menu trình duyệt và chọn "Cài đặt ứng dụng" / "Thêm vào màn hình chính".'} Sau khi cài, app mở tức thì và chạy hoàn toàn offline.
            </p>
          )}
        </section>
      )}

      <SyncPanel />

      <section className="card-plain">
        <h3>💾 Dữ liệu</h3>
        <p className="muted small">
          Mọi thứ lưu ngay trên máy này (IndexedDB){signedIn ? ' và được đồng bộ lên Supabase của bạn' : ', không gửi đi đâu'}. Đã dùng {usage.usage !== undefined ? fmtBytes(usage.usage) : '…'}
          {usage.quota ? ` / ${fmtBytes(usage.quota)}` : ''}.
        </p>
        <div className="row wrap gap">
          {persisted === false && (
            <button
              className="btn"
              onClick={async () => {
                const ok = await navigator.storage.persist()
                toast(ok ? 'Trình duyệt sẽ không tự xoá dữ liệu' : 'Trình duyệt chưa cho phép — hãy cài app lên màn hình chính')
                refreshStorage()
              }}
            >
              🔒 Bảo vệ dữ liệu khỏi bị xoá
            </button>
          )}
          {persisted && <span className="muted small">🔒 Dữ liệu đã được bảo vệ</span>}
        </div>
        <div className="row wrap gap">
          <button className="btn" onClick={async () => downloadBlob(await exportJson(), `ideos-backup-${stamp()}.json`)}>
            ⬇ Sao lưu (JSON)
          </button>
          <button className="btn" onClick={async () => downloadBlob(await exportMarkdown(), `ideos-${stamp()}.md`)}>
            ⬇ Xuất Markdown
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ Khôi phục / nhập
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const r = await importJson(f)
                toast(`Đã nhập: ${r.added} mới, ${r.updated} cập nhật, ${r.skipped} giữ nguyên`)
                refreshStorage()
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Không đọc được file')
              }
            }}
          />
        </div>
        <p className="muted small">Mẹo: sao lưu JSON thỉnh thoảng rồi lưu vào Drive/iCloud để chuyển sang máy khác.</p>
      </section>

      <section className="card-plain">
        <h3>⚙️ Tuỳ chọn</h3>
        <label className="setting">
          <span>Giao diện</span>
          <select value={st.theme} onChange={(e) => setSettings({ theme: e.target.value as typeof st.theme })}>
            <option value="system">Theo hệ thống</option>
            <option value="dark">Tối</option>
            <option value="light">Sáng</option>
          </select>
        </label>
        <label className="setting">
          <span>
            Gắn vị trí khi ghi
            <small className="muted">Nhớ lại mình nghĩ ra ý tưởng ở đâu</small>
          </span>
          <input
            type="checkbox"
            checked={st.geotag}
            onChange={async (e) => {
              const on = e.target.checked
              if (on && !(await getLocation(10000))) {
                toast('Không lấy được vị trí — kiểm tra quyền truy cập')
                return
              }
              setSettings({ geotag: on })
            }}
          />
        </label>
        <label className="setting">
          <span>Ngôn ngữ nói→chữ</span>
          <select value={st.speechLang} onChange={(e) => setSettings({ speechLang: e.target.value })}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en-US">English</option>
          </select>
        </label>
        <label className="setting">
          <span>Nhắc ôn lại sau</span>
          <select value={st.reviewAfterDays} onChange={(e) => setSettings({ reviewAfterDays: +e.target.value })}>
            {[1, 3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} ngày
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card-plain">
        <h3>⌨️ Ghi nhanh như dân pro</h3>
        <ul className="help">
          <li>Dòng đầu tiên = tiêu đề, các dòng sau = ghi chú</li>
          <li>
            <code>#tag</code> gắn nhãn, ví dụ <code>#ai #edu</code>
          </li>
          <li>
            <code>@web</code> <code>@app</code> <code>@startup</code> <code>@product</code> <code>@feature</code> chọn loại
          </li>
          <li>
            <kbd>N</kbd> ghi mới · <kbd>/</kbd> tìm · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> lưu · <kbd>Esc</kbd> đóng
          </li>
          <li>Tìm kiếm không cần gõ dấu: "y tuong" khớp "ý tưởng"</li>
          <li>Trên Android: chia sẻ link/text từ app khác → chọn Ideos để lưu thành ý tưởng</li>
          <li>Ghi âm chạy cả khi offline; "Nói→chữ" thường cần mạng</li>
        </ul>
      </section>

      <section className="card-plain">
        <h3 className="danger-text">Vùng nguy hiểm</h3>
        <button
          className="btn danger"
          onClick={async () => {
            const msg = signedIn
              ? 'Xoá TOÀN BỘ ý tưởng trên máy này VÀ trên mọi máy đang đồng bộ? Không thể hoàn tác (trừ khi bạn có bản sao lưu).'
              : 'Xoá TOÀN BỘ ý tưởng trên máy này? Không thể hoàn tác (trừ khi bạn có bản sao lưu).'
            if (!confirm(msg)) return
            await clearAll(signedIn)
            toast('Đã xoá toàn bộ dữ liệu')
            refreshStorage()
          }}
        >
          {signedIn ? 'Xoá tất cả dữ liệu (mọi máy)' : 'Xoá tất cả dữ liệu'}
        </button>
      </section>
      <p className="muted small center">Ideos v{__APP_VERSION__} · offline-first</p>
    </div>
  )
}
