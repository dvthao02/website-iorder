# Bản đồ mã nguồn

Tìm nhanh nơi chứa logic của một tính năng, để sửa đúng file mà không phải đọc cả dự án. Đây là bản đồ, không phải nguồn sự thật: file đổi tên hay tách ra thì cập nhật ở đây; khi lệch, tin source.

## 1. Quy ước chung

| Lớp | Vị trí | Việc của lớp |
|---|---|---|
| Hợp đồng dữ liệu | `packages/shared/src/server/<mô-đun>/<mô-đun>.contract.ts` | Zod schema và kiểu; không đụng DB. CMS, API và website cùng dùng. |
| Truy cập DB | `…/<mô-đun>.repository.ts` | Chỉ Drizzle/SQL, giao dịch, khóa. Không chứa luật nghiệp vụ. |
| Nghiệp vụ | `…/<mô-đun>.service.ts` | Luật nghiệp vụ, kiểm quyền theo mô-đun, nhật ký hoạt động. |
| Hàm thuần | các file cạnh đó (`*.guard.ts`, `*.phone.ts`, `*.merge.ts`…) | Không đụng DB, giờ và khóa truyền vào; mỗi file có `*.test.ts` bên cạnh. |
| Bảng | `packages/shared/src/db/schema/*.ts` (+ `index.ts`, `enums.ts`) | Khai báo bảng; migration ở `drizzle/` (`pnpm db:generate --name <tên>`). |
| API | `apps/api/src/app/api/v1/{admin,public}/<tài nguyên>/route.ts` | Route mỏng: parse → service → trả JSON `{ error: { code, message } }` khi lỗi. |
| Quyền | `packages/shared/src/server/auth/permissions.ts` + `apps/api/src/lib/admin-permission.ts` | Danh mục quyền; ánh xạ đoạn đường dẫn đầu tiên và phương thức HTTP sang quyền (ngoại lệ viết tay trong `requiredAdminPermissions`). Kiểm ở `apps/api/src/proxy.ts`. |
| Trang CMS | `apps/admin/src/app/admin/(protected)/<trang>/page.tsx` | Server component, đọc dữ liệu qua `apps/admin/src/lib/backend.ts`, truyền xuống component client. |
| Component CMS | `apps/admin/src/components/admin/*-manager.tsx` (danh sách), `*-editor*.tsx` (soạn), `ui/` (nút, bảng, panel, xác nhận…) | Gọi API qua `lib/admin-api.ts`. |
| Website | `apps/website/src/app/(web)/…`, `components/site/`, `lib/` | Trang công khai; gọi Backend qua `lib/backend.ts`. |
| E2E | `e2e/*.spec.ts`, `e2e/helpers.ts` | Chạy trên stack đang chạy; đăng nhập bằng `INITIAL_ADMIN_*` trong `.env`. |

Mô-đun server hiện có: `admin analytics audit auth authors backup dashboard data-transfer equipment leads media navigation offerings pages posts publishing publishing-readiness redirects revisions roles search-console secrets seo-audit settings shared support supporting system taxonomy translations users`. `shared/` giữ tiện ích chung (danh sách phân trang `admin-list.contract.ts`, sắp xếp `list-order.ts`, thời gian `relative-time.ts`, đường dẫn cũ `legacy-paths.ts`…).

## 2. Theo tính năng

**Liên hệ khách hàng** (`packages/shared/src/server/leads/`)
- `leads.contract.ts` (đầu vào công khai, danh sách, cập nhật, gộp), `leads.repository.ts` (tạo liên hệ qua các lớp chống spam, danh sách, cập nhật gồm sửa thông tin khách, xóa kèm xóa dữ liệu cá nhân, gộp, người được giao), `leads.service.ts`.
- Chống spam: `leads.guard.ts` (mã phiên, giới hạn theo số điện thoại, trùng, giãn cách), `leads.rate-limit.ts` (theo IP), `leads.phone.ts` (chuẩn hóa số, dùng cả ở ô nhập website). Gộp: `leads.merge.ts`. Dọn dữ liệu cũ: `scripts/cleanup-deleted-leads.ts` (`pnpm db:cleanup-leads`). Xuất: `leads.csv.ts`.
- API: công khai `api/v1/leads/route.ts` (GET lấy mã phiên, POST gửi); CMS `api/v1/admin/leads/{route,[id]/route,merge/route,export/route}.ts`.
- CMS: `…/(protected)/leads/page.tsx`; `components/admin/leads-manager.tsx` (bảng, bộ lọc, hành động hàng loạt), `lead-detail-panel.tsx` (khung chi tiết), `leads-parts.tsx` (kiểu, nhãn, ô chọn, ghi chú, sửa thông tin). Website: `components/site/{lead-form,equipment-inquiry,consult-popup-dialog,phone-input}.tsx`, `lib/submit-lead.ts`.

