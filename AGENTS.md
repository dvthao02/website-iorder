# Hướng dẫn cho agent — iOrder V2

Đọc trước khi sửa code. Kiến trúc, dữ liệu, vận hành: [docs/PROJECT.md](docs/PROJECT.md). Hiện trạng và backlog: [docs/ROADMAP.md](docs/ROADMAP.md).

## Ưu tiên

Yêu cầu hiện tại của người dùng → source/runtime thực tế → file này → `docs/`. Khi tài liệu và code lệch nhau, tin code và cập nhật tài liệu.

## Kiến trúc phải giữ

- Ba app Next.js 16 (`apps/publish-web`, `apps/cms`, `apps/backend`) cùng `packages/core`. Chỉ Backend được truy cập PostgreSQL/S3; CMS và publish-web gọi Backend.
- Luồng: route handler → service → repository → Drizzle. Zod ở mọi ranh giới input/output; JSONB phải có schema.
- Next 16 khác với dữ liệu huấn luyện: đọc `node_modules/next/dist/docs/` trước khi dùng API Next (xem `apps/*/AGENTS.md`, file do `next dev` tự quản lý, đừng xóa).
- Mutation admin dùng `revalidatePath` từ `@/lib/publish-cache-revalidation` (không import trực tiếp từ `next/cache`), vì wrapper này làm mới cache của publish-web.
- Quyền CMS định nghĩa ở `packages/core/src/server/auth/permissions.ts` và kiểm tra tập trung ở `apps/backend/src/proxy.ts`. Endpoint admin mới phải ánh xạ đúng permission.
- Không thêm framework lớn, Redis, queue, microservice, ORM hay dependency mới khi chưa được duyệt. Làm từng vertical slice trọn vẹn.

## Quy ước code

- Văn bản hiển thị cho người dùng viết bằng tiếng Việt; thông báo lỗi API theo dạng `{ error: { code, message } }`.
- CMS: dùng component trong `apps/cms/src/components/admin/ui/` (`AdminButton`, `AdminPagination`, `AdminDataTable`, `AdminSidePanel`…) và `apps/cms/src/lib/admin-api.ts` thay vì tự viết lại. Người vận hành không bao giờ phải nhập JSON.
- Mutation nội dung gửi `expectedVersion` và xử lý được HTTP 409.
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
