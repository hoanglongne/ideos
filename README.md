# 💡 Ideos

Sổ ghi ý tưởng web / app / startup / sản phẩm — dành cho lúc chợt nghĩ ra gì đó khi đang đi ngoài đường.
PWA offline-first: cài lên màn hình chính, mở tức thì, ghi được cả khi không có mạng. Dữ liệu nằm hoàn toàn trên máy (IndexedDB).

## Triết lý: một ý tưởng, một câu hỏi, một quyết định

Ý tưởng chết vì bị bỏ quên và vì không ai ép nó đi đến kết luận. Ideos chỉ làm hai việc: **ghi cho nhanh** và **luôn nói bạn nên làm gì tiếp**.
Mỗi ý tưởng đi qua cùng một hành trình, Ghi → Mài → Thử → Quyết → Làm → Ra mắt, và ở mỗi lúc chỉ có **một việc "Bây giờ"**, tính từ chính
trạng thái của ý tưởng (`src/lib/journey.ts`):

| Ý tưởng đang ở | Việc "Bây giờ" |
|---|---|
| Lâu không động tới (14 ngày) | Còn muốn làm không? Còn / Để sau / Bỏ |
| Mới ghi, chưa rõ vấn đề và người dùng | Mài ý tưởng (vài câu hỏi) |
| Rõ rồi, chưa có giả định | Tìm điều phải đúng |
| Có giả định | Chuyển sang Kiểm chứng |
| Kiểm chứng | Thử giả định rủi ro cao nhất, ghi kết quả ngay trên thẻ |
| Đã thử hết | Tính bài toán tiền, rồi quyết định: đi tiếp / để sau / bỏ |
| Đang làm | Việc chưa xong đầu tiên, hết việc thì ra mắt |
| Đã ra mắt | Theo dõi số thật (xuất sang Sổ Cái) |

## Giao diện: bốn màn, một cột

- **Trang chủ:** ô ghi nhanh nằm ngay trên cùng (gõ hoặc nói, bấm Lưu; ghi được cả khi offline), bên dưới là **Cần bạn** (tối đa ba việc,
  giả định rủi ro cao trước), các ý tưởng đang chạy, và **Đã cất** (thu gọn). Ô tìm chỉ hiện khi có từ 7 ý tưởng.
- **Ý tưởng:** tên, thẻ **Bây giờ** (một việc, một nút chính, làm được ngay tại thẻ), mô tả, **Điều phải đúng** (mỗi giả định kèm kết quả thử
  và bằng chứng ngay bên trong), rồi **Tiền / Ghi chú / Việc cần làm** xếp thành dòng thu gọn. Giai đoạn, loại, ghim, chia sẻ, nhân bản,
  xoá nằm sau nút ⋯.
- **Mài ý tưởng:** mỗi lần một câu hỏi, câu trả lời tự vào đúng chỗ (hiện ở mục **Đã mài**).
- **Cài đặt:** đồng bộ, sao lưu, AI, giao diện sáng/tối.

Đã bỏ khỏi giao diện (dữ liệu, đồng bộ và file sao lưu vẫn giữ nguyên): thống kê, màn Ôn lại, Trộn ý tưởng, chấm điểm ICE, sửa Lean canvas,
nhãn/liên kết/ý tưởng liên quan, hàng nút giai đoạn, thanh bên và thanh tab.

## Tính năng

**Ghi nhanh**
- Dòng đầu là tiêu đề, phần sau là ghi chú; `#nhãn` gắn nhãn, `@web` `@app` `@startup` chọn loại
- 🎙️ Ghi âm (chạy offline), 🗣️ nói→chữ (Web Speech API, thường cần mạng), 📷 ảnh (tự nén), ✏️ bảng phác thảo
- Bản nháp tự lưu nếu lỡ đóng; 📍 tuỳ chọn gắn vị trí nơi nảy ra ý tưởng
- Share target trên Android: chia sẻ link/text từ app khác vào Ideos

