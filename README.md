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
- Máy chủ riêng của bạn trên Cloudflare (Worker + D1, gói free, không cần thẻ), chạy cùng địa chỉ với app
- Không tài khoản, không email: máy đầu tạo **mã đồng bộ**, máy khác nhập mã, chép link hoặc quét QR
- Mã hoá đầu cuối: nội dung, ảnh, ghi âm được mã hoá AES-GCM trên máy trước khi gửi; máy chủ chỉ thấy bản mã
- Offline-first: mất mạng vẫn ghi/sửa bình thường; có mạng lại thì tự đẩy/kéo; máy đang mở nhận thay đổi trong khoảng 20 giây
- Xung đột: bản sửa sau cùng thắng (theo từng ý tưởng); xoá cũng được đồng bộ
- Dữ liệu có sẵn trên máy được gộp vào kho khi ghép lần đầu

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
npm run dev        # giao diện, tự nạp lại khi sửa code
npm run dev:api    # (cửa sổ thứ hai) máy chủ đồng bộ + D1 chạy local ở cổng 8787; `npm run dev` tự chuyển /api sang đây
npm run preview:cf # chạy đúng như bản deploy: build rồi phục vụ app + API bằng wrangler (http://localhost:8787)
npm test           # test logic đồng bộ và mã hoá
```

Sinh lại icon PNG từ `public/icon.svg`: `node scripts/icons.mjs` (cần Playwright).

## Đưa lên Cloudflare

Một Worker phục vụ cả app lẫn API đồng bộ, dữ liệu nằm trong D1. Gói Workers Free đủ dư cho một người
(D1 free: 5 GB, 100.000 lượt ghi mỗi ngày) và không cần thẻ thanh toán.

```bash
npx wrangler login                    # mở trình duyệt để đăng nhập Cloudflare
npx wrangler d1 create ideos          # in ra database_id
# dán database_id vào wrangler.jsonc (thay dòng 0000…)
npm run deploy                        # build, tạo bảng trên D1, deploy
```

Xong sẽ có địa chỉ `https://ideos.<tên-tài-khoản>.workers.dev`. Mở trên điện thoại để cài PWA, rồi vào
**Cài đặt → Đồng bộ → Bật đồng bộ**. Trên máy khác: nhập mã, dán link ghép máy hoặc quét QR.

- `MAX_VAULTS` trong `wrangler.jsonc` (mặc định 3) giới hạn số mã đồng bộ máy chủ nhận, để người lạ biết địa chỉ cũng không dùng ké được D1 của bạn.
- Nếu app nằm ở chỗ khác (vd. Vercel), build app với `VITE_SYNC_URL=https://ideos.<tài-khoản>.workers.dev` (xem `.env.example`). API đã mở CORS.
- Giữ mã đồng bộ cẩn thận: ai có mã là đọc được dữ liệu. Mất mã thì không khôi phục được dữ liệu trên máy chủ, nhưng dữ liệu trên từng máy vẫn còn.

Cách hoạt động: mỗi bản ghi trên máy có cờ `dirty`; một vòng đồng bộ đẩy các bản ghi `dirty` và "bia mộ" (bản ghi đã xoá),
rồi kéo các hàng có `seq` lớn hơn con trỏ lần trước. Máy chủ cấp `seq` theo đúng thứ tự commit (dành chỗ và ghi trong cùng
một transaction D1), nên không bao giờ bỏ sót dòng; nó cũng bỏ qua bản ghi cũ hơn bản đang có, nên thứ tự đồng bộ giữa các máy
không ảnh hưởng kết quả. Từ mã đồng bộ, máy suy ra định danh kho, token truy cập và khoá mã hoá; máy chủ chỉ lưu hash của token.
Logic ở `src/sync/engine.ts` và `src/sync/crypto.ts`, có test (`npm test`); máy chủ ở `worker/index.ts`, schema ở `migrations/`.

## Kỹ thuật

Vite + React + TypeScript, Dexie (IndexedDB), vite-plugin-pwa (Workbox). Đồng bộ (tuỳ chọn) qua một Cloudflare Worker + D1, mã hoá bằng WebCrypto.

```
src/
  db.ts              schema Dexie + thao tác ý tưởng
  types.ts           kiểu dữ liệu, danh sách loại/trạng thái/canvas
  lib/               util, ghi âm/đọc chính tả/vị trí, sao lưu, settings, router hash
  sync/              engine đồng bộ, mã hoá, adapter Cloudflare, quản lý mã & lịch đồng bộ
  components/        CaptureSheet, IdeaList, IdeaDetail, Review, Stats, Settings, SyncPanel, Sketch…
worker/index.ts      máy chủ: phục vụ app tĩnh + API /api/v1 trên D1
migrations/          schema D1
wrangler.jsonc       cấu hình Cloudflare (tên Worker, D1, MAX_VAULTS)
```
