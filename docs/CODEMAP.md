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

Mô-đun server hiện có: `admin analytics audit auth authors backup dashboard data-transfer equipment leads media navigation offerings pages posts publishing publishing-readiness redirects revisions roles search-console secrets seo-audit settings shared support supporting system taxonomy users`. `shared/` giữ tiện ích chung (danh sách phân trang `admin-list.contract.ts`, sắp xếp `list-order.ts`, thời gian `relative-time.ts`, đường dẫn cũ `legacy-paths.ts`…).

## 2. Theo tính năng

**Liên hệ khách hàng** (`packages/shared/src/server/leads/`)
- `leads.contract.ts` (đầu vào công khai, danh sách, cập nhật, gộp), `leads.repository.ts` (tạo liên hệ qua các lớp chống spam, danh sách, cập nhật gồm sửa thông tin khách, xóa kèm xóa dữ liệu cá nhân, gộp, người được giao), `leads.service.ts`.
- Chống spam: `leads.guard.ts` (mã phiên, giới hạn theo số điện thoại, trùng, giãn cách), `leads.rate-limit.ts` (theo IP), `leads.phone.ts` (chuẩn hóa số, dùng cả ở ô nhập website). Gộp: `leads.merge.ts`. Dọn dữ liệu cũ: `scripts/cleanup-deleted-leads.ts` (`pnpm db:cleanup-leads`). Xuất: `leads.csv.ts`.
- API: công khai `api/v1/leads/route.ts` (GET lấy mã phiên, POST gửi); CMS `api/v1/admin/leads/{route,[id]/route,merge/route,export/route}.ts`.
- CMS: `…/(protected)/leads/page.tsx`; `components/admin/leads-manager.tsx` (bảng, bộ lọc, hành động hàng loạt), `lead-detail-panel.tsx` (khung chi tiết), `leads-parts.tsx` (kiểu, nhãn, ô chọn, ghi chú, sửa thông tin). Website: `components/site/{lead-form,equipment-inquiry,consult-popup-dialog,phone-input}.tsx`, `lib/submit-lead.ts`.

**Thông báo CMS** (`packages/shared/src/server/dashboard/`)
- Thông báo tính lại từ dữ liệu thật: `notifications.service.ts` (`collectAdminNotifications`, `getAdminNotifications`, `changeNotificationStates`), kiểu và schema ở `notifications.contract.ts`. Đã đọc/đã xóa theo từng người: `notification-state.ts` (thuần), `notification-state.repository.ts`, bảng `db/schema/notifications.ts`.
- API `api/v1/admin/notifications/route.ts` (GET, POST). CMS: `components/admin/admin-notification-bell.tsx`, `lib/use-admin-notifications.ts`; CSS `apps/admin/src/styles/shell.css` (`admin-notifications__*`); nạp lần đầu ở `…/(protected)/layout.tsx`.

**Danh sách CMS dùng chung**: thanh lọc `components/admin/ui/admin-filter-bar.tsx` (ô tìm kiếm tìm ngay khi gõ — tắt bằng `liveSearch={false}`, `more` là "Bộ lọc khác", nhãn bộ lọc đang áp dụng), bảng `ui/admin-data-table.tsx` (cột có thể `defaultHidden`, người dùng tự ẩn/hiện và đổi thứ tự, lưu ở trình duyệt), menu thao tác hàng loạt `ui/admin-bulk-menu.tsx` (có `group`).

**Khóa bài viết** (`posts.locked_at`): quyền `posts.lock`; `posts.repository.ts` (`setPostLock`; bài khóa bị chặn ở `updatePostWithRevision`/`deleteArchivedPost`), `posts.service.ts` (`updateAdminPost` ném `ContentLockedError` → API trả 423), route `api/v1/admin/posts/[id]/lock`; CMS `components/admin/post-lock-bar.tsx` + `posts-content-manager.tsx` (chỉ đọc khi khóa).

**Đăng nhập, người dùng, vai trò**: `server/auth/` (phiên, mật khẩu, giới hạn đăng nhập, `permissions.ts`), `server/users/`, `server/roles/`. Trang CMS `users/`, `roles/`, `my-account/`.

**Nội dung**: `server/pages` (trang và khối), `server/posts` (bài viết, hướng dẫn), `server/offerings` (sản phẩm, giải pháp), `server/equipment` (thiết bị), `server/taxonomy`, `server/authors`, `server/navigation` (menu), `server/redirects`, `server/revisions` (phiên bản). Mỗi mô-đun theo bộ ba contract/repository/service; trang CMS cùng tên.

**Xuất bản và xem trước**: `server/publishing` (xem trước, làm mới cache website, IndexNow), `server/publishing-readiness`, `server/seo-audit`, `server/search-console`.

**Media**: `server/media` (tải lên, S3/SeaweedFS ở `storage.ts`, xóa hàng đợi). **Cài đặt website**: `server/settings` (cửa sổ tư vấn, liên kết ngoài, hồ sơ doanh nghiệp, cấu hình xuất bản). **Sao lưu/phục hồi**: `server/backup`, `scripts/backup.*`. **Nhập/xuất dữ liệu**: `server/data-transfer`. **Nhật ký**: `server/audit` (nhãn thao tác ở `audit-labels.ts`).

## 3. Thêm hoặc đổi thì cập nhật những đâu

- **Cột/bảng mới**: schema → `index.ts` nếu là file mới → `pnpm db:generate --name …` → hàm đọc/ghi ở repository → hợp đồng (`*.contract.ts`) → nơi hiển thị. Bảng mới nên có `scripts/audit-*-db.ts` kiểm trên schema tạm.
- **Quyền mới**: `permissions.ts` (mô-đun và hành động) → `admin-permission.ts` nếu cần ngoại lệ → `admin-permission.test.ts` → CMS ẩn/hiện nút theo `useAdminPermissions()`. Vai trò đã tạo trong DB không tự có quyền mới.
- **Endpoint admin mới**: tên đoạn đầu trong `resourceModules` (`admin-permission.ts`); POST/PUT/PATCH/DELETE ánh xạ sang create/update/update/delete.
- **Nhãn nhật ký**: `action` dạng `<chủ thể>.<động từ>` thêm vào `server/audit/audit-labels.ts`.
- **File test mới**: thêm vào đúng nhóm `test:<nhóm>` trong `package.json` (tên file được liệt kê tường minh, không tự quét); nếu không, `pnpm test` không chạy nó.

## 4. Lệnh hay dùng

- Cổng chất lượng: `pnpm typecheck && pnpm lint && pnpm test && pnpm db:check`. Chạy một nhóm: `pnpm test:leads`, `test:users`…
- Kiểm DB trên schema tạm: `pnpm audit:<tên>-db` hoặc `node --import tsx scripts/audit-leads-db.ts`; đặt `AUDIT_DEBUG=1` để xem lỗi gốc.
- Docker local: `docker buildx bake -f compose.yaml --allow=fs.read=Dockerfile --load <migrate|api|admin|website>` rồi `docker compose up -d` (migration tự chạy).
- Nhiều file dùng CRLF, số khác dùng LF: khi sửa bằng script, giữ nguyên kiểu xuống dòng của file (xem `AGENTS.md`).
