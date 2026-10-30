import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clearAll } from '../db'
import { exportJson, exportMarkdown, importJson } from '../lib/backup'
import { backupAgo, lastBackupAt, markBackup } from '../lib/safety'
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

const fmtBytes = (n: number) => (n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB')
const stamp = () => new Date().toISOString().slice(0, 10)

function Row({ id, title, desc, children }: { id: string; title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <section className="set-row" aria-labelledby={id}>
      <div className="set-label">
        <h2 id={id}>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
      <div className="set-panel">{children}</div>
    </section>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="check-hit">
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
    </label>
  )
}

export function Settings({ installEvent, onInstalled }: { installEvent: InstallPromptEvent | null; onInstalled: () => void }) {
  const st = useSettings()
  const sync = useSync()
  const signedIn = !!sync.code
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [backupAt, setBackupAt] = useState(lastBackupAt())
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
      <header className="title-row">
        <div className="title-text">
          <h1 className="page-title">Cài đặt</h1>
          <p className="lede">Mọi thứ được lưu ngay trên máy này{signedIn ? ' và đồng bộ qua máy chủ của bạn, ở dạng đã mã hoá' : ''}.</p>
        </div>
      </header>

      <Row id="sync-h" title="Đồng bộ giữa các máy" desc="Ghi trên điện thoại, xem lại trên laptop. Mất mạng vẫn dùng bình thường, có mạng lại thì tự đẩy và kéo thay đổi. Dữ liệu được mã hoá trên máy trước khi gửi đi.">
        <SyncPanel />
      </Row>

      <Row
        id="data-h"
        title="Dữ liệu"
        desc={
          <>
            Đang dùng <span className="num">{usage.usage !== undefined ? fmtBytes(usage.usage) : '—'}</span>
            {usage.quota ? (
              <>
                {' '}
                trên <span className="num">{fmtBytes(usage.quota)}</span> trình duyệt cho phép
              </>
            ) : null}
            .
          </>
        }
      >
        <div className="set-item">
          <div>
            <p className="item-title">Giữ dữ liệu lâu dài</p>
            <p className="item-desc">{persisted ? 'Trình duyệt sẽ không tự xoá dữ liệu của Ideos.' : 'Không bật thì trình duyệt có thể xoá dữ liệu khi máy đầy bộ nhớ.'}</p>
          </div>
          {persisted ? (
            <span className="pill tone-positive">Đã bật</span>
          ) : (
            <button
              className="btn"
              onClick={async () => {
                const ok = await navigator.storage.persist()
                toast(ok ? 'Đã bật, trình duyệt sẽ giữ dữ liệu' : 'Trình duyệt chưa cho phép. Hãy cài app lên màn hình chính rồi thử lại.')
                refreshStorage()
              }}
            >
              Bật
            </button>
          )}
        </div>
        <div className="set-item">
          <div>
            <p className="item-title">Sao lưu và khôi phục</p>
            <p className="item-desc">
              File JSON gồm cả ảnh và ghi âm. Khôi phục sẽ gộp, bản nào sửa sau thì giữ bản đó. Sao lưu gần nhất: {backupAgo(backupAt)}.
            </p>
          </div>
        </div>
        <div className="row-actions">
          <button
            className="btn"
            onClick={async () => {
              downloadBlob(await exportJson(), `ideos-backup-${stamp()}.json`)
              markBackup()
              setBackupAt(Date.now())
            }}
          >
            Tải bản sao lưu
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Khôi phục từ file
          </button>
          <button className="text-btn" onClick={async () => downloadBlob(await exportMarkdown(), `ideos-${stamp()}.md`)}>
            Xuất Markdown
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
      </Row>

      <Row id="pref-h" title="Tuỳ chọn" desc="Lưu riêng trên máy này.">
        <label className="set-item">
          <span>
            <span className="item-title">Giao diện</span>
          </span>
          <select value={st.theme} onChange={(e) => setSettings({ theme: e.target.value as typeof st.theme })}>
            <option value="system">Theo hệ thống</option>
            <option value="light">Sáng</option>
            <option value="dark">Tối</option>
          </select>
        </label>
        <div className="set-item">
          <div>
            <p className="item-title">Dùng AI</p>
            <p className="item-desc">Chép lời ghi âm, sắp xếp ý tưởng, phản biện, hỏi tiếp khi mài. Chữ gửi cho AI không được mã hoá đầu cuối (AI phải đọc được). Tắt thì app không gọi AI và không gửi gì đi.</p>
          </div>
          <Switch label="Dùng AI" checked={st.ai} onChange={(on) => setSettings({ ai: on })} />
        </div>
        <div className="set-item">
          <div>
            <p className="item-title">Gắn vị trí khi ghi</p>
            <p className="item-desc">Để nhớ lại mình nghĩ ra ý tưởng ở đâu. Vị trí chỉ lưu trong ý tưởng.</p>
          </div>
          <Switch
            label="Gắn vị trí khi ghi"
            checked={st.geotag}
            onChange={async (on) => {
              if (on && !(await getLocation(10000))) {
                toast('Không lấy được vị trí. Kiểm tra quyền truy cập vị trí.')
                return
              }
              setSettings({ geotag: on })
            }}
          />
        </div>
        <label className="set-item">
          <span>
            <span className="item-title">Ngôn ngữ khi nói thành chữ</span>
          </span>
          <select value={st.speechLang} onChange={(e) => setSettings({ speechLang: e.target.value })}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en-US">English</option>
          </select>
        </label>
        <label className="set-item">
          <span>
            <span className="item-title">Đưa vào hàng ôn lại sau</span>
            <span className="item-desc">Ý tưởng chưa xem lại sau khoảng này sẽ được nhắc.</span>
          </span>
          <select value={st.reviewAfterDays} onChange={(e) => setSettings({ reviewAfterDays: +e.target.value })}>
            {[1, 3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} ngày
              </option>
            ))}
          </select>
        </label>
      </Row>

      {!standalone && (
        <Row id="install-h" title="Cài lên màn hình chính" desc="Sau khi cài, app mở tức thì và chạy hoàn toàn offline.">
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
            <p className="panel-note">
              {isIOS ? 'Trên iPhone: bấm nút Chia sẻ trong Safari rồi chọn "Thêm vào MH chính".' : 'Mở menu của trình duyệt và chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".'}
            </p>
          )}
        </Row>
      )}

      <Row id="help-h" title="Ghi nhanh" desc="Những cách để ghi xong một ý tưởng trong vài giây.">
        <ul className="help">
          <li>Dòng đầu là tiêu đề, các dòng sau là ghi chú.</li>
          <li>
            <code>#tag</code> gắn nhãn, ví dụ <code>#ai #giaoduc</code>.
          </li>
          <li>
            <code>@web</code> <code>@app</code> <code>@startup</code> <code>@product</code> <code>@feature</code> chọn loại.
          </li>
          <li>
            <kbd>N</kbd> ghi mới, <kbd>/</kbd> tìm, <kbd>Ctrl</kbd> + <kbd>Enter</kbd> lưu, <kbd>Esc</kbd> đóng.
          </li>
          <li>Tìm không cần gõ dấu: "y tuong" vẫn ra "ý tưởng".</li>
          <li>Trên Android: chia sẻ link hoặc đoạn chữ từ app khác vào Ideos để lưu thành ý tưởng.</li>
          <li>Ghi âm dùng được khi offline. Nói thành chữ thường cần mạng.</li>
        </ul>
      </Row>

      <Row id="danger-h" title="Xoá dữ liệu" desc={signedIn ? 'Xoá toàn bộ ý tưởng trên máy này và trên mọi máy đang đồng bộ.' : 'Xoá toàn bộ ý tưởng trên máy này.'}>
        <p className="panel-note">Không thể hoàn tác, trừ khi bạn đã tải bản sao lưu.</p>
        <button
          className="btn danger-outline"
          onClick={async () => {
            const msg = signedIn ? 'Xoá toàn bộ ý tưởng trên máy này VÀ trên mọi máy đang đồng bộ?' : 'Xoá toàn bộ ý tưởng trên máy này?'
            if (!confirm(msg + ' Không thể hoàn tác.')) return
            await clearAll(signedIn)
            toast('Đã xoá toàn bộ dữ liệu')
            refreshStorage()
          }}
        >
          {signedIn ? 'Xoá trên mọi máy' : 'Xoá tất cả ý tưởng'}
        </button>
      </Row>

      <p className="colophon muted">Ideos {__APP_VERSION__}</p>
    </div>
  )
}
