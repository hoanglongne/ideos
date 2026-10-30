import { lazy, Suspense, useState } from 'react'
import { timeAgo } from '../lib/util'
import { SyncHttpError } from '../sync/cloudflare'
import { GONE, joinVault, leaveVault, requestSync, startNewVault, useSync, type SyncState } from '../sync/manager'
import { useToast } from './Toast'

/** Link ghép máy: mã nằm sau dấu #, nên không bao giờ được gửi lên máy chủ. */
const pairLink = (code: string) => `${location.origin}${location.pathname}#pair=${code}`

let pendingPair: string | null = null
/** Gọi một lần lúc khởi động: nếu app được mở bằng link ghép máy thì giữ mã lại và dọn địa chỉ. */
export function takePairLink(): boolean {
  const m = location.hash.match(/^#pair=([^&]+)/)
  if (!m) return false
  pendingPair = decodeURIComponent(m[1])
  history.replaceState(null, '', location.pathname + '#/settings')
  return true
}

export function syncLabel(s: SyncState): string {
  switch (s.status) {
    case 'syncing':
      return 'Đang đồng bộ…'
    case 'offline':
      return s.pending ? `Offline, ${s.pending} thay đổi chờ đẩy lên` : 'Offline, sẽ đồng bộ khi có mạng'
    case 'error':
      if (s.error === GONE) return GONE
      return 'Lỗi đồng bộ: ' + (s.error ?? 'không rõ').replace(/\.$/, '') + '. Sẽ tự thử lại.'
    case 'idle':
      if (s.pending) return `${s.pending} thay đổi chờ đồng bộ`
      return s.lastSyncAt ? `Đã đồng bộ ${timeAgo(s.lastSyncAt)}` : 'Đã kết nối'
    default:
      return ''
  }
}

export function SyncPanel() {
  const s = useSync()
  if (s.status === 'checking')
    return <p className="panel-note">{navigator.onLine ? 'Đang kiểm tra máy chủ đồng bộ…' : 'Đang offline. Có mạng lại app sẽ kiểm tra máy chủ đồng bộ.'}</p>
  if (s.status === 'unavailable') return <Unavailable />
  if (!s.code) return <Pair />
  return <Connected s={s} />
}

/** Trạng thái đồng bộ gọn cho thanh bên / thanh trên điện thoại. */
export function SyncStatus({ compact }: { compact?: boolean }) {
  const s = useSync()
  if (!s.code) return null
  const short = s.status === 'syncing' ? 'Đang đồng bộ' : s.status === 'error' ? 'Lỗi đồng bộ' : s.status === 'offline' ? 'Offline' : s.pending ? `${s.pending} chờ` : 'Đã đồng bộ'
  return (
    <a href="#/settings" className={'sync-status ' + s.status + (compact ? ' compact' : '')} title={syncLabel(s)}>
      <span className="sync-dot" aria-hidden="true" />
      <span>{compact ? short : syncLabel(s)}</span>
    </a>
  )
}

function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return [busy, run] as const
}

function Unavailable() {
  return (
    <>
      <p className="panel-note">Địa chỉ này chưa có máy chủ đồng bộ của Ideos, nên tạm thời mỗi máy giữ dữ liệu riêng.</p>
      <p className="panel-note">
        Máy chủ chạy miễn phí trên Cloudflare cùng với app. Deploy theo hướng dẫn trong README (phần <b>Đưa lên Cloudflare</b>) là mục này tự bật. Trong lúc chờ, bạn vẫn chuyển dữ liệu được bằng sao lưu và khôi phục ở dưới.
      </p>
    </>
  )
}

const QrFigure = lazy(() => import('./QrFigure'))

