import { useState } from 'react'
import schemaSql from '../../supabase/schema.sql?raw'
import { timeAgo } from '../lib/util'
import { forgetConfig, requestSync, saveConfig, signIn, signOut, signUp, useSync, type SyncState } from '../sync/manager'
import { useToast } from './Toast'

export function syncLabel(s: SyncState): string {
  switch (s.status) {
    case 'syncing':
      return 'Đang đồng bộ…'
    case 'offline':
      return s.pending ? `Offline — ${s.pending} thay đổi chờ đẩy lên` : 'Offline — sẽ đồng bộ khi có mạng'
    case 'error':
      return 'Lỗi đồng bộ: ' + (s.error ?? 'không rõ') + ' — sẽ tự thử lại'
    case 'idle':
      if (s.pending) return `${s.pending} thay đổi chờ đồng bộ`
      return s.lastSyncAt ? `Đã đồng bộ ${timeAgo(s.lastSyncAt)}` : 'Đã kết nối'
    default:
      return ''
  }
}

export function SyncPanel() {
  const s = useSync()
  return (
    <section className="card-plain">
      <h3>☁️ Đồng bộ giữa các máy</h3>
      {s.status === 'disabled' ? <Setup /> : !s.email ? <Login /> : <Connected s={s} />}
    </section>
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

function Setup() {
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [busy, run] = useAction()
  const toast = useToast()
  return (
    <>
      <p className="muted small">
        Dùng Supabase (gói miễn phí là đủ) làm kho đồng bộ riêng của bạn. Dữ liệu vẫn nằm trên máy và dùng offline bình thường — khi có mạng, app tự đẩy/kéo thay đổi.
      </p>
      <details className="howto">
        <summary>Cách thiết lập (≈ 3 phút)</summary>
        <ol>
          <li>
            Tạo project miễn phí tại{' '}
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
              supabase.com
            </a>
          </li>
          <li>
            Mở <b>SQL Editor</b>, dán đoạn SQL bên dưới rồi bấm <b>Run</b>{' '}
            <button
              type="button"
              className="btn small-btn"
              onClick={async () => {
                await navigator.clipboard.writeText(schemaSql)
                toast('Đã chép SQL')
              }}
            >
              Chép SQL
            </button>
          </li>
          <li>
            Vào <b>Project Settings → API</b>, chép <b>Project URL</b> và <b>anon / publishable key</b> dán vào ô dưới
          </li>
          <li>
            Ở <b>Authentication → URL Configuration</b>, đặt <b>Site URL</b> là địa chỉ app này ({location.origin}) để link xác nhận email mở đúng app — hoặc tắt "Confirm email" nếu chỉ mình bạn dùng
          </li>
        </ol>
      </details>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => saveConfig(url, key))
        }}
      >
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" inputMode="url" autoComplete="off" aria-label="Project URL" />
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="anon / publishable key" autoComplete="off" aria-label="API key" />
        <button className="btn primary" disabled={busy || !url || !key}>
          Kết nối
        </button>
      </form>
    </>
  )
}

function Login() {
  const s = useSync()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, run] = useAction()
  const toast = useToast()
  return (
    <>
      <p className="muted small">
        {mode === 'in' ? 'Đăng nhập cùng một tài khoản trên mọi máy để thấy chung ý tưởng.' : 'Tạo tài khoản trên Supabase của bạn.'} Ý tưởng đang có trên máy này sẽ được gộp vào tài khoản.
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            if (mode === 'in') await signIn(email, pw)
            else if (await signUp(email, pw)) {
              toast('Kiểm tra email để xác nhận, rồi quay lại đăng nhập')
              setMode('in')
            }
          })
        }}
      >
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" aria-label="Email" required />
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Mật khẩu (≥ 6 ký tự)"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          aria-label="Mật khẩu"
          minLength={6}
          required
        />
        <button className="btn primary" disabled={busy}>
          {mode === 'in' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </button>
      </form>
      <div className="row wrap gap">
        <button className="btn ghost" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Chưa có tài khoản? Tạo mới' : 'Đã có tài khoản? Đăng nhập'}
        </button>
        {!s.configFromEnv && (
          <button className="btn ghost muted" onClick={() => run(forgetConfig)}>
            Đổi server
          </button>
        )}
      </div>
      {!s.configFromEnv && <p className="muted small">Server: {s.url.replace(/^https?:\/\//, '')}</p>}
    </>
  )
}

function Connected({ s }: { s: SyncState }) {
  const [busy, run] = useAction()
  const [confirmOut, setConfirmOut] = useState(false)
  return (
    <>
      <div className={'sync-line ' + s.status}>
        <span className="sync-dot" />
        <span>{syncLabel(s)}</span>
      </div>
      <p className="muted small">Tài khoản: {s.email}</p>
      <div className="row wrap gap">
        <button className="btn" disabled={s.status === 'syncing'} onClick={() => requestSync(0)}>
          ⟳ Đồng bộ ngay
        </button>
        <button className="btn ghost" onClick={() => setConfirmOut(!confirmOut)}>
          Đăng xuất
        </button>
      </div>
      {confirmOut && (
        <div className="confirm-box">
          {s.pending > 0 && <p className="danger-text small">Còn {s.pending} thay đổi chưa đồng bộ — app sẽ cố đẩy lên trước khi thoát.</p>}
          <div className="row wrap gap">
            <button className="btn" disabled={busy} onClick={() => run(() => signOut(false))}>
              Thoát, giữ dữ liệu trên máy
            </button>
            <button className="btn danger" disabled={busy || (s.pending > 0 && s.status === 'offline')} onClick={() => run(() => signOut(true))}>
              Thoát & xoá dữ liệu trên máy này
            </button>
          </div>
        </div>
      )}
    </>
  )
}