**Nuôi ý tưởng lớn dần**
- **Điều phải đúng:** ghi giả định kèm mức rủi ro và cách thử, ghi lời người dùng thật (ủng hộ / phản bác) ngay dưới giả định đó.
- **Bài toán tiền:** chọn mô hình gần nhất trong 8 mô hình (SaaS, app thuê bao, bán hàng online, sàn, quán ăn, dịch vụ, khoá học, nội dung),
  app điền sẵn số trung bình rồi tính cần bao nhiêu khách, bao nhiêu vốn, bao lâu hoà vốn. Ô nào chưa phải số của bạn có viền nét đứt và
  ghi "ước lượng", và kết luận không bao giờ xanh khi còn số mặc định. App làm xấu từng con số đi 30% để chỉ ra con số nào làm đổ kế hoạch
  nhanh nhất, rồi thêm thẳng vào danh sách giả định. Khi ý tưởng sang "Đang làm", nút **Tải file cho Sổ Cái** xuất kế hoạch để mỗi tháng
  so với số thật (⚙ → Sao lưu & nhập file → Nhập → Gộp bên Sổ Cái).
- **AI (Workers AI, miễn phí):** chép lời ghi âm và tự sắp xếp ý tưởng chỉ có ghi âm; "AI phản biện" chỉ ra điểm yếu và giả định chưa ghi;
  khi mài ý tưởng, câu trả lời chung chung thì AI hỏi tiếp. Chỉ gửi khi bạn bấm; cần bật đồng bộ; tắt được trong Cài đặt.

**☁️ Đồng bộ giữa các máy (tuỳ chọn)**
- Máy chủ riêng của bạn trên Cloudflare (Worker + D1, gói free, không cần thẻ), chạy cùng địa chỉ với app
- Không tài khoản, không email: máy đầu tạo **mã đồng bộ**, máy khác nhập mã, chép link hoặc quét QR
- Mã hoá đầu cuối: nội dung, ảnh, ghi âm được mã hoá AES-GCM trên máy trước khi gửi; máy chủ chỉ thấy bản mã
- Offline-first: mất mạng vẫn ghi/sửa bình thường; có mạng lại thì tự đẩy/kéo; máy đang mở nhận thay đổi trong khoảng 20 giây
- Xung đột: gộp ba chiều theo từng trường (đổi tên ở máy này và ghi chú ở máy kia không đè mất nhau); xoá cũng được đồng bộ
- Dữ liệu có sẵn trên máy được gộp vào kho khi ghép lần đầu

**Khác**
- Tìm kiếm không cần dấu ("y tuong" khớp "ý tưởng")
- Sao lưu/khôi phục JSON (gồm cả ảnh & ghi âm, gộp theo bản mới hơn), xuất Markdown, nhắc sao lưu khi dữ liệu chỉ nằm trên một máy
- Xin quyền lưu trữ bền vững để trình duyệt không tự xoá dữ liệu
- Sáng/tối, phím tắt `N` (ghi mới) / `/` (tìm) / `Ctrl+Enter` (lưu), báo khi có bản cập nhật
- `?demo=1` mở bản xem thử với dữ liệu mẫu trong một kho riêng, không đụng dữ liệu thật và không đồng bộ

## Hệ thiết kế "Mực & Son"

Giấy ấm, mực đen và **một màu son duy nhất** dành cho thứ cần bạn: nút chính và chấm "Cần bạn". Tất cả nằm trong biến CSS ở đầu
`src/styles.css` (sáng và tối dùng chung một bộ).

- Chữ: **Inter** (tự host, có tiếng Việt, số tabular); tiêu đề đậm 800, tracking âm; thân 16 px.
- Một cột 620 px, không thanh bên, không thanh tab; thanh trên cùng chỉ có tên app, trạng thái đồng bộ và cài đặt.
- Bo góc 8 / 14 px; điều khiển cao 48 px; đường kẻ mảnh thay cho khung và bóng đổ; thẻ **Bây giờ** đảo màu là điểm nhấn duy nhất của trang.
- Đạt WCAG AA (quét axe-core trong e2e, sáng và tối), vùng chạm từ 44 px trên điện thoại.

