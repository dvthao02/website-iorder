# Cơ sở dữ liệu iOrder V2

PostgreSQL là nguồn lưu dữ liệu; Backend là ứng dụng duy nhất kết nối trực tiếp. Cấu trúc chuẩn nằm ở `packages/shared/src/db/schema/`, migration ở `drizzle/`, hợp đồng và nghiệp vụ ở `packages/shared/src/server/`. Tài liệu này giải thích mô hình, không thay schema khi cần đối chiếu từng cột, khóa ngoại hoặc index.

## 1. Quy tắc chung

- Bảng chính thường dùng UUID, thời gian tạo/cập nhật và có thể có `deleted_at`. Xóa mềm và điều kiện duy nhất phụ thuộc bảng; không suy ra toàn bộ bảng có cùng chính sách.
- Nội dung có vòng đời dùng `draft`, `review`, `scheduled`, `published`, `archived`. Website đọc nội dung đủ điều kiện hiển thị; hẹn giờ đã tới hạn không cần job đổi trạng thái.
- Nội dung có `draft_version`, nhiều danh mục/cấu hình có `version`. Request sửa gửi `expectedVersion`; transaction kiểm tra phiên bản để chặn ghi đè và trả 409 khi xung đột. Không phải mọi bảng đều có version: kiểm tra schema và hợp đồng thực tế.
- `*_revisions` giữ snapshot nội dung; `audit_logs` ghi hành động (Super Admin xóa được theo phạm vi từ CMS; mỗi lần xóa để lại một dòng `audit.purge` không bị xóa). Không xóa một loại với giả định loại kia thay thế được. Tài khoản và nhật ký có dữ liệu nhạy cảm; không xuất hoặc in tùy tiện.
- JSONB dùng cho nội dung có cấu trúc biến đổi và được kiểm tra bằng Zod ở service/contract. Tham chiếu media trong JSON không phải khóa ngoại SQL; cần kiểm tra sử dụng qua ứng dụng trước khi xóa tệp.

## 2. Các nhóm dữ liệu

| Nhóm | Bảng | Ý nghĩa và liên kết chính |
|---|---|---|
| Truy cập | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions`, `login_throttle_buckets` | Tài khoản, vai trò, quyền, phiên và giới hạn đăng nhập. Danh mục quyền trong code; role thực tế trong DB. |
| Trang | `pages`, `page_blocks`, `page_revisions` | Một trang có nhiều khối theo `sort_order`, lịch sử chứa snapshot. `type`, `data`, `appearance` theo `pageBlockInputSchema` và `blockAppearanceSchema`. |
| Bài viết | `posts`, `post_revisions`, `post_authors`, `categories`, `tags`, `post_categories`, `post_tags` | Bài tin và hướng dẫn dùng cùng bảng, phân loại bằng `type`; tác giả hiển thị khác tài khoản CMS tạo bài. |
| Sản phẩm | `offerings`, `offering_revisions` | Phần mềm, giải pháp và dịch vụ phân biệt bằng `type`; nội dung biến thiên nằm trong JSONB. |
| Thiết bị | `equipment_groups`, `sales_equipment`, `sales_equipment_revisions` | Nhóm, giá VND, thương hiệu, tình trạng hàng, thông số và nội dung trang thiết bị. |
| Hỗ trợ | `support_downloads`, `support_download_revisions` | Tệp cài đặt có nguồn là media hoặc liên kết ngoài theo hợp đồng. |
| Nội dung phụ | `partners`, `testimonials`, `contact_leads` | Đối tác, đánh giá và liên hệ. Lead chứa dữ liệu cá nhân. |
| Media | `media_assets` | Metadata, kích thước, mô tả, `storage_key`; object thật ở S3, không nằm trong dump PostgreSQL. |
| Cấu trúc | `menus`, `menu_items`, `menu_revisions`, `redirects` | Menu cây, lịch sử và chuyển hướng đường dẫn. |
| Cấu hình | `site_profile`, `site_settings`, `secure_settings` | Thông tin doanh nghiệp, cấu hình JSONB và khóa kết nối mã hóa. Khóa chủ nằm ngoài DB. Biểu mẫu tư vấn và quảng cáo tự hiện lưu ở hai khóa `consult_form` và `promotion_popup` (mỗi khóa có `version` riêng); khóa gộp cũ `consult_popup` chỉ còn được đọc để chuyển tiếp khi hai khóa mới chưa có. |
| Hệ thống | `audit_logs`, `builder_previews` | Nhật ký thao tác và bản xem trước có thời hạn. |

Trang hệ thống có khóa nội bộ như `home` và đường dẫn do code quản lý; trang tự tạo dùng đường dẫn riêng. Bài `guide` và bài tin có tiền tố URL khác nhau. Khi thay URL công khai, kiểm tra chuyển hướng theo quy tắc trong `shared/content-paths.ts`. Lưu chuyển hướng (CMS hoặc tự tạo khi đổi slug) cũng đổi các liên kết nội bộ trỏ tới URL cũ sang URL mới ở `menu_items.url` (mục `custom`), `page_blocks.data`, `posts.content`/`cta_url`, `offerings.content`, `sales_equipment.blocks`/`page_layout` và `site_settings.value` (trừ khóa `system.*`), tăng `version`/`draft_version` của nội dung bị sửa và ghi `audit_logs` hành động `redirect.rewrite_links`; bảng `*_revisions` giữ nguyên lịch sử (`packages/shared/src/server/redirects/redirect-links.ts`).

## 3. Quan hệ và bảo toàn dữ liệu

`pages` → `page_blocks`/`page_revisions`; `posts` → revisions và bảng nối chuyên mục/thẻ; `offerings` và `sales_equipment` → revisions; `menus` → menu items/revisions. `media_assets` được tham chiếu bởi cột khóa ngoại và cả nội dung JSON. Một số khóa ngoại đặt null hoặc cascade khi xóa vật lý, nhưng thao tác trong ứng dụng có thể từ chối xóa khi còn sử dụng; không xóa trực tiếp để vượt kiểm tra nghiệp vụ.

Sao lưu database chỉ chứa metadata media và giá trị mã hóa, không chứa object S3 hoặc khóa chủ. Một bản phục hồi dùng được cần xác minh riêng cả database, media và khả năng giải mã. Xem [DEPLOYMENT.md](DEPLOYMENT.md).

## 4. Migration và kiểm tra

Các tệp SQL hiện đến `0027_foreign_key_indexes`. `pnpm db:check` kiểm tra metadata migration, không xác nhận migration đã chạy trên database cụ thể. Khi thay schema: rà dữ liệu cũ và tính tương thích, sinh/kiểm SQL, thử áp và kiểm tra dữ liệu trên database tạm, chuẩn bị sao lưu và phương án quay lui. Không tự chạy migration hay backfill phá hủy trên database người dùng.

`pnpm db:generate` sinh migration; `pnpm db:migrate` áp migration lên database được cấu hình; `pnpm db:studio` mở trình quản lý. Các lệnh seed, import, backfill và cleanup có thể ghi hoặc xóa dữ liệu: đọc lệnh và xác nhận đích trước khi chạy. Không lưu ảnh chụp số lượng dữ liệu local thành hiện trạng cố định trong tài liệu.