**Thông báo CMS** (`packages/shared/src/server/dashboard/`)
- Thông báo tính lại từ dữ liệu thật: `notifications.service.ts` (`collectAdminNotifications`, `getAdminNotifications`, `changeNotificationStates`), kiểu và schema ở `notifications.contract.ts`. Đã đọc/đã xóa theo từng người: `notification-state.ts` (thuần), `notification-state.repository.ts`, bảng `db/schema/notifications.ts`.
- API `api/v1/admin/notifications/route.ts` (GET, POST). CMS: `components/admin/admin-notification-bell.tsx`, `lib/use-admin-notifications.ts`; CSS `apps/admin/src/styles/shell.css` (`admin-notifications__*`); nạp lần đầu ở `…/(protected)/layout.tsx`.

**Gmail báo liên hệ mới** (`packages/shared/src/server/gmail/`)
- `gmail.contract.ts` (schema, `gmailCallbackPath`), `gmail.google.ts` (OAuth, làm mới token, gửi Gmail API; nhận `fetch` từ ngoài), `gmail.mime.ts` (dựng thư, chặn chèn tiêu đề), `gmail.lead-mail.ts` (nội dung thư), `gmail.pending.ts` (state OAuth trong bộ nhớ), `gmail.repository.ts` (`site_settings` `gmail_notifications`, `gmail_connection`), `gmail.service.ts` (kết nối, gửi, giới hạn), `gmail.ts` (nối phụ thuộc thật). Token cất ở kho khóa (`secrets`, khóa `gmail_refresh_token`, ghi bằng `putServerSecret` sau `verifyReauthentication`).
- Gọi từ `leads.service.ts › submitPublicLead` (liên hệ mới, chạy nền). API `api/v1/admin/gmail/route.ts` (chỉ Super Admin). CMS: `components/admin/gmail-connection-card.tsx`; trang riêng `…/(protected)/integrations/gmail/page.tsx` (mục “Gmail báo liên hệ” ở Hệ thống, `admin-navigation.ts`); Google chuyển về `…/integrations/gmail/callback/page.tsx` + `gmail-callback.tsx`; Client ID/secret là công cụ `gmail` trong `secrets.contract.ts`. Test: `pnpm test:gmail`.

**Danh sách CMS dùng chung**: thanh lọc `components/admin/ui/admin-filter-bar.tsx` (ô tìm kiếm tìm ngay khi gõ — tắt bằng `liveSearch={false}`, `more` là "Bộ lọc khác", nhãn bộ lọc đang áp dụng), bảng `ui/admin-data-table.tsx` (cột có thể `defaultHidden`, người dùng tự ẩn/hiện và đổi thứ tự, lưu ở trình duyệt), menu thao tác hàng loạt `ui/admin-bulk-menu.tsx` (có `group`).

**Khóa bài viết** (`posts.locked_at`): quyền `posts.lock`; `posts.repository.ts` (`setPostLock`; bài khóa bị chặn ở `updatePostWithRevision`/`deleteArchivedPost`), `posts.service.ts` (`updateAdminPost` ném `ContentLockedError` → API trả 423), route `api/v1/admin/posts/[id]/lock`; CMS `components/admin/post-lock-bar.tsx` + `posts-content-manager.tsx` (chỉ đọc khi khóa).

**Đăng nhập, người dùng, vai trò**: `server/auth/` (phiên, mật khẩu, giới hạn đăng nhập, `permissions.ts`), `server/users/`, `server/roles/`. Trang CMS `users/`, `roles/`, `my-account/`. Tài khoản ẩn (`users.is_hidden`, đặt bởi `scripts/seed-admin.ts`): `server/users/hidden-users.ts` che nó khỏi mọi người trừ chính nó theo `viewerId` trong `request-context.ts` (điền ở `getCurrentAdministrator`); truy vấn mới có đọc bảng `users` phải dùng `visibleUser()`, `shownFullName()`.

