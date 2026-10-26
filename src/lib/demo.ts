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
      journal: [],
      assumptions: [],
      evidence: [],
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
      assumptions: [
        { id: 'da1', text: 'Dân văn phòng chịu trả 250 nghìn cho một cuối tuần thay vì mua lều', risk: 3, test: 'Đăng bài đặt trước vào 2 nhóm phượt, đếm số người chuyển cọc 50 nghìn', status: 'testing', createdAt: now - 2 * DAY },
        { id: 'da2', text: 'Giao và nhận đồ trong nội thành mất dưới 1 tiếng mỗi chuyến', risk: 2, test: 'Tự chạy thử 3 chuyến Cầu Giấy – Long Biên', status: 'holds', createdAt: now - 2 * DAY + 1 },
        { id: 'da3', text: 'Đồ bị hỏng hoặc mất dưới 5% số lần thuê', risk: 2, test: '', status: 'untested', createdAt: now - 2 * DAY + 2 },
      ],
      evidence: [
        { id: 'de1', at: now - DAY, text: 'Năm ngoái mình mua lều 2 triệu, dùng đúng 1 lần rồi để gầm giường.', source: 'Chị Lan, nhóm Phượt Hà Nội', signal: 'for', assumptionId: 'da1' },
        { id: 'de2', at: now - DAY + 1, text: 'Thuê thì thuê, nhưng phải có người dựng hộ, mình không biết dựng.', source: 'Anh Minh, đồng nghiệp', signal: 'neutral', assumptionId: 'da1' },
        { id: 'de3', at: now - 3_600_000, text: 'Chạy thử Cầu Giấy – Long Biên hết 42 phút giờ cao điểm.', source: 'Tự đo', signal: 'for', assumptionId: 'da2' },
      ],
      journal: [
        { id: 'dj1', at: now - 2 * DAY - 3_600_000, kind: 'note', text: 'Đi Ba Vì thấy 3 nhóm thuê lều của một homestay, giá 300 nghìn một đêm mà vẫn hết chỗ.' },
        { id: 'dj2', at: now - 2 * DAY, kind: 'status', text: 'Chuyển từ “Đang nghĩ” sang “Kiểm chứng”.' },
        { id: 'dj3', at: now - DAY, kind: 'coach', text: 'Vấn đề: Mua lều thì phí, dùng 2–3 lần một năm.\nGiả định: Người ta chịu trả 250 nghìn; giao nhận dưới 1 tiếng; đồ ít hỏng.\nViệc 48 giờ: Làm landing page đặt trước.' },
        { id: 'dj4', at: now - 3_000_000, kind: 'note', text: 'Có thể bán thêm gói "dựng hộ" 100 nghìn, vì anh Minh không biết dựng lều.' },
      ],
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
