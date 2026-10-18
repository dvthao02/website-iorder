# iOrder V2 — Hiện trạng và lộ trình

Cập nhật: 14/10/2026. Kiến trúc và vận hành xem [PROJECT.md](PROJECT.md).

## 1. Hiện trạng đã kiểm chứng

| Hạng mục | Trạng thái |
|---|---|
| Cổng chất lượng | `typecheck`, `lint`, `test` (150 test), `db:check`, `audit --prod` (0 lỗ hổng), build CMS: đều đạt |
| Docker production | Full stack từ volume rỗng đã healthy trong Compose tạm: migrate/seed-admin, upload/đọc/xóa media, quota đăng nhập, làm mới cache. **Chưa deploy VPS thật** |
| Bảo mật | Quota đăng nhập, guard Origin, cookie session an toàn, header Caddy, xác định IP theo Caddy, rate limit lead nguyên tử, ghim digest image, bắt buộc khai báo secret |
| Hiệu năng | Cache public 60 giây + làm mới bằng HMAC, mỗi request chỉ gửi 1 lần. Danh sách bài viết, offering, thiết bị dùng projection gọn |
| Nhất quán dữ liệu | Transaction, optimistic concurrency (409), xóa mềm, revision, audit log, danh sách đọc trong snapshot `repeatable read` |
| CMS UI | Component dùng chung (`AdminPagination`, `AdminDataTable`, `AdminSearchField`, side panel có focus trap, toast, bảo vệ bản nhập chưa lưu); helper API `lib/admin-api.ts`. Style ở `apps/cms/src/styles/` (tokens → base → shell → components → pages), component trong `@layer components` nên utility Tailwind thắng mà không cần `!important`; ô nhập, nhãn, nút chưa gắn class nhận kiểu chuẩn từ layer base. Chuẩn: chữ 14px, điều khiển cao 34px (nhỏ 28px), bo 6/8px, lề trang 20px (điện thoại 12px), padding ô 16px, khoảng cách khối 12px; màn danh sách là một card liền (header, bộ lọc, bảng sát mép, phân trang). Đã đo tự động 22 màn ở 360/390/768/1024/1280/1920px: không tràn ngang, không nội dung bị card che, lề trái đồng nhất, link chữ có vùng chạm ≥32px trên cảm ứng; lưới dùng `minmax(min(Xpx, 100%), 1fr)` và con của card danh sách được co (`minmax(0, 1fr)`). Quy tắc bố cục: tab gạch chân (`AdminFilterTabs`, `.admin-view-tabs`) chỉ để chuyển tập dữ liệu trong một màn và nằm ngay dưới tiêu đề card; lọc trong một tập (trạng thái, nhóm, loại tệp) dùng ô tìm + select trong `AdminFilterBar`; dữ liệu nhiều cột dùng bảng, mục đơn giản dùng danh sách dòng, có ảnh dùng lưới thẻ; sửa bản ghi nhỏ mở panel trượt bên phải, nội dung dài mở trang chỉnh sửa riêng. Dữ liệu liên kết tạo được ngay tại ô chọn (`AdminInlineCreate`, slug tiếng Việt từ `lib/slug.ts`): chuyên mục và thẻ trong editor bài viết, nhóm trong form thiết bị; vai trò người dùng và đích liên kết menu vẫn tạo ở màn riêng vì cần nhiều thông tin. Mọi màn danh sách/cài đặt có thanh vị trí chung ghim trên đầu (khung CMS vẽ, `admin-page-bar`); thanh này là header duy nhất của màn (tên màn, số liệu ngắn qua `AdminPageBarMeta`, liên kết và nút hành động qua `AdminPageBarActions`), nội dung bên dưới không lặp tiêu đề (`AdminListHeader` chỉ còn h1 ẩn cho trình đọc màn hình); màn chỉnh sửa (`/moi`, `/new`, `/<uuid>`, nhóm thiết bị) dùng header riêng. Editor Trang chia tab Nội dung / Thiết lập & SEO / Lịch sử; thành phần trang là danh sách gập/mở (không đổi loại sau khi thêm), trang danh sách cố định phần đầu ở trên cùng và chỉ thêm được khối phục vụ danh sách, kèm mục "Trang con" chỉ tới module sửa chi tiết (`listingChildPages` trong `lib/listing-pages.ts`) |