**Nội dung**: `server/pages` (trang và khối), `server/posts` (bài viết, hướng dẫn), `server/offerings` (sản phẩm, giải pháp), `server/equipment` (thiết bị), `server/taxonomy`, `server/authors`, `server/navigation` (menu), `server/redirects`, `server/revisions` (phiên bản; dọn lịch sử cũ: `scripts/cleanup-old-revisions.ts`, `pnpm db:cleanup-revisions`). Mỗi mô-đun theo bộ ba contract/repository/service; trang CMS cùng tên.

**Xuất bản và xem trước**: `server/publishing` (xem trước, làm mới cache website, IndexNow), `server/publishing-readiness`, `server/seo-audit`, `server/search-console`.

**Media**: `server/media` (tải lên, S3/SeaweedFS ở `storage.ts`, xóa hàng đợi; "Đang dùng tại" do `collectMediaUsage` trong `media.repository.ts`, mỗi nơi dùng kèm liên kết CMS từ `media-usage-link.ts`: thêm nơi chứa mã media mới thì sửa cả hai). **Cài đặt website**: `server/settings` (cửa sổ tư vấn, liên kết ngoài, hồ sơ doanh nghiệp, cấu hình xuất bản). **Sao lưu/phục hồi**: `server/backup`, `scripts/backup.*`. **Nhập/xuất dữ liệu**: `server/data-transfer`. **Đa ngôn ngữ**: `server/translations` (`locales.ts` danh mục ngôn ngữ có thể thêm (thêm ngôn ngữ mới vào danh mục: thêm một dòng ở đó); `translations.locale-setting.ts` danh sách ngôn ngữ người vận hành đã thêm (site_settings `translation_locales`, mặc định chỉ `en`; thêm/gỡ qua `PUT admin/translations` kèm `expectedVersion`, ngôn ngữ đã có bản dịch không gỡ được); `translatable.ts` trường cần dịch và duyệt nội dung; `translations.source.ts` gom câu gốc; `translations.service.ts` thay bản dịch, xuất/nhập file; `translations.export.ts` chọn dòng, cột và tên file xuất: `?scope=all|missing`, `?groups=ui,pages`, `?suggest=1`; `translations.groups.ts` danh sách vùng nội dung (thêm loại bài viết mới thì thêm vào `postGroups`); `translations.suggest.ts` gợi ý bản dịch từ câu chỉ khác hoa/thường hay dấu câu cuối), route công khai `apps/api/.../public/content` nhận `?lang=` và gọi `localizeContent`, route CMS `admin/translations`, màn `admin/(protected)/translations` (`translations-manager.tsx`; tải file bằng `lib/download-file.ts` để lỗi hiện thành thông báo thay vì mở trang JSON); website: `lib/locale.ts` (cookie `iorder_lang`), `proxy.ts` (xử lý `?lang=`), `lib/backend.ts` (`publicResource` truyền `lang`), danh sách thả xuống chọn ngôn ngữ `components/site/language-switcher.tsx` kèm cờ SVG ở `language-flag.tsx` (cờ của ngôn ngữ mới là tùy chọn: thêm vào `flags` hoặc `stripedFlags`, chưa có cờ thì hiện quả địa cầu). Thêm trường chữ mới cần dịch: thêm tên trường vào `translatableKeys`. Chữ cố định của giao diện website: danh mục `ui-messages.ts` (khóa `nhóm.tên`, biến `{ten}`), website dùng `lib/messages.ts` (`getT()` máy chủ), `components/site/messages-provider.tsx` (`useT()` trình duyệt), `lib/translate.ts` (hàm thuần, truyền `t` qua props cho thành phần có test); route công khai `resource=messages`. Thành phần có `t` tùy chọn (mặc định tiếng Việt, tiện cho test) phải được truyền `t` ở mọi nơi dùng: `lib/translate-usage.test.ts` quét và báo nơi thiếu; thêm chữ cố định mới thì thêm khóa vào `ui-messages.ts` rồi dùng `t(...)`, không viết thẳng tiếng Việt vào thành phần (tên mục dự phòng trang tĩnh ở `lib/static-section-labels.ts`, nhãn tình trạng hàng ở `availability-badge.tsx`). Thành phần chạy trên trình duyệt không được import module dùng `getT` (kéo `next/headers` vào gói trình duyệt). **Nhật ký**: `server/audit` (nhãn thao tác ở `audit-labels.ts`).

