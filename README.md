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

**Nuôi ý tưởng lớn dần**
- **Nhật ký:** mỗi lần nghĩ thêm là một dòng có ngày giờ. Khi bấm Ghi, chọn "Ghi tiếp vào…" để ghi nối vào ý tưởng có sẵn
  (tìm không cần dấu, `#tag` gộp vào tag của ý tưởng). Đổi giai đoạn, kết quả mài và AI phản biện cũng được ghi lại.
- **Mài ý tưởng:** mỗi lần một câu hỏi sắc, chọn theo giai đoạn và chỗ ý tưởng còn trống (ai đau nhất, họ đang xoay xở
  thế nào, điều gì phải đúng, cách thử rẻ nhất trong tuần…). Câu trả lời tự vào canvas, giả định, bằng chứng, việc tiếp theo.
- **Giả định & bằng chứng:** ghi điều phải đúng (kèm mức rủi ro và cách thử), ghi lời người dùng thật (ủng hộ / phản bác).
  Điểm Confidence của ICE được gợi ý từ bằng chứng; còn giả định rủi ro cao chưa thử thì không vượt 6.
- **Bài toán tiền:** chọn mô hình gần nhất trong 8 mô hình (SaaS, app thuê bao, bán hàng online, sàn, quán ăn, dịch vụ,
  khoá học, nội dung), app điền sẵn số trung bình rồi tính cần bao nhiêu khách, bao nhiêu vốn, bao lâu hoà vốn. Ô nào
  chưa phải số của bạn có viền nét đứt và ghi "ước lượng". App làm xấu từng con số đi 30% để xem con số nào làm đổ kế
  hoạch nhanh nhất, rồi thêm thẳng vào danh sách giả định kèm mức rủi ro và cách thử. Kế hoạch chưa hoà vốn thì
  Confidence không vượt 5. Công thức port rút gọn từ dự án observer ("Sổ Cái"); dữ liệu nằm trong ý tưởng nên đồng bộ như mọi thứ khác.
- **Việc tiếp theo:** màn chính gom việc nên làm trên mọi ý tưởng, thử giả định rủi ro cao trước.
- **AI (Workers AI, miễn phí):** chép lời ghi âm và tự sắp xếp ý tưởng chỉ có ghi âm thành tiêu đề, mô tả, vấn đề;
  "AI phản biện" chỉ ra điểm yếu, giả định chưa ghi, câu nên hỏi người dùng. Chỉ gửi khi bạn bấm; cần bật đồng bộ.

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
npm run preview:cf # chạy gần như bản deploy: build rồi phục vụ app + API bằng wrangler (http://localhost:8787)
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

### Tự deploy khi push lên GitHub

`.github/workflows/deploy.yml` chạy test và build cho mọi push và PR; push lên `main` mà qua hết thì deploy luôn
(chạy migration D1 rồi `wrangler deploy`). Cần thêm 2 secret một lần trong **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_ACCOUNT_ID`: lấy bằng `npx wrangler whoami`, hoặc ở cột phải trang Workers & Pages trên dashboard.
- `CLOUDFLARE_API_TOKEN`: tạo ở **My Profile → API Tokens → Create Token**, chọn mẫu **Edit Cloudflare Workers**,
  thêm quyền **Account → D1 → Edit**.

Không cần commit `database_id`: nếu `wrangler.jsonc` còn id mẫu, CI tự tra id của D1 tên `ideos` (`scripts/ci-d1-id.mjs`).

### AI

`wrangler.jsonc` có binding `AI` (Workers AI). Gói free có hạn mức mỗi ngày tính theo "neuron"; app tự giới hạn
`AI_DAILY_LIMIT` lượt mỗi mã đồng bộ (mặc định 30) và không trừ lượt khi AI lỗi. Model đặt ở `AI_TEXT_MODEL`,
`AI_ASR_MODEL`; Cloudflare hay khai tử model cũ, khi đó chỉ cần đổi tên ở đây rồi deploy lại.

Chạy trên máy (`npm run dev:api`, `npm run preview:cf`) dùng `wrangler.local.jsonc`: không có binding AI (Workers AI
không chạy offline và sẽ tốn hạn mức thật), thay bằng `AI_FAKE=1` trả câu trả lời mẫu để thử giao diện.

Nội dung gửi cho AI không được mã hoá đầu cuối như dữ liệu đồng bộ: AI phải đọc được chữ. Nó đi từ app tới Worker
của bạn rồi tới Workers AI, và chỉ khi bạn bấm.

- `MAX_VAULTS` trong `wrangler.jsonc` (mặc định 3) giới hạn số mã đồng bộ máy chủ nhận, để người lạ biết địa chỉ cũng không dùng ké được D1 của bạn.
- Nếu app nằm ở chỗ khác (vd. Vercel), build app với `VITE_SYNC_URL=https://ideos.<tài-khoản>.workers.dev` (xem `.env.example`). API đã mở CORS.
- Giữ mã đồng bộ cẩn thận: ai có mã là đọc được dữ liệu. Mất mã thì không khôi phục được dữ liệu trên máy chủ, nhưng dữ liệu trên từng máy vẫn còn.

