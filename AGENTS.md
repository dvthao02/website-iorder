# Hướng dẫn cho agent — iOrder V2

Đọc trước khi sửa code. Kiến trúc, dữ liệu, vận hành: [docs/PROJECT.md](docs/PROJECT.md). Hiện trạng và backlog: [docs/ROADMAP.md](docs/ROADMAP.md).

## Ưu tiên

Yêu cầu hiện tại của người dùng → source/runtime thực tế → file này → `docs/`. Khi tài liệu và code lệch nhau, tin code và cập nhật tài liệu.

## Kiến trúc phải giữ

- Ba app Next.js 16 (`apps/website`, `apps/admin`, `apps/api`) cùng `packages/shared`. Chỉ Backend được truy cập PostgreSQL/S3; CMS và website gọi Backend.
- Luồng: route handler → service → repository → Drizzle. Zod ở mọi ranh giới input/output; JSONB phải có schema.
- Next 16 khác với dữ liệu huấn luyện: đọc `node_modules/next/dist/docs/` trước khi dùng API Next (xem `apps/*/AGENTS.md`, file do `next dev` tự quản lý, đừng xóa).
- Mutation admin dùng `revalidatePath` từ `@/lib/publish-cache-revalidation` (không import trực tiếp từ `next/cache`), vì wrapper này làm mới cache của website.
- Quyền CMS định nghĩa ở `packages/shared/src/server/auth/permissions.ts` và kiểm tra tập trung ở `apps/api/src/proxy.ts`. Endpoint admin mới phải ánh xạ đúng permission.
- Không thêm framework lớn, Redis, queue, microservice, ORM hay dependency mới khi chưa được duyệt. Làm từng vertical slice trọn vẹn.

## Quy ước code

- Văn bản hiển thị cho người dùng viết bằng tiếng Việt; thông báo lỗi API theo dạng `{ error: { code, message } }`.
- URL public là tiếng Anh và trùng tên thư mục route (`/news`, `/support/guides`, `/privacy-policy`, `/terms-of-use`; thư mục `app/(web)/news`…), nên không dùng `rewrites()`. Slug nội dung do người vận hành đặt (bài viết, sản phẩm…, thường tiếng Việt không dấu). Thư mục route, tên file, mã nguồn, tên lệnh `pnpm` và URL `/admin` là tiếng Anh. URL tiếng Việt cũ (`/tin-tuc`, `/gioi-thieu`…) tự chuyển 301 về URL chuẩn qua bảng `legacyPaths` ở `packages/shared/src/server/shared/legacy-paths.ts`. Đổi hoặc thêm route public thì cập nhật thư mục route, `fixedWebsitePages` (`pages.contract.ts`), `content-paths.ts`, bảng `legacyPaths` và thêm migration đổi liên kết đã lưu (mẫu: `drizzle/0028_english_public_urls.sql`). Văn bản hiển thị, thông báo lỗi và log là tiếng Việt (sau này tách sang i18n). Slug nội bộ của trang hệ thống (`home`, `about`, `terms`…) là khóa dữ liệu, không hiện trong URL (`terms` ↔ `/terms-of-use`).
- CMS: dùng component trong `apps/admin/src/components/admin/ui/` (`AdminButton`, `AdminPagination`, `AdminDataTable`, `AdminSidePanel`…) và `apps/admin/src/lib/admin-api.ts` thay vì tự viết lại. Người vận hành không bao giờ phải nhập JSON. Màu, biểu tượng loại tệp và nút xuất/nhập theo quy chuẩn ở [docs/PROJECT.md](docs/PROJECT.md) mục 6 (`AdminFileIcon`, token `--cms-*`).
- Mutation nội dung gửi `expectedVersion` và xử lý được HTTP 409.
- Chuyển hướng URL: lưu một chuyển hướng đang bật (hoặc tự tạo khi đổi slug nội dung đã xuất bản) phải đổi luôn mọi liên kết nội bộ trỏ tới đường dẫn cũ sang đích, cùng transaction (`rewriteInternalLinks` ở `packages/shared/src/server/redirects/redirect-links.ts`, nhận diện liên kết theo tên trường `href`/`url`/`link`/`…Href`/`…Url`/`…Link`). Thêm bảng/cột lưu liên kết nội bộ mới thì thêm vào hàm đó. Chuyển hướng không được tạo vòng lặp, kể cả với chuyển hướng có sẵn trong mã (`builtInRedirect`, kiểm ở `redirect-cycle.ts`).
- Viết theo phong cách code xung quanh. Một số file dùng CRLF, nên khi sửa bằng regex/sed phải kiểm tra lại.
- Mọi file ghi bằng UTF-8 (không BOM). Sau khi sửa, kiểm tra tiếng Việt không bị vỡ thành dạng `Ã´`, `áº¡`. PowerShell 5.1 `Set-Content` mặc định không dùng UTF-8.

## An toàn

- Không đọc, in hay commit secret; `.env*` thật không được track.
- Không chạy seed/import/migration phá hủy trên DB local đang có dữ liệu của người dùng, và không xóa volume Docker khi chưa được đồng ý. Fixture audit chỉ chạy trên schema hoặc Compose tạm.
- Docker tốn RAM trên máy Windows của người dùng: chỉ bật khi task cần.
- Worktree thường có nhiều thay đổi chưa commit, có thể do người khác hoặc agent khác. Không revert hay ghi đè thay đổi không phải của mình; commit nhỏ, tách theo chủ đề, chỉ commit khi được yêu cầu.

## Trước khi báo xong

```sh
pnpm typecheck && pnpm lint && pnpm test && pnpm db:check
```

Chạy thêm `pnpm --filter @iorder/<app> build` khi đổi config, route hoặc CSS. Báo đúng những gì đã kiểm chứng và những gì chưa (nhất là các luồng chưa thử trên trình duyệt). Kết quả đáng giữ thì cập nhật vào `docs/ROADMAP.md`, không tạo log audit mới.
