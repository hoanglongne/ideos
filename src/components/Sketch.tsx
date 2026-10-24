import { useEffect, useRef, useState } from 'react'

const COLORS = ['#111111', '#e5484d', '#3e9bff', '#30a46c', '#f5a524']

/** Bảng vẽ nhanh để phác giao diện / sơ đồ. Trả về PNG. */
export function Sketch({ onDone, onCancel }: { onDone: (b: Blob) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState(COLORS[0])
  const [width, setWidth] = useState(4)
  const history = useRef<ImageData[]>([])
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const c = ref.current!
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr
    c.height = rect.height * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const down = (e: React.PointerEvent) => {
    const c = ref.current!
    c.setPointerCapture(e.pointerId)
    const ctx = c.getContext('2d')!
    history.current.push(ctx.getImageData(0, 0, c.width, c.height))
    if (history.current.length > 30) history.current.shift()
    drawing.current = true
    last.current = pos(e)
    move(e)
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return
    const ctx = ref.current!.getContext('2d')!
    const p = pos(e)
    ctx.strokeStyle = color
    ctx.lineWidth = width * (e.pressure && e.pointerType === 'pen' ? 0.5 + e.pressure : 1)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x + 0.01, p.y + 0.01)
    ctx.stroke()
    last.current = p
  }

  const up = () => {
    drawing.current = false
    last.current = null
  }

  const undo = () => {
    const img = history.current.pop()
    if (img) ref.current!.getContext('2d')!.putImageData(img, 0, 0)
  }

  const done = () => ref.current!.toBlob((b) => b && onDone(b), 'image/png')

  return (
    <div className="sketch-overlay">
      <div className="sketch-toolbar">
        <button className="btn ghost" onClick={onCancel}>
          Huỷ
        </button>
        <div className="sketch-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Màu ${c}`}
              className={'swatch' + (c === color ? ' on' : '')}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <button className={'swatch eraser' + (color === '#ffffff' ? ' on' : '')} aria-label="Tẩy" onClick={() => setColor('#ffffff')}>
            ⌫
          </button>
        </div>
        <input type="range" min={2} max={20} value={width} onChange={(e) => setWidth(+e.target.value)} aria-label="Độ dày nét" />
        <button className="btn ghost" onClick={undo}>
          ↶
        </button>
        <button className="btn primary" onClick={done}>
          Xong
        </button>
      </div>
      <canvas
        ref={ref}
        className="sketch-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </div>
  )
}
