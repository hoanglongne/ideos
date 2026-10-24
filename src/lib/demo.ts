import type { Idea } from '../types'
import { emptyCanvas } from '../types'

/**
 * Bản xem thử: `?demo=1` mở một kho dữ liệu riêng ("ideos-demo") nạp sẵn ý tưởng mẫu,
 * không đụng tới dữ liệu thật và không đồng bộ.
 */
const KEY = 'ideos.demo'

function detect() {
  try {
    if (new URLSearchParams(location.search).has('demo')) sessionStorage.setItem(KEY, '1')
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const IS_DEMO = typeof location !== 'undefined' && detect()

export function enterDemo() {
  location.href = location.pathname + '?demo=1'
}

export function exitDemo() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* bỏ qua */
  }
  location.href = location.pathname
}

const DAY = 86400_000

export function demoIdeas(now = Date.now()): Idea[] {
  let n = 0
  const idea = (daysAgo: number, title: string, kind: Idea['kind'], status: Idea['status'], tags: string[], extra: Partial<Idea> = {}): Idea => {
    n++
    const createdAt = now - daysAgo * DAY - n * 3_600_000
    return {
      id: 'demo-' + n,
      title,
      body: '',
      kind,
      status,
      tags,
      pinned: false,
      scores: { impact: 0, confidence: 0, ease: 0 },
      canvas: emptyCanvas(),
      tasks: [],
      links: [],
      related: [],
      createdAt,
      updatedAt: createdAt + Math.min(daysAgo, 2) * DAY,
      ...extra,
    }
  }
  const t = (id: string, text: string, done = false) => ({ id, text, done })
  return [
    idea(0, 'App tìm bạn chạy bộ quanh hồ Tây theo pace', 'app', 'spark', ['fitness', 'social'], {
      body: 'Ghép cặp theo pace và giờ chạy. Sáng 5h30 hồ Tây đông mà ai cũng chạy một mình.',
    }),
    idea(1, 'Web so sánh giá vé xe khách liên tỉnh', 'web', 'exploring', ['travel'], {
      scores: { impact: 7, confidence: 6, ease: 5 },
      tasks: [t('d1', 'Liệt kê 10 nhà xe tuyến Hà Nội – Sapa', true), t('d2', 'Xem họ có API hay phải tự lấy dữ liệu')],
    }),
    idea(2, 'Cho thuê đồ cắm trại theo cuối tuần', 'startup', 'validating', ['travel', 'rental'], {
      pinned: true,
      body: 'Gói lều, bếp, đèn cho 2–4 người, giao tận nhà tối thứ Sáu.',
      scores: { impact: 8, confidence: 6, ease: 6 },
      canvas: {
        ...emptyCanvas(),
        problem: 'Đi cắm trại 2–3 lần một năm, mua đồ thì phí và chật nhà.',
        audience: 'Nhân viên văn phòng 24–32 tuổi ở Hà Nội',
        solution: 'Gói lều + bếp + đèn giao tận nhà tối thứ Sáu, lấy lại tối Chủ nhật',
      },
      tasks: [t('d3', 'Hỏi 5 người trong nhóm phượt', true), t('d4', 'Báo giá 3 xưởng lều', true), t('d5', 'Làm landing page đặt trước')],
      links: ['https://www.google.com/maps/search/cắm+trại+ba+vì'],
    }),
    idea(3, 'Extension tóm tắt video bài giảng thành ghi chú', 'feature', 'spark', ['ai', 'edu']),
    idea(5, 'Bảng giá điện theo giờ cho nhà có pin mặt trời', 'web', 'parked', ['energy'], { scores: { impact: 6, confidence: 3, ease: 4 } }),
    idea(9, 'Sổ chi tiêu chung cho các cặp đôi', 'app', 'building', ['finance'], {
      scores: { impact: 7, confidence: 7, ease: 6 },
      tasks: [t('d6', 'Thiết kế màn hình chia đôi hoá đơn', true), t('d7', 'Bản thử cho 10 cặp')],
    }),
    idea(12, 'Đặt lịch cắt tóc qua Zalo cho tiệm nhỏ', 'product', 'exploring', ['smb'], { scores: { impact: 6, confidence: 5, ease: 7 } }),
    idea(16, 'Bản đồ quán cà phê có ổ cắm và wifi ổn', 'web', 'spark', ['coffee', 'remote']),
    idea(23, 'Nhắc uống thuốc cho bố mẹ qua cuộc gọi tự động', 'product', 'spark', ['health']),
    idea(30, 'Chợ đồ cũ cho sinh viên trong ký túc xá', 'startup', 'dropped', ['edu', 'marketplace'], { scores: { impact: 5, confidence: 3, ease: 4 } }),
    idea(41, 'Widget đếm ngược tới chuyến đi tiếp theo', 'feature', 'shipped', ['travel']),
    idea(55, 'Thực đơn tuần từ đồ còn trong tủ lạnh', 'app', 'parked', ['food', 'ai']),
    idea(70, 'Dịch vụ in lịch treo tường từ ảnh gia đình', 'product', 'spark', ['print']),
    idea(96, 'Bảng tin việc làm bán thời gian quanh trường', 'web', 'exploring', ['edu', 'jobs'], { scores: { impact: 6, confidence: 4, ease: 6 } }),
  ]
}
