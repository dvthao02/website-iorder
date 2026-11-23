# iOrder V2 — Kiến trúc và phát triển

Bắt đầu tại [mục lục](README.md). Hướng dẫn thao tác CMS ở [OPERATIONS.md](OPERATIONS.md), luồng nghiệp vụ ở [BUSINESS.md](BUSINESS.md), dữ liệu ở [DATABASE.md](DATABASE.md), triển khai và phục hồi ở [DEPLOYMENT.md](DEPLOYMENT.md). Source và runtime là nguồn đối chiếu khi tài liệu có sai khác.

## 1. Tổng quan

Hệ thống có ba ứng dụng Next.js 16 và gói dùng chung:

| Thành phần | Đường dẫn | Vai trò | Cổng local |
|---|---|---|---|
| Website | `apps/website` | Render nội dung công khai và bản xem trước | 3000 |
| CMS | `apps/admin` | Quản lý nội dung và vận hành | 3001 |
| Backend | `apps/api` | API, xác thực, dữ liệu và media | 3002 |
| Shared | `packages/shared` | Schema, hợp đồng, service và repository | — |

CMS và website gọi Backend; chỉ Backend truy cập PostgreSQL và S3. Đường đi dữ liệu: trình duyệt → CMS/website → API route → service → repository → PostgreSQL/S3. Các ranh giới và JSONB cần hợp đồng Zod; không dùng dữ liệu từ trình duyệt như nguồn tin cậy. Route công khai tiếng Việt được ánh xạ tại `apps/website/src/lib/legacy-paths.ts`.

## 2. Nội dung và xuất bản

Trang được lưu ở `pages` và `page_blocks`; bài viết/hướng dẫn ở `posts`, sản phẩm ở `offerings`, thiết bị ở `sales_equipment`. Nội dung có trạng thái, thời gian hiển thị, phiên bản và lịch sử theo module. Trang hệ thống và trang danh sách có ràng buộc riêng; danh sách bài/sản phẩm/thiết bị lấy dữ liệu từ module sở hữu. [DATABASE.md](DATABASE.md) mô tả nơi lưu; [BUSINESS.md](BUSINESS.md) nối dữ liệu với thao tác.

Mutation nội dung gửi `expectedVersion`; khi phiên bản không khớp, API trả 409 và giao diện phải giữ bản nhập để người dùng đối chiếu. Các service/repository ghi revision và audit theo quy tắc từng module. Không coi revision và audit log là một loại dữ liệu.

Website đọc nội dung từ Backend. Sau mutation, Backend dùng wrapper `@/lib/publish-cache-revalidation` để làm mới cache website; TTL là dự phòng, không thay bước làm mới. Bản xem trước có token và kiểm tra quyền riêng. Không đưa URL hoặc token xem trước vào nội dung công khai.

## 3. Bảo mật và quyền

Danh mục quyền `module.action` nằm ở `packages/shared/src/server/auth/permissions.ts`; vai trò là dữ liệu có thể cấu hình. Backend kiểm tra tập trung ở `apps/api/src/proxy.ts` và kiểm tra chi tiết ở route/service. Màn hình ẩn nút không thay kiểm tra phía server. Endpoint mới phải ánh xạ permission; nội dung đang hoặc sẽ công khai có thể cần quyền xuất bản.

Phiên đăng nhập lưu token hash; đăng nhập và lead có giới hạn riêng. Proxy kiểm tra Origin cho mutation và áp hạn mức theo nhóm request. Caddy giữ biên mạng, TLS và header; chỉ tin IP chuyển tiếp sau khi cấu hình đúng proxy. Key và mật khẩu không được in vào log, tài liệu hay Git. Chi tiết khóa kết nối ở [INTEGRATIONS.md](INTEGRATIONS.md).

## 4. Phát triển và vận hành

Cách khởi động, cấu hình production, sao lưu và phục hồi: [DEPLOYMENT.md](DEPLOYMENT.md). Không xóa volume, chạy seed/import hoặc phục hồi đè database đang dùng chỉ để kiểm thử. Fixture tích hợp ghi dữ liệu phải dùng schema hoặc Compose cô lập. Trước thay đổi Next API, đọc tài liệu đi kèm phiên bản đang cài trong `node_modules/next/dist/docs/`.