## Chạy

```bash
npm install
npm run dev        # giao diện, tự nạp lại khi sửa code
npm run dev:api    # (cửa sổ thứ hai) máy chủ đồng bộ + D1 chạy local ở cổng 8787; `npm run dev` tự chuyển /api sang đây
npm run preview:cf # chạy gần như bản deploy: build rồi phục vụ app + API bằng wrangler (http://localhost:8787)
npm test           # test đơn vị: logic đồng bộ, gộp, mã hoá, công thức tiền, AI
npm run e2e        # trình duyệt thật (Playwright) trên bản build + Worker cục bộ, AI giả; cần `npx playwright install chromium` lần đầu
```

`npm run e2e` tự build, dựng D1 trống và chạy `wrangler dev` ở cổng 8787, rồi chạy các luồng trong `e2e/`: ghi và dùng offline,
đồng bộ hai máy (kể cả sửa lệch nhau, xoá), bài toán tiền (gõ số kiểu Việt, kết luận), điện thoại (mục thu gọn, vùng chạm 44 px),
nhắc sao lưu, AI hỏi tiếp, phản biện và công tắc tắt AI, và quét trợ năng bằng axe-core (0 lỗi mức nghiêm trọng trên các màn chính,
sáng và tối). CI chạy cả hai lệnh trên mỗi PR; deploy chỉ chạy khi cả hai qua.

Sinh lại icon PNG từ `public/icon.svg`: `node scripts/icons.mjs` (cần Playwright).

## Đưa lên Cloudflare

Một Worker phục vụ cả app lẫn API đồng bộ, dữ liệu nằm trong D1. Gói Workers Free đủ dư cho một người
(D1 free: 5 GB, 100.000 lượt ghi mỗi ngày) và không cần thẻ thanh toán.

Một ngày dùng RẤT nhiều (300 lần sửa, 40 ảnh/ghi âm, 30 lượt AI, 20 lần xoá, máy kia kéo về từng thay đổi, hỏi nhẹ máy chủ
20 giây một lần suốt 24 giờ) tốn khoảng **2.000 dòng ghi (2% hạn mức)** và **19.000 dòng đọc (0,4%)**. Con số này đo bằng cách
chạy đúng mã của Worker trên SQLite thật (`worker/d1-load.test.ts`, chạy trong `npm test`) và đếm dòng theo cách Cloudflare tính
(mỗi dòng ghi cộng thêm một dòng cho mỗi index); là ước tính, chưa đối chiếu với bảng thống kê trên Cloudflare. Test fail nếu một
thay đổi làm tải vượt 10% hạn mức ghi hoặc 5% hạn mức đọc.

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

Nội dung gửi cho AI không được mã hoá đầu cuối như dữ liệu đồng bộ: AI phải đọc được chữ. Muốn tắt hẳn: Cài đặt → Tuỳ chọn → "Dùng AI";
khi tắt, app không gọi AI nào và không gửi chữ nào đi (kể cả hỏi trạng thái). Nó đi từ app tới Worker
của bạn rồi tới Workers AI, và chỉ khi bạn bấm.

- **Chống dùng ké.** Địa chỉ `workers.dev` là công khai, và tạo mã đồng bộ mới không cần đăng nhập. Ba lớp bảo vệ:
  - `MAX_VAULTS` trong `wrangler.jsonc` (mặc định 3) giới hạn số mã máy chủ nhận. Tạo xong mã của bạn, đặt về `1` là người lạ không chiếm được chỗ nào.
  - `ADMIN_KEY` (tuỳ chọn): đặt một khoá bí mật bằng `npx wrangler secret put ADMIN_KEY`. Từ đó muốn tạo mã mới phải nhập khoá này
    (app tự hỏi khi bấm "Bật đồng bộ"). Ghép thêm máy bằng mã có sẵn thì không cần khoá. Secret giữ nguyên qua các lần deploy.
  - `MAX_VAULT_MB` (mặc định 300): trần dung lượng mỗi kho (ý tưởng, ảnh, ghi âm). Vượt thì ghi thêm bị từ chối kèm thông báo; xoá bớt vẫn được.
    Máy chủ tự đếm dung lượng mỗi lần ghi, không phải quét lại cả kho.