Cách hoạt động: mỗi bản ghi trên máy có cờ `dirty`; một vòng đồng bộ đẩy các bản ghi `dirty` và "bia mộ" (bản ghi đã xoá),
rồi kéo các hàng có `seq` lớn hơn con trỏ lần trước. Máy chủ cấp `seq` theo đúng thứ tự commit (dành chỗ và ghi trong cùng
một transaction D1), nên không bao giờ bỏ sót dòng; nó cũng bỏ qua bản ghi cũ hơn bản đang có, nên thứ tự đồng bộ giữa các máy
không ảnh hưởng kết quả. Từ mã đồng bộ, máy suy ra định danh kho, token truy cập và khoá mã hoá; máy chủ chỉ lưu hash của token.
Khi hai máy cùng sửa một ý tưởng lúc chưa đồng bộ, engine kéo về trước rồi mới đẩy lên: trường đơn lẻ theo bản mới hơn,
còn nhật ký, giả định, bằng chứng, việc thì gộp theo id, nên một dòng ghi thêm trên điện thoại không mất vì laptop vừa sửa tiêu đề.
Logic ở `src/sync/engine.ts` và `src/sync/crypto.ts`, có test (`npm test`); máy chủ ở `worker/index.ts`, schema ở `migrations/`.

## Kỹ thuật

Vite + React + TypeScript, Dexie (IndexedDB), vite-plugin-pwa (Workbox). Đồng bộ (tuỳ chọn) qua một Cloudflare Worker + D1, mã hoá bằng WebCrypto.

```
src/
  db.ts              schema Dexie + thao tác ý tưởng
  types.ts           kiểu dữ liệu, danh sách loại/trạng thái/canvas
  lib/               util, ghi âm/đọc chính tả/vị trí, sao lưu, settings, router hash
  sync/              engine đồng bộ, mã hoá, adapter Cloudflare, quản lý mã & lịch đồng bộ, gọi AI
  lib/coach.ts       bộ câu hỏi mài ý tưởng và cách chọn câu tiếp theo
  lib/insight.ts     gợi ý độ tự tin từ bằng chứng, việc tiếp theo, độ chín của ý tưởng
  lib/money/         bài toán tiền: mô hình kinh doanh, mô phỏng, độ nhạy (con số nào làm đổ kế hoạch)
  components/        CaptureSheet, IdeaList, IdeaDetail, Review, Stats, Settings, SyncPanel, Sketch…
worker/index.ts      máy chủ: phục vụ app tĩnh + API /api/v1 trên D1 + AI
worker/ai-text.ts    lời nhắc cho AI, tách và làm sạch JSON model trả về
migrations/          schema D1
wrangler.jsonc       cấu hình Cloudflare (tên Worker, D1, AI, MAX_VAULTS)
wrangler.local.jsonc cấu hình chạy trên máy (AI giả)
```