Để thêm một lát chức năng, xác định nghiệp vụ và quyền → hợp đồng Zod → service/repository → route → CMS/website → kiểm thử. Nội dung hiển thị bằng tiếng Việt; URL public dùng tiếng Việt không dấu. Lỗi API có dạng `{ error: { code, message } }`. Dùng component và helper hiện có, không bắt người vận hành nhập JSON.

## 5. Kiểm thử và cổng chất lượng

| Lệnh | Mục đích |
|---|---|
| `pnpm typecheck` | Kiểm tra kiểu root và ba ứng dụng |
| `pnpm lint` | ESLint toàn workspace |
| `pnpm test` | Các nhóm unit và contract |
| `pnpm db:check` | Kiểm tra metadata migration, không xác nhận trạng thái database runtime |
| `pnpm --filter @iorder/<app> build` | Build ứng dụng tương ứng sau thay đổi config, route hoặc CSS |
| `pnpm test:e2e` | Playwright với ứng dụng đang chạy; dùng môi trường và dữ liệu thử cô lập |

CI chạy typecheck, lint, test, kiểm tra migration, audit dependency production và build. Không chạy build đè thư mục `.next` của phiên dev đang dùng; chọn môi trường build cô lập. Phân biệt kiểm tra tự động, thử trình duyệt và nghiệm thu production khi báo kết quả.

## 6. Quy chuẩn giao diện CMS

Dùng `apps/admin/src/components/admin/ui/`, `apps/admin/src/lib/admin-api.ts` và token `--cms-*`; không tự dựng lại nút, bảng, phân trang, panel hoặc xác nhận đã có. Nút chính dành cho hành động chính; thao tác phá hủy cần xác nhận và trạng thái lỗi rõ ràng. Các danh sách nhiều cột dùng `AdminDataTable`, bộ lọc và `AdminPagination` chung; danh sách nạp đủ trong trình duyệt (chuyển hướng, tệp cài đặt, tác giả, chuyên mục/thẻ) phân trang bằng `useClientPagination`, danh sách lớn phân trang phía máy chủ qua hợp đồng `admin-list`. Mọi lời gọi API từ CMS đi qua `requestAdminJson` (GET/POST/PUT/PATCH/DELETE) hoặc `requestAdmin` (tải tệp), không tự `fetch` rồi `response.json()`: hai hàm này đọc JSON an toàn, đổi lỗi 5xx dạng chữ thành thông báo chuẩn, báo xung đột phiên bản (409) cho khung CMS và ném `AdminApiError` (mã, trạng thái HTTP, phần `error` nguyên văn).

Biểu mẫu dùng `AdminFormField`, `AdminInput`, `AdminSelect`, `AdminCheckbox`, `AdminRadio` (lựa chọn dạng thẻ có hình riêng như `LayoutPicker`, `ContentStatusChoice` giữ kiểu của chúng) và `AdminSlugField` cho ô "Đường dẫn" của mọi trình soạn nội dung. Trang cài đặt dùng `SettingsDetailPage`; màn thông báo cả trang (không có quyền, không tìm thấy, lỗi tải) dùng `AdminMessagePage`. Màn mờ phía sau cửa sổ nổi dùng token `--cms-scrim-soft` (panel trượt), `--cms-scrim` (hộp thoại, `<dialog>`) và `--cms-scrim-strong` (xem ảnh lớn), không viết lại `rgb(...)`.

Loại tệp dùng `AdminFileIcon` và token `--cms-file-*`; xuất là mũi tên xuống, nhập là mũi tên lên. Trình dựng thể hiện đúng quan hệ cha–con, bố cục chung chỉnh một lần ở thành phần cha, nội dung từng mục sửa tại mục đó. Đảm bảo có tên truy cập, bàn phím, trạng thái đang xử lý và bố cục co được trên màn hẹp.