### Chưa được nghiệm thu

- **Thử trên trình duyệt:** chưa đi trọn luồng tạo → lưu → mở lại → website cho từng module, hai phiên sửa đồng thời, và mobile.
- **Nghiệm thu thật:** TLS/domain thật trên VPS, sao lưu kèm thử restore, lịch chạy các job dọn dẹp.

## 2. So sánh với CMS hiện đại

Tham chiếu các năng lực phổ biến của Strapi 5, Payload 3, Directus 11, Sanity, Contentful và WordPress 6. iOrder là CMS đặt riêng cho một website doanh nghiệp, nên chỉ so những năng lực có giá trị với quy mô này.

| Năng lực | CMS hiện đại | iOrder V2 | Đánh giá |
|---|---|---|---|
| Vòng đời nháp/duyệt/hẹn giờ/xuất bản | Có | Có (5 trạng thái, hẹn giờ lọc ngay lúc truy vấn) | Đạt |
| Lịch sử phiên bản, khôi phục | Có | Có (revision theo domain + khôi phục) | Đạt |
| Audit log | Directus, Payload | Có | Đạt |
| SEO: meta, sitemap, robots, redirect, structured data | Plugin | Có sẵn + checklist sẵn sàng xuất bản | Đạt |
| Block builder cho trang | Có | Có (15 loại block, form theo loại) | Đạt |
| Phân quyền theo vai trò | RBAC chi tiết | Module × view/create/update/delete (+publish), role tạo/sửa trong CMS, ma trận checkbox | Đạt (chưa thử trình duyệt) |
| **Xem trước bản nháp (live preview)** | Có (Payload, Sanity, Strapi) | Không. Chỉ mở được trang đã xuất bản | **Thiếu, ưu tiên cao** |
| **Soạn thảo rich text** | Lexical, Portable Text, Gutenberg | Đoạn văn + checklist, không có in đậm, liên kết, heading, ảnh chèn giữa bài | **Thiếu** |
| **Xử lý ảnh** (resize, WebP/AVIF, focal point) | Có | Lưu ảnh gốc tới 20 MB; public dùng `next/image` | Thiếu: nên tạo biến thể khi upload |
| **Quên mật khẩu, MFA/TOTP** | Có | Không | **Thiếu**, cần cho tài khoản admin |
| **Thông báo lead** (email/Zalo/webhook) | Webhook, form plugin | Lead chỉ xem được trong CMS | **Thiếu**, có giá trị kinh doanh trực tiếp |
| Webhook / tích hợp CRM | Có | Không | Thiếu (gộp chung với thông báo lead) |
| Autosave / khôi phục bản nhập | Có | Lưu tạm bản nhập trong phiên + cảnh báo khi rời trang | Một phần |
| Hộp thoại xác nhận trong app | Có | Còn dùng `window.confirm()` | Thiếu (UX) |
| Thư viện media: thư mục, tag, tìm theo nơi dùng | Có | Có tìm kiếm, lọc MIME, theo dõi nơi dùng; không có thư mục | Đủ dùng |
| Đa ngôn ngữ (i18n) | Có | Không | Chưa cần (site tiếng Việt) |
| Quan sát hệ thống (error tracking, log, metric, uptime) | Tích hợp | Log JSON có mã request xuyên Caddy → CMS → Backend, access log Caddy, `onRequestError`, xoay vòng log; healthcheck | Log đạt. Thiếu cảnh báo tự động |
| Sao lưu tự động + thử restore | Dịch vụ managed | `scripts/backup.sh`: dump DB + khôi phục thử mỗi lần, media theo object, xoay vòng | Đạt (chưa chạy trên VPS, chưa có bản sao ngoài máy) |
| Test E2E trình duyệt | Thường có | Playwright `pnpm test:e2e`: 7 kịch bản (đăng nhập, ma trận quyền, Super Admin, CRUD + hộp xác nhận, tài khoản giới hạn, website, mobile) | Đạt cơ bản; cần mở rộng theo module và chạy trong CI |
| API cho client headless, token | Có | API public read-only nội bộ | Chưa cần |

## 3. Backlog ưu tiên

### P0: trước khi phát hành