function Pair() {
  const [code, setCode] = useState(() => pendingPair ?? '')
  const [busy, run] = useAction()
  const [needKey, setNeedKey] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  /** Máy chủ đặt khoá quản trị thì hỏi khoá rồi mới tạo mã mới; ghép máy bằng mã có sẵn không cần khoá. */
  const start = async () => {
    try {
      await startNewVault(adminKey.trim() || undefined)
    } catch (e) {
      if (e instanceof SyncHttpError && e.code === 'admin_key_required') {
        setNeedKey(true)
        throw new Error(adminKey ? 'Khoá quản trị chưa đúng.' : 'Máy chủ này cần khoá quản trị để tạo mã mới. Nhập khoá rồi bấm lại.')
      }
      throw e
    }
  }
  return (
    <>
      <div className="set-item">
        <div>
          <p className="item-title">Máy đầu tiên</p>
          <p className="item-desc">Tạo mã đồng bộ cho kho dữ liệu của bạn. Ý tưởng đang có trên máy này sẽ được đưa lên.</p>
        </div>
        <button className="btn primary" disabled={busy} onClick={() => run(start)}>
          Bật đồng bộ
        </button>
      </div>
      {needKey && (
        <label className="field set-item-block">
          <span className="field-label">Khoá quản trị của máy chủ</span>
          <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} autoComplete="off" aria-label="Khoá quản trị" />
          <span className="item-desc">Là giá trị bạn đặt cho ADMIN_KEY khi cấu hình máy chủ. Chỉ cần khi tạo mã mới, không lưu lại trên máy này.</span>
        </label>
      )}
      <form
        className="stack set-item-block"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => joinVault(code))
        }}
      >
        <label className="field">
          <span className="field-label">Đã có mã từ máy khác?</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-…" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-label="Mã đồng bộ" />
        </label>
        <p className="item-desc">Dán mã hoặc cả đường link ghép máy. Ý tưởng trên máy này sẽ được gộp với dữ liệu đã có.</p>
        <button className="btn" disabled={busy || code.trim().length < 20}>
          Ghép máy này
        </button>
      </form>
    </>
  )
}

function Connected({ s }: { s: SyncState }) {
  const [busy, run] = useAction()
  const toast = useToast()
  const [showQr, setShowQr] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [wipeLocal, setWipeLocal] = useState(false)
  const [wipeServer, setWipeServer] = useState(false)
  const link = pairLink(s.code!)

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Đã chép ' + what)
    } catch {
      toast('Không chép được, hãy chọn và chép bằng tay')
    }
  }

  return (
    <>
      <div className={'sync-line ' + s.status}>
        <span className="sync-dot" aria-hidden="true" />
        <span>{syncLabel(s)}</span>
      </div>
      <div className="row-actions">
        <button className="btn" disabled={s.status === 'syncing'} onClick={() => requestSync(0)}>
          Đồng bộ ngay
        </button>
      </div>

      <div className="set-item-block">
        <p className="item-title">Mã đồng bộ</p>
        <p className="item-desc">Nhập mã này trên máy khác để thấy chung ý tưởng. Ai có mã đều đọc được dữ liệu của bạn, nên đừng đăng công khai.</p>
        <p className="vault-code" aria-label="Mã đồng bộ">
          {s.code}
        </p>
        <div className="row-actions">
          <button className="btn" onClick={() => copy(s.code!, 'mã')}>
            Chép mã
          </button>
          <button className="btn" onClick={() => copy(link, 'link ghép máy')}>
            Chép link
          </button>
          <button className="text-btn" onClick={() => setShowQr(!showQr)} aria-expanded={showQr}>
            {showQr ? 'Ẩn mã QR' : 'Hiện mã QR'}
          </button>
        </div>
        {showQr && (
          <Suspense fallback={<p className="item-desc">Đang tạo mã QR…</p>}>
            <QrFigure link={link} />
          </Suspense>
        )}
      </div>

      <div className="set-item-block">
        <button className="text-btn" onClick={() => setLeaving(!leaving)} aria-expanded={leaving}>
          Ngắt đồng bộ trên máy này
        </button>
        {leaving && (
          <div className="confirm-box">
            {s.pending > 0 && <p className="panel-note danger-text">Còn {s.pending} thay đổi chưa đồng bộ. App sẽ cố đẩy lên trước khi ngắt.</p>}
            <label className="check-row">
              <input type="checkbox" checked={wipeLocal} onChange={(e) => setWipeLocal(e.target.checked)} />
              <span>Xoá ý tưởng trên máy này</span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={wipeServer} onChange={(e) => setWipeServer(e.target.checked)} />
              <span>Xoá luôn dữ liệu trên máy chủ (các máy khác sẽ không đồng bộ được nữa)</span>
            </label>
            <div className="row-actions">
              <button className={wipeLocal || wipeServer ? 'btn danger-outline' : 'btn'} disabled={busy} onClick={() => run(() => leaveVault({ wipeLocal, wipeServer }))}>
                {wipeLocal || wipeServer ? 'Ngắt và xoá' : 'Ngắt, giữ dữ liệu trên máy'}
              </button>
              <button className="text-btn" onClick={() => setLeaving(false)}>
                Huỷ
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
