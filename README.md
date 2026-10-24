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

**☁️ Đồng bộ giữa các máy (tuỳ chọn)**
- Dùng Supabase của chính bạn (gói free là đủ) — đăng nhập cùng tài khoản trên điện thoại, laptop…
- Offline-first: vẫn ghi/sửa bình thường khi mất mạng, có mạng lại thì tự đẩy/kéo; máy khác nhận thay đổi gần như tức thì (Realtime)
- Xung đột: bản sửa sau cùng thắng (theo từng ý tưởng); xoá cũng được đồng bộ; ảnh & ghi âm lưu trong Storage riêng tư
- Dữ liệu có sẵn trên máy được gộp vào tài khoản khi đăng nhập lần đầu

**Khác**
- Tìm kiếm không cần dấu ("y tuong" khớp "ý tưởng"), lọc theo trạng thái/loại/tag, nhiều kiểu sắp xếp
- Sao lưu/khôi phục JSON (gồm cả ảnh & ghi âm, gộp theo bản mới hơn), xuất Markdown
- Xin quyền lưu trữ bền vững để trình duyệt không tự xoá dữ liệu
- Sáng/tối, phím tắt `N` / `/` / `Ctrl+Enter` / `Esc`, báo khi có bản cập nhật

## Giao diện

Thiết kế theo quy trình app-screen của [taste-skill](https://github.com/Leonxlnx/taste-skill) (style *editorial greeting*)
và chế độ *Operate* của [impeccable](https://github.com/pbakaus/impeccable):

- Mỗi màn hình trả lời một câu hỏi trước tiên. Màn chính mở bằng lời chào dựng từ dữ liệu ("Thứ Bảy, 5 ý tưởng mới tuần này.")
  và **dải tiến trình**: số ý tưởng ở từng giai đoạn, đồng thời là bộ lọc chính.
- Màu chỉ nằm trên dữ liệu: teal cho các giai đoạn đang làm, điểm ICE, nhịp ghi; khung giao diện là đen trắng và một tông giấy.
- Không emoji, không gradient, không bóng đổ cho thứ đứng yên; icon nét mảnh (lucide), chữ số tabular để cột số thẳng hàng.
- Font tự host để chạy offline: **Plus Jakarta Sans** (có dấu tiếng Việt và chữ số tabular) và **Newsreader** cho lời chào.
- `?demo=1` mở bản xem thử với dữ liệu mẫu trong một kho riêng, không đụng dữ liệu thật và không đồng bộ.

## Chạy

```bash
npm install
npm run dev        # dev server
npm run build      # typecheck + build ra dist/ (kèm service worker)
npm run preview    # chạy bản build để thử offline / cài PWA
npm test           # test logic đồng bộ
```

Deploy `dist/` lên bất kỳ static host nào có HTTPS (Vercel, Netlify, Cloudflare Pages, GitHub Pages…) để cài được PWA trên điện thoại.
Sinh lại icon PNG từ `public/icon.svg`: `node scripts/icons.mjs` (cần Playwright).

## Bật đồng bộ

1. Tạo project miễn phí ở [supabase.com](https://supabase.com/dashboard)
2. **SQL Editor** → dán [`supabase/schema.sql`](supabase/schema.sql) → **Run** (trong app có nút "Chép SQL")
3. **Project Settings → API**: chép *Project URL* và *anon / publishable key* vào **Cài đặt → Đồng bộ** trong app
   (hoặc đặt sẵn lúc build bằng `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, xem `.env.example`)
4. **Authentication → URL Configuration**: đặt *Site URL* là địa chỉ app để link xác nhận email mở đúng app,
   hoặc tắt *Confirm email* nếu chỉ mình bạn dùng
5. Tạo tài khoản trên máy thứ nhất, đăng nhập cùng tài khoản trên các máy khác

Cách hoạt động: mỗi bản ghi có cờ `dirty`; một vòng đồng bộ đẩy các bản ghi `dirty` + "bia mộ" (bản ghi đã xoá) lên,
rồi kéo mọi hàng có `server_updated_at` mới hơn con trỏ lần trước. Server (trigger trong `schema.sql`) bỏ qua bản ghi
cũ hơn bản đang có, nên thứ tự đồng bộ giữa các máy không ảnh hưởng kết quả. Row Level Security đảm bảo mỗi người chỉ
thấy dữ liệu của mình. Logic nằm ở `src/sync/engine.ts`, có test ở `src/sync/engine.test.ts` (`npm test`).

## Kỹ thuật

Vite + React + TypeScript, Dexie (IndexedDB), vite-plugin-pwa (Workbox). Không cần backend; đồng bộ (tuỳ chọn) qua Supabase, thư viện chỉ được tải khi bật.

```
src/
  db.ts              schema Dexie + thao tác ý tưởng
  types.ts           kiểu dữ liệu, danh sách loại/trạng thái/canvas
  lib/               util, ghi âm/đọc chính tả/vị trí, sao lưu, settings, router hash
  sync/              engine đồng bộ, adapter Supabase, quản lý phiên & lịch đồng bộ
  components/        CaptureSheet, IdeaList, IdeaDetail, Review, Stats, Settings, SyncPanel, Sketch…
supabase/schema.sql  bảng, trigger "bản mới hơn thắng", RLS, Realtime, Storage bucket
```