1. **Hoàn tất RBAC:** test role × endpoint (401/403), CMS ẩn hoặc khóa thao tác theo permission, không khóa được admin cuối cùng. Phải chốt ma trận quyền với chủ sản phẩm.
2. **Test E2E (Playwright):** đã có 17 test chạy local (RBAC UI, phiên bản/409, trang danh sách, sidebar, tạo nhanh phân loại/nhóm). Còn thiếu: luồng upload media, xuất bản bài viết rồi kiểm tra website, và chạy trong CI trên Compose tạm.
3. ~~Sao lưu tự động~~: đã có `scripts/backup.sh` (xem PROJECT.md mục Production). Đã chạy thử với DB và S3 local: dump + khôi phục thử đạt, xoay vòng đúng, media sao lưu rồi khôi phục sang bucket khác khớp từng byte. Còn: cài cron trên VPS và chép `BACKUP_DIR` ra ngoài máy.
4. **Deploy VPS thật:** TLS, domain, kiểm tra header và luồng media qua domain thật.

### P1: ngay sau phát hành

5. **Thông báo lead** qua email (SMTP), kèm webhook tùy chọn. Gửi sau khi commit, có retry nhẹ, không chặn form.
6. **Xem trước bản nháp:** token ký HMAC có hạn ngắn, publish-web render nội dung nháp không qua cache, `noindex`.
7. **Quên mật khẩu và TOTP cho admin.**
8. ~~Hộp thoại xác nhận dùng chung~~: đã xong (`useAdminConfirm`, không còn `window.confirm`).
9. ~~Log có cấu trúc + mã request~~: đã xong (xem PROJECT.md mục "Log và theo dõi"). Đã kiểm chứng local: tắt DB → log Backend/CMS cùng mã request, có nguyên nhân gốc `ECONNREFUSED`, tham số SQL bị ẩn; Caddy thật ghi access log JSON, che cookie, bỏ `query`. Còn: cảnh báo khi healthcheck lỗi (chờ chọn kênh nhận, gộp với thông báo lead).
10. **Lên lịch job dọn dẹp** (media, session, audit) sau khi chốt thời hạn lưu.

18. ~~Tự đổi mật khẩu~~: đã có màn "Tài khoản của tôi" (`/admin/tai-khoan-cua-toi`), cần mật khẩu hiện tại, tính chung giới hạn thử với đăng nhập, đăng xuất các phiên khác và ghi nhật ký.
19. ~~Xuất CSV khách hàng tiềm năng~~: đã có nút "Xuất CSV" theo bộ lọc đang xem (UTF-8 có BOM, chống CSV injection, tối đa 10.000 dòng, ghi nhật ký). Còn: lọc theo khoảng ngày.

### P2: cải tiến

11. Rich text editor (đề xuất Lexical hoặc Tiptap) với whitelist node/mark và sanitize phía server.
12. Tạo biến thể ảnh khi upload (WebP, vài kích thước), focal point; upload streaming để giảm RAM.
13. ~~Màn "không có quyền"~~: đã có `/admin/khong-co-quyen` và trang 404 của CMS.
14. ~~Đọc lỗi API dùng chung~~: đã xong, mọi màn dùng `adminApiError`/`apiErrorMessage` trong `lib/admin-api.ts`.
15. Image ứng dụng dùng tag/digest bất biến do CI phát hành; đặt resource limit sau khi đo.
16. `EXPLAIN ANALYZE` trên bản sao dữ liệu thật trước khi thêm index.
17. **Từ audit navigation 15/10:** ~~JSON-LD Article/Product/Service/Breadcrumb~~ đã có ở trang chi tiết bài viết, hướng dẫn, sản phẩm/giải pháp/dịch vụ, thiết bị (`lib/structured-data.ts`); ~~nút "Tải bản mới nhất" khi gặp 409~~ đã có (thanh xung đột chung của khung CMS). Còn: `.site-shell h2` trong CSS public nằm ngoài layer; version cho sửa alt media.
20. Thao tác hàng loạt trên bảng (chọn nhiều để lưu trữ/xuất bản); kéo thả để sắp thứ tự khối trang và menu.

## 4. Quyết định đang chờ chủ sản phẩm

