import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/** Mã QR chứa link ghép máy. Tách riêng để thư viện QR chỉ tải khi bấm "Hiện mã QR". */
export default function QrFigure({ link }: { link: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(link)
    q.make()
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
  }, [link])
  return (
    <figure className="qr">
      <div className="qr-img" role="img" aria-label="Mã QR chứa link ghép máy" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="item-desc">Quét bằng camera điện thoại để mở link. Trên iPhone, nếu đã cài app, hãy chép link rồi dán vào ô mã trong app đã cài.</figcaption>
    </figure>
  )
}
