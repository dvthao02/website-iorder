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
| CMS UI | Component dùng chung (`AdminPagination`, `AdminDataTable`, side panel có focus trap, toast, bảo vệ bản nhập chưa lưu); helper API `lib/admin-api.ts` |

### Chưa được nghiệm thu

- **Thử trên trình duyệt:** chưa đi trọn luồng tạo → lưu → mở lại → website cho từng module, hai phiên sửa đồng thời, và mobile.
- **Phân quyền RBAC:** đang triển khai trong worktree (`permissions.ts`, kiểm tra quyền trong `proxy.ts`). Còn thiếu test 401/403 theo từng role × endpoint, cùng UI ẩn hoặc khóa thao tác theo quyền.
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
| Phân quyền theo vai trò | RBAC chi tiết | 7 role × 14 permission | **Đang làm**, cần test và UI |
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
| Quan sát hệ thống (error tracking, log, metric, uptime) | Tích hợp | Chỉ có `console` log, healthcheck | **Thiếu** cho production |
| Sao lưu tự động + thử restore | Dịch vụ managed | Lệnh thủ công | **Thiếu** |
| Test E2E trình duyệt | Thường có | Không có (chỉ unit/contract + fixture HTTP) | **Thiếu**; đây là lý do các luồng UI chưa nghiệm thu |
| API cho client headless, token | Có | API public read-only nội bộ | Chưa cần |

## 3. Backlog ưu tiên

### P0: trước khi phát hành

1. **Hoàn tất RBAC:** test role × endpoint (401/403), CMS ẩn hoặc khóa thao tác theo permission, không khóa được admin cuối cùng. Phải chốt ma trận quyền với chủ sản phẩm.
2. **Test E2E tối thiểu (Playwright):** đăng nhập; tạo, sửa, xuất bản, lưu trữ bài viết; upload media; kiểm tra website nhận thay đổi. Chạy trên Compose tạm trong CI. Cần duyệt vì thêm dependency.
3. **Sao lưu tự động:** `pg_dump` và `seaweed-data` theo lịch, giữ N bản, thử restore định kỳ.
4. **Deploy VPS thật:** TLS, domain, kiểm tra header và luồng media qua domain thật.

### P1: ngay sau phát hành

5. **Thông báo lead** qua email (SMTP), kèm webhook tùy chọn. Gửi sau khi commit, có retry nhẹ, không chặn form.
6. **Xem trước bản nháp:** token ký HMAC có hạn ngắn, publish-web render nội dung nháp không qua cache, `noindex`.
7. **Quên mật khẩu và TOTP cho admin.**
8. **Hộp thoại xác nhận dùng chung** thay `window.confirm()`.
9. **Quan sát hệ thống:** log JSON có request id, error tracking, cảnh báo khi healthcheck lỗi.
10. **Lên lịch job dọn dẹp** (media, session, audit) sau khi chốt thời hạn lưu.

### P2: cải tiến

11. Rich text editor (đề xuất Lexical hoặc Tiptap) với whitelist node/mark và sanitize phía server.
12. Tạo biến thể ảnh khi upload (WebP, vài kích thước), focal point; upload streaming để giảm RAM.
13. Chuyển dần khoảng 30 chỗ tự đọc `payload.error?.message` sang `apiErrorMessage`; gom phân trang của Media và Supporting về `AdminPagination`.
14. Image ứng dụng dùng tag/digest bất biến do CI phát hành; đặt resource limit sau khi đo.
15. `EXPLAIN ANALYZE` trên bản sao dữ liệu thật trước khi thêm index.

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