| Quyết định | Ảnh hưởng |
|---|---|
| Ma trận quyền chính thức cho 7 role | RBAC (P0.1) |
| Khóa 5 lần sai theo username có thể bị lạm dụng để khóa admin: giữ nguyên hay cho phép mở khóa theo IP tin cậy? | Bảo mật đăng nhập |
| Thời hạn lưu session, audit log, media đã xóa | Job dọn dẹp (P1.10) |
| Kênh nhận lead: email nào, có dùng Zalo/CRM không | P1.5 |
| CDN trước Caddy hay không | Cấu hình `trusted_proxies`, cách lấy IP client |

## 5. Phân công Claude ↔ Codex

Nguyên tắc chia việc:

- **Claude:** viết spec, làm phần nhạy cảm bảo mật hoặc cắt ngang kiến trúc, chạy cổng chất lượng, review diff của Codex.
- **Codex:** triển khai task đã có spec rõ (file, phạm vi, tiêu chí đạt), việc lặp lại trên nhiều file, viết test; review chỉ đọc diff của Claude.
- Mỗi task có **một người sửa, một người review**. Không để hai agent sửa cùng một file cùng lúc.
- Codex chạy bằng `codex exec --worktree -s workspace-write`. Worktree tạo từ commit, nên **phải commit baseline trước**, nếu không Codex sẽ làm việc trên code cũ.

Quy trình mỗi task:

```text
Claude viết spec → Codex làm trong worktree → Claude chạy gate + review diff → merge → cập nhật ROADMAP
(task do Claude làm: Claude làm → gate → Codex review read-only → merge)
```

| # | Task | Làm | Review | Phụ thuộc |
|---|---|---|---|---|
| 0 | Commit baseline theo chủ đề | Claude | — | Bạn đồng ý commit |
| 1a | RBAC: test role × endpoint (401/403), không khóa admin cuối | Claude | Codex | Ma trận quyền đã chốt |
| 1b | RBAC: CMS ẩn/khóa thao tác theo permission | Codex | Claude | 1a |
| 2 | E2E Playwright tối thiểu + chạy trong CI trên Compose tạm | Codex | Claude | Duyệt dependency Playwright |
| 3 | Script sao lưu DB + S3 theo lịch, giữ N bản, thử restore | Claude | Codex | — |
| 4 | Deploy VPS thật, kiểm tra TLS/header/media | Bạn + Claude | — | Quyền truy cập VPS |
| 5 | Thông báo lead qua SMTP (gửi sau commit, retry nhẹ) + webhook tùy chọn | Codex | Claude | Thông tin SMTP/kênh nhận |
| 6 | Xem trước bản nháp (token HMAC hạn ngắn, bỏ qua cache, noindex) | Claude | Codex | — |
| 7 | Quên mật khẩu + TOTP cho admin | Claude | Codex | 5 (mailer) |
| 8 | Hộp thoại xác nhận dùng chung thay `window.confirm()` | Codex | Claude | — |
| 9 | Log JSON có request id + cảnh báo khi healthcheck lỗi | Claude (khung) → Codex (áp dụng toàn route) | Chéo | — |
| 10 | Lên lịch job dọn media/session/audit | Codex | Claude | Chốt thời hạn lưu |
| 11 | Rich text editor + sanitize phía server | Codex | Claude | Duyệt dependency editor |
| 12 | Biến thể ảnh khi upload, upload streaming | Claude | Codex | — |
| 13 | Chuyển khoảng 30 chỗ sang `apiErrorMessage`, gom phân trang Media/Supporting | Codex | Claude | — |

Thứ tự đề xuất: 0 → (1a ∥ 8 ∥ 13) → 1b → 2 → 3 → 6 → 5 → 7 → 9 → 4 → các mục còn lại. Ký hiệu ∥: các task chạy song song vì đụng file khác nhau.

### Tiến độ

- **15/10 — 1a xong (Claude):** ánh xạ endpoint → permission tách ra `apps/backend/src/lib/admin-permission.ts`, so khớp theo segment để route con và dấu `/` cuối không làm lỏng quyền; test toàn bộ route + ma trận role. **Phát hiện:** `content.publish` chưa được kiểm tra ở đâu, nên editor vẫn xuất bản được và publisher không ghi được gì. Cần chốt quy tắc (mục 4) rồi mới làm 1b.
- **15/10 — 8 xong (Codex làm, Claude review):** `AdminConfirmProvider`/`useAdminConfirm` thay `window.confirm()` ở 6 file; focus trap dùng chung `admin-focus-trap.ts`. Claude sửa hai lỗi khi review: trap lồng nhau (dialog mở từ side panel thì Escape/Tab bị panel bắt mất) và thiếu import React khiến test lỗi. `use-navigation-guard.ts` vẫn dùng confirm gốc vì cần trả lời đồng bộ. Chưa thử trên trình duyệt.
- Lưu ý khi giao việc cho Codex: sandbox của Codex không chạy được `node --test` (`spawn EPERM`), nên Claude phải tự chạy test sau khi nhận diff.