- Nếu app nằm ở chỗ khác (vd. Vercel), build app với `VITE_SYNC_URL=https://ideos.<tài-khoản>.workers.dev` (xem `.env.example`). API đã mở CORS.
- Giữ mã đồng bộ cẩn thận: ai có mã là đọc được dữ liệu. Mất mã thì không khôi phục được dữ liệu trên máy chủ, nhưng dữ liệu trên từng máy vẫn còn.

Cách hoạt động: mỗi bản ghi trên máy có cờ `dirty`; một vòng đồng bộ đẩy các bản ghi `dirty` và "bia mộ" (bản ghi đã xoá),
rồi kéo các hàng có `seq` lớn hơn con trỏ lần trước. Máy chủ cấp `seq` theo đúng thứ tự commit (dành chỗ và ghi trong cùng
một transaction D1), nên không bao giờ bỏ sót dòng; nó cũng bỏ qua bản ghi cũ hơn bản đang có, nên thứ tự đồng bộ giữa các máy
không ảnh hưởng kết quả. Từ mã đồng bộ, máy suy ra định danh kho, token truy cập và khoá mã hoá; máy chủ chỉ lưu hash của token.
Khi hai máy cùng sửa một ý tưởng lúc chưa đồng bộ, engine kéo về trước rồi mới đẩy lên và **gộp ba chiều theo từng trường**:
máy giữ bản ý tưởng đã đồng bộ lần trước (bảng `bases`) làm gốc. Trường nào chỉ một bên đổi so với gốc thì lấy bên đó, cả hai
cùng đổi một trường thì bản mới hơn thắng. Nhật ký, giả định, bằng chứng, việc gộp từng mục theo id (xoá một mục mà bên kia chưa
động tới thì mất, đã sửa thì giữ); tag và liên kết gộp theo tập. Nên đổi tên trên laptop và ghi nhật ký trên điện thoại không đè mất
nhau, dù bản của máy nào "mới hơn" cả ý tưởng. Chưa có bản gốc (dữ liệu cũ, máy mới ghép) thì dùng cách gộp cũ: danh sách theo id,
trường đơn lẻ theo bản mới hơn.
Logic ở `src/sync/merge.ts`, `src/sync/engine.ts` và `src/sync/crypto.ts`, có test (`npm test`); máy chủ ở `worker/index.ts`, schema ở `migrations/`.

## Kỹ thuật

Vite + React + TypeScript, Dexie (IndexedDB), vite-plugin-pwa (Workbox). Đồng bộ (tuỳ chọn) qua một Cloudflare Worker + D1, mã hoá bằng WebCrypto.

```
src/
  db.ts              schema Dexie + thao tác ý tưởng
  types.ts           kiểu dữ liệu, danh sách loại/trạng thái/canvas
  lib/               util, ghi âm/đọc chính tả/vị trí, sao lưu, settings, router hash
  sync/              engine đồng bộ, mã hoá, adapter Cloudflare, quản lý mã & lịch đồng bộ, gọi AI
  lib/coach.ts       bộ câu hỏi mài ý tưởng và cách chọn câu tiếp theo
  lib/journey.ts     việc "Bây giờ" của từng ý tưởng và kế hoạch "Cần bạn" trên trang chủ
  lib/money/         bài toán tiền: mô hình kinh doanh, mô phỏng, độ nhạy, xuất sang Sổ Cái
  components/        Home, Composer, IdeaPage, Now, Questions, Coach, Settings, SyncPanel, Sketch…
worker/index.ts      máy chủ: phục vụ app tĩnh + API /api/v1 trên D1 + AI
worker/ai-text.ts    lời nhắc cho AI, tách và làm sạch JSON model trả về
migrations/          schema D1
wrangler.jsonc       cấu hình Cloudflare (tên Worker, D1, AI, MAX_VAULTS)
wrangler.local.jsonc cấu hình chạy trên máy (AI giả)
```