## 3. Thêm hoặc đổi thì cập nhật những đâu

- **Cột/bảng mới**: schema → `index.ts` nếu là file mới → `pnpm db:generate --name …` → hàm đọc/ghi ở repository → hợp đồng (`*.contract.ts`) → nơi hiển thị. Bảng mới nên có `scripts/audit-*-db.ts` kiểm trên schema tạm.
- **Quyền mới**: `permissions.ts` (mô-đun và hành động) → `admin-permission.ts` nếu cần ngoại lệ → `admin-permission.test.ts` → CMS ẩn/hiện nút theo `useAdminPermissions()`. Vai trò đã tạo trong DB không tự có quyền mới.
- **Endpoint admin mới**: tên đoạn đầu trong `resourceModules` (`admin-permission.ts`); POST/PUT/PATCH/DELETE ánh xạ sang create/update/update/delete.
- **Nhãn nhật ký**: `action` dạng `<chủ thể>.<động từ>` thêm vào `server/audit/audit-labels.ts`.
- **File test mới**: thêm vào đúng nhóm `test:<nhóm>` trong `package.json` (tên file được liệt kê tường minh, không tự quét); nếu không, `pnpm test` không chạy nó.

**Hiệu năng** (đã đo, xem `docs/ROADMAP.md` mục Hiệu năng):
- Proxy website chạy ở mọi lượt xem trang nhưng không dùng được bộ đệm dữ liệu của Next: tra chuyển hướng URL đi qua `apps/website/src/lib/redirect-cache.ts` (giữ 30 giây trong bộ nhớ, tối đa 500 đường dẫn, lỗi không được nhớ; `clearRedirectCache()` gọi ở `app/api/internal/revalidate/route.ts` nên lưu chuyển hướng ở CMS có hiệu lực ngay). Dùng `globalThis` vì proxy và route được đóng gói riêng.
- Số liệu Umami (`server/analytics/analytics.service.ts`): giữ 60 giây (lỗi 30 giây), hết hạn thì trả bản cũ và làm mới ở nền; không có thì Tổng quan và Thống kê truy cập đứng 4 giây mỗi lần khi Umami chậm hoặc ngừng.
- JavaScript của khách: component `"use client"` của website không được kéo zod (~30 KB gz) vào trình duyệt, test `apps/website/src/lib/client-bundle.test.ts` giữ điều này. Cần hàm thuần từ contract thì tách ra module không import zod (mẫu: `server/shared/appearance-height.ts`, `server/settings/popup-link.ts`, `apps/website/src/lib/builder-preview-message.ts`) rồi để contract nhập lại và xuất lại.
- Chỉ mục PostgreSQL phải đúng thứ tự mà truy vấn dùng: `audit_logs_created_at_index` là `DESC NULLS FIRST` (thứ tự mặc định của `ORDER BY … DESC`); bản `DESC NULLS LAST` (mặc định của `.desc()` trong Drizzle) bị PostgreSQL bỏ qua, dùng `.desc().nullsFirst()`.
- Hoạt ảnh lặp trên trang đăng nhập Giáng sinh chỉ đổi `transform`/`opacity` (test `apps/admin/src/lib/login-smoothness.test.ts`); không ghi biến CSS kế thừa (`--px`, `--xmas-twinkle`) lên thẻ gốc của cảnh trên cảm ứng.

## 4. Lệnh hay dùng

- Cổng chất lượng: `pnpm typecheck && pnpm lint && pnpm test && pnpm db:check`. Chạy một nhóm: `pnpm test:leads`, `test:users`…
- Kiểm DB trên schema tạm: `pnpm audit:<tên>-db` hoặc `node --import tsx scripts/audit-leads-db.ts`; đặt `AUDIT_DEBUG=1` để xem lỗi gốc.
- Docker local: `docker buildx bake -f compose.yaml --allow=fs.read=Dockerfile --load <migrate|api|admin|website>` rồi `docker compose up -d` (migration tự chạy).
- Nhiều file dùng CRLF, số khác dùng LF: khi sửa bằng script, giữ nguyên kiểu xuống dòng của file (xem `AGENTS.md`).
