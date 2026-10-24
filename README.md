# 💡 Ideos

Sổ ghi ý tưởng web / app / startup / sản phẩm — dành cho lúc chợt nghĩ ra gì đó khi đang đi ngoài đường.
PWA offline-first: cài lên màn hình chính, mở tức thì, ghi được cả khi không có mạng. Dữ liệu nằm hoàn toàn trên máy (IndexedDB).

## Tính năng

**Ghi nhanh**
- Nút `+` luôn sẵn, mở sheet nhập — dòng đầu là tiêu đề, phần sau là ghi chú
- Cú pháp nhanh: `#tag` gắn nhãn, `@web` `@app` `@startup` `@product` `@feature` chọn loại
- 🎙️ Ghi âm (chạy offline), 🗣️ nói→chữ (Web Speech API, thường cần mạng), 📷 ảnh (tự nén), ✏️ bảng phác thảo
- Bản nháp tự lưu nếu lỡ đóng; 📍 tuỳ chọn gắn vị trí nơi nảy ra ý tưởng
- Share target trên Android: chia sẻ link/text từ app khác vào Ideos; shortcut "Ghi mới" khi nhấn giữ icon

**Phát triển ý tưởng**
- Vòng đời: Mới nảy ra → Đang nghĩ → Kiểm chứng → Đang làm → Đã ra mắt (hoặc Để sau / Bỏ)
- ⚡ Chấm điểm ICE (Impact × Confidence × Ease) để xếp hạng nên làm cái nào trước
- 🧭 Lean canvas: vấn đề, người dùng, giải pháp, kiếm tiền, đối thủ, lợi thế riêng
- ☑ Checklist bước tiếp theo (có gợi ý sẵn), 🔗 link tham khảo, 🕸 nối các ý tưởng liên quan (tự gợi ý theo tag/từ chung)
- Ghim, nhân bản, chia sẻ dạng Markdown, xoá có hoàn tác

**Không để ý tưởng bị chôn vùi**
- 🔁 Ôn lại: ý tưởng chưa xem sau N ngày được đưa ra lần lượt — Vẫn hay / Để sau / Bỏ, kèm câu hỏi gợi mở
- 🎲 Trộn: ghép ngẫu nhiên 2 ý tưởng thành combo mới
- 📊 Thống kê: heatmap 16 tuần, chuỗi ngày ghi liên tiếp, top ICE, phân bổ theo trạng thái/loại/tag

**Khác**
- Tìm kiếm không cần dấu ("y tuong" khớp "ý tưởng"), lọc theo trạng thái/loại/tag, nhiều kiểu sắp xếp
- Sao lưu/khôi phục JSON (gồm cả ảnh & ghi âm, gộp theo bản mới hơn), xuất Markdown
- Xin quyền lưu trữ bền vững để trình duyệt không tự xoá dữ liệu
- Sáng/tối, phím tắt `N` / `/` / `Ctrl+Enter` / `Esc`, báo khi có bản cập nhật

## Chạy

```bash
npm install
npm run dev        # dev server
npm run build      # typecheck + build ra dist/ (kèm service worker)
npm run preview    # chạy bản build để thử offline / cài PWA
```

Deploy `dist/` lên bất kỳ static host nào có HTTPS (Vercel, Netlify, Cloudflare Pages, GitHub Pages…) để cài được PWA trên điện thoại.
Sinh lại icon PNG từ `public/icon.svg`: `node scripts/icons.mjs` (cần Playwright).

## Kỹ thuật

Vite + React + TypeScript, Dexie (IndexedDB), vite-plugin-pwa (Workbox). Không backend, không tài khoản.

```
src/
  db.ts              schema Dexie + thao tác ý tưởng
  types.ts           kiểu dữ liệu, danh sách loại/trạng thái/canvas
  lib/               util, ghi âm/đọc chính tả/vị trí, sao lưu, settings, router hash
  components/        CaptureSheet, IdeaList, IdeaDetail, Review, Stats, Settings, Sketch…
```