- **15/10 — RBAC hoàn chỉnh (Claude làm, Codex review):** quyền theo module × `view/create/update/delete` + `publish`; role là dữ liệu (tạo/sửa/xóa ở trang Vai trò, ma trận checkbox có chọn cả module/chọn tất cả và trạng thái indeterminate); Super Admin bảo vệ ở DB (`is_system`, migration `0010`); proxy + route handler kiểm tra, nội dung đang công khai cần `publish`; chống leo thang quyền; `GET /api/admin/session` cho shell CMS. Kiểm chứng: 166 test, build CMS/backend, fixture `audit:roles-db` và `audit:users-db` trên schema tạm. Chưa thử trên trình duyệt. **Khi deploy:** chạy migrate rồi `seed-admin` (Compose tự chạy) để đồng bộ danh mục quyền; role cũ dùng mã `content.*` tự nhận bộ quyền mặc định mới.
- **15/10 — Codex review RBAC:** tìm 2 lỗi thật, Claude đã sửa và fixture kiểm chứng: (1) `supporting` thiếu `publish` nên editor sửa được đối tác/đánh giá đang hiển thị; nay có `supporting.publish` và điều kiện `is_enabled=false` nằm ngay trong câu UPDATE để chặn race; (2) seed chạy mỗi deploy từng cấp lại quyền cho role mặc định bị làm trống có chủ đích; nay chỉ cấp cho role mới tạo hoặc role chỉ còn mã cũ, role tùy chỉnh mang mã cũ được chuyển đổi tương đương.
- **15/10 — 1b + E2E (Claude):** `AdminButton` nhận `permission`/`hideWithoutPermission`; nút tạo ẩn, nút lưu khóa theo quyền ở mọi manager/editor; upload media, trạng thái lead, menu, tài nguyên hỗ trợ cũng được gắn quyền. Playwright 7 kịch bản chạy trên trình duyệt thật, dọn dữ liệu thử. E2E phát hiện và đã sửa: (1) role không có `dashboard.view` làm sập trang chủ CMS — nay dashboard mở cho mọi quyền xem và CMS coi 403 là không có dữ liệu; (2) redirect cũ `/admin/phan-quyen` → `/admin/tai-khoan` khiến trang Vai trò không vào được. Dữ liệu V1: đã nhập 8 trang, 6 bài viết, 3 đánh giá, menu, redirect, cấu hình; sản phẩm/dịch vụ và media chờ `iwork.vn` hoạt động lại (đang trả 530).
- **15/10 — Codex review đợt 1b:** sửa theo góp ý: nút lưu trữ/khôi phục cần cả `update` lẫn `publish` (khớp API); nút xóa ở media/chuyển hướng/đối tác/phân loại/nhóm thiết bị ẩn khi thiếu `delete`; E2E tự dọn chuyển hướng kể cả khi lỗi, test tạo tài khoản chỉ chạy với CMS + DB local, test tin tức không giả định DB có bài.
- **15/10 — Audit navigation + vá đợt 1 (Claude):** (1) form lead báo "không kết nối" dù đã lưu (`currentTarget` bị xóa sau `await`) — đã sửa, thêm `autocomplete`; (2) RBAC: ẩn/hiện hoặc sửa nhóm thiết bị đang hiển thị cần `equipment.publish` (điều kiện `is_enabled=false` nằm trong UPDATE như đối tác); tìm kiếm toàn cục, dashboard, kiểm tra xuất bản chỉ truy vấn module có quyền xem (trước đó lộ tiêu đề bản nháp mọi module, số lead); tìm kiếm mở cho mọi quyền xem như dashboard; popover tài khoản và thao tác nhanh dashboard gắn quyền; (3) "Hỗ trợ cài đặt" có tab Hướng dẫn (trước đó guide không có màn danh sách, `?tab=guides` bị bỏ qua); (4) hai editor mồ côi "Tiêu đề trang catalog/danh sách" vào sidebar + tìm kiếm, có bảo vệ bản nhập; `/admin/cau-hinh` (chỉ chữ tĩnh) chuyển sang `/admin/seo`; (5) website public: proxy bỏ qua lỗi tra redirect, có trang 404/lỗi/global-error tiếng Việt, `/api/public/content` trả JSON 500 có log, setting JSONB lệch schema dùng mặc định + log thay vì làm sập mọi trang. Kiểm chứng: typecheck, lint, 172 test, db:check, build 3 app. **Chưa thử trên trình duyệt**, chưa chạy fixture DB.
- **15/10 — Trang danh sách thành Trang (giai đoạn 1, Claude):** khảo sát WordPress (trang Posts là Page), Shopify (tiêu đề blog sửa trong blog), Webflow (trang danh sách là trang thường), Sanity (singleton "Blog page" cạnh danh sách bài) → bỏ hai mục "Tiêu đề trang…" khỏi Cài đặt. 7 trang danh sách thêm vào `fixedWebsitePages` (`kind: listing`, `ownerModule`); route `/tin-tuc`, `/thiet-bi`, `/ho-tro/cai-dat`, `/phan-mem|giai-phap|dich-vu` đọc phần đầu + SEO từ Trang, dự phòng key cũ; quyền theo module (proxy thô, route handler chính xác theo trang); màn module có lối tắt "Trang danh sách"; `/trang/{slug hệ thống}` chuyển 308 về route thật; sitemap/link xem trước dùng registry. Script `pnpm db:backfill-listing-pages` (đã thêm vào `db:seed:cms`) **chưa chạy trên DB local**. Kiểm chứng: typecheck, lint, test, db:check, build. Chưa thử trình duyệt.
- **15/10 — Giai đoạn 2 (Claude):** khối `collection_list` (nguồn, tiêu đề tùy chọn, số lượng, mã neo) render chung qua `CollectionList` ở publish-web; trang danh sách là trang ghép khối (`listingLayoutFromBlocks`, khung `ListingPageView`, thanh chuyển nhanh khi có ≥2 danh sách có neo); `/ho-tro/cai-dat` = 1 trang với 2 khối danh sách (bỏ trang phụ hướng dẫn); `featured_posts`/`download_list` render qua khối mới, CMS chỉ còn cho sửa; khối lạ không còn bị hiểu là danh sách tải về. Nguồn "Bài viết" không lẫn hướng dẫn; `/tin-tuc/{guide}` chuyển 308 về `/ho-tro/cai-dat/{slug}`; danh sách chuyên mục/thẻ link và nhãn loại đúng. Backfill tạo trang kèm khối danh sách tường minh. Kiểm chứng: typecheck, lint, 178 test, db:check, build 3 app; đã chạy `db:backfill-listing-pages` trên DB local (tạo 6 trang, chạy lại không tạo trùng); HTTP 200 cho 6 trang danh sách, `/trang/listing-news` 308, `/nganh-nghe` 404; Playwright 10/10 (thêm `e2e/listing-pages.spec.ts`: lối tắt module → editor, sửa tiêu đề → website nhận → khôi phục, tab Hướng dẫn + neo). E2E bắt được lỗi build không thấy: Server Component dùng `AdminButton` có `permission` (hook client) — đã sửa, kiểm quyền phía server.
  - **Lưu ý vận hành dev:** dev server Turbopack không tự biên dịch lại khi đổi `packages/core`; sau khi sửa core phải khởi động lại `dev:backend`/`dev:cms`. `.site-shell h2` trong `publish-web/globals.css` nằm ngoài layer nên thắng utility Tailwind (khối danh sách dùng `!`); nên đưa vào `@layer base` khi rà CSS public.
  - **Đã xác minh (15/10):** code làm mới cache đúng (`revalidateTag(tag, { expire: 0 })` = chặn bản cũ theo docs Next 16.3). Website local chậm cập nhật vì `.env` local thiếu `PUBLISH_WEB_REVALIDATE_URL/SECRET` (Compose production có đủ); đã thêm vào `.env.example` và Backend cảnh báo một lần khi thiếu.
  - Còn lại giai đoạn 2: bộ lọc theo chuyên mục/thẻ và kiểu hiển thị cho `collection_list` khi có nhu cầu. Giai đoạn 3: bỏ key `listing_content`/`catalog_content` và API `catalog-content`/`listing-content` sau khi backfill trên mọi môi trường; template cho trang chi tiết.
- **15/10 — Vận hành CMS (Claude):** chuông thông báo dùng `GET /api/admin/notifications` (lead mới, nội dung chờ duyệt theo quyền `publish`; ≤5 truy vấn đếm, đo 20–50 ms) thay vì tải cả dashboard ở mọi lần điều hướng (100–650 ms); dashboard chỉ tải ở trang Tổng quan. Mở thẳng URL module thiếu quyền → màn "Không có quyền" (`requireAdminPermission` ở 35 trang; không dùng `forbidden()` vì còn thử nghiệm); id không tồn tại → 404 của CMS thay cho "Backend không sẵn sàng". Editor bài viết/catalog/trang/thiết bị khóa "Hẹn giờ"/"Xuất bản" khi thiếu `publish` kèm gợi ý. Chuyển hướng và alt media làm mới cache public; `/api/public/media/[id]` kiểm UUID, lỗi trả JSON. Kiểm chứng: typecheck, lint, 181 test, db:check, build 3 app, Playwright 11/11 (thêm: màn không có quyền, 404 CMS, người có `posts.update` sửa được trang `/tin-tuc`).
- **15/10 — Chốt quyết định (Claude):** **bỏ Ngành nghề**: migration `0011` bỏ giá trị `industry` khỏi enum `offering_type` (môi trường còn dữ liệu industry thì migration dừng và hoàn tác), contract/route/CMS không còn loại này, import V1 bỏ qua mục industry, key `industry` cũ trong cấu hình catalog được bỏ qua khi đọc. **Version cho cấu hình/danh mục**: migration `0012` thêm cột `version` cho 8 bảng; API xuất bản/liên kết ngoài/hồ sơ nhận `{ values, expectedVersion }`, chuyển hướng/chuyên mục/thẻ/đối tác/đánh giá/nhóm thiết bị bắt buộc `expectedVersion` khi sửa (đối tác và nhóm thiết bị: điều kiện version nằm cùng câu UPDATE với `onlyIfHidden`); xóa trang và xóa tệp tải về bắt buộc version. Đã chạy migrate trên DB local. Kiểm chứng: typecheck, lint, 182 test, db:check, 6 fixture DB (equipment, taxonomy, redirects, roles, supporting, pages) trên schema tạm, build 3 app, Playwright 13/13 (thêm 409 khi lưu bằng phiên bản cũ, lưu hai lần liên tiếp trên giao diện).
- **15/10 — SEO public + dọn CSS (Claude):** sitemap chỉ gồm trang đã xuất bản (trang hệ thống theo `publicPath`, bỏ anchor), có `lastModified` cho thiết bị/offering; API public `page` chỉ trả nội dung + SEO + khối đang bật (không còn `status`/`draftVersion`/`scheduledAt`), `redirect` chỉ trả đích và mã; canonical mặc định về chính trang (khi đã cấu hình URL website) và Open Graph theo trang (ảnh bìa bài viết/offering/thiết bị, kế thừa ảnh OG mặc định qua `parent`) bằng `lib/page-metadata.ts`; seed trang chủ đọc bản admin để không mất khối đã tắt. CSS public bỏ toàn bộ khung CMS (630 → 93 dòng, giữ thanh cuộn mảnh). Kiểm chứng: typecheck, lint, 182 test, db:check, build 3 app, Playwright 13/13, kiểm HTTP payload/OG, chụp màn hình website.
- **16/10 — Thống kê truy cập bằng Umami 3.4.0 tự host (Claude):** service `umami` (ghim digest) + job `umami-db-init` (tạo database `umami` nếu chưa có, chạy lại an toàn) trong Compose production; local nằm sau profile `analytics`. Caddy chỉ mở `/stats/script.js` và `/stats/api/send` trên domain website, giao diện Umami ở `ANALYTICS_SITE_ADDRESS`. Backend `analytics.service` gọi `stats`/`pageviews`/`metrics` bằng API key, 7 ngày theo giờ Việt Nam, điền đủ ngày trống, so với 7 ngày trước, Zod ở ranh giới, timeout 4 giây. CMS: trang Thống kê và dashboard có ô chỉ số, biểu đồ cột theo ngày (tooltip chuột/bàn phím, bảng dữ liệu), trang xem nhiều nhất. Kiểm chứng: 3 test service, typecheck, lint, 185 test, Playwright 13/13; chạy Umami local thật: tạo website + API key, trình duyệt gửi 5 lượt xem qua `/stats/api/send` (HTTP 200), CMS hiện đúng 1 người/5 lượt xem. Cũng xác nhận làm mới cache tức thì chạy end-to-end khi có `PUBLISH_WEB_REVALIDATE_*` (lần gọi đầu ở dev có thể chậm ~1,5 giây do biên dịch route). Caddyfile đạt `caddy validate` (image đã ghim). **Chưa:** chạy trên VPS thật, đặt resource limit cho `umami` sau khi đo RAM.
- **16/10 — Bố cục lại menu CMS (Claude, phương án A đã duyệt):** tham chiếu WordPress (Chuyên mục/Thẻ nằm trong Bài viết; màu giao diện nằm ở hồ sơ cá nhân), Strapi (Users/Roles/Audit logs trong Settings → Administration), Shopify (Users and permissions trong Settings). Nhóm mới: Tổng quan · Nội dung (Trang, Bài viết, Chuyên mục & Thẻ, Hỗ trợ cài đặt, Thư viện media) · Sản phẩm & Dịch vụ · Khách hàng & Đối tác · Cấu trúc website (Menu, Chuyển hướng, Kiểm tra xuất bản có mục riêng) · Quản trị hệ thống (Người dùng, Vai trò & quyền, Nhật ký) · Cài đặt website ở dưới cùng (Thông tin doanh nghiệp, Tên miền & SEO, Liên kết & Mạng xã hội). "Giao diện CMS" chuyển vào menu tài khoản ("Tài khoản của tôi"); bỏ icon trùng; tiêu đề trang, tìm kiếm toàn cục và mục kiểm tra xuất bản dùng cùng nhãn. URL không đổi. Kiểm chứng: typecheck, lint, 185 test, Playwright 13/13, chụp sidebar.
- **16/10 — Codex review đợt 15–16/10:** lô Backend/core và lô Trang/website đã review; lô CMS và Umami **chưa review** vì Codex hết hạn mức (dùng lại từ 15/11/2026). Đã sửa theo review: lưu cấu hình lần đầu (chưa có dòng) chặn ghi đè đồng thời bằng điều kiện version ở nhánh `ON CONFLICT`; `GET` cấu hình đọc giá trị và version từ cùng một dòng; xóa chuyển hướng bắt buộc `expectedVersion` (409); gỡ API admin `catalog-content`/`listing-content` (CMS không dùng, ghi không có version); readiness đếm tệp cài đặt theo `support_downloads.view`, chỉ đọc cấu hình xuất bản khi có `settings.view`; trang danh sách đã tạo nhưng bị ẩn thì 404 thay vì dùng cấu hình cũ; trang thường không được đổi slug thành slug trang hệ thống; backfill báo xung đột slug thay vì bỏ qua. Giữ nguyên chủ ý: migration `0011` dừng nếu còn dữ liệu `industry`. Kiểm chứng: typecheck, lint, 185 test, 6 fixture DB, Playwright 13/13.
- **16/10 — Tự review lô CMS + Umami (Claude, thay Codex hết hạn mức):** sửa 4 lỗi: (1) Chuyên mục/Thẻ, Đối tác/Đánh giá, Nhóm thiết bị lấy version từ props (chỉ mới sau `router.refresh()`) nên lưu liên tiếp bị 409 oan, vừa tạo xong lưu tiếp bị 400 — nay nhớ version vừa lưu cục bộ; (2) API thông báo lỗi làm hỏng layout mọi trang CMS — nay chuông rỗng thay vì lỗi; (3) lối tắt trang danh sách báo nhầm "chưa tạo" với người thiếu quyền xem — nay ẩn; (4) `proxy` phụ thuộc `umami` healthy nên Umami lỗi chặn cả website — đã bỏ phụ thuộc. Thêm E2E tạo thẻ rồi lưu liên tiếp. Kiểm chứng: typecheck, lint, 185 test, build 3 app, Playwright 14/14.
