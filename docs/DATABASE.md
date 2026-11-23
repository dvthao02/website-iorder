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
| Sản phẩm | `offerings`, `offering_revisions` | Phần mềm và giải pháp (gồm tư vấn, phát triển theo yêu cầu) phân biệt bằng `type`; nội dung biến thiên nằm trong JSONB. |
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

Toàn bộ schema nằm trong **một** migration `drizzle/0000_initial_schema.sql`: kiểu enum, bảng, chỉ mục và khóa ngoại (đã gộp từ 30 migration cũ ngày 23/11/2026; kết quả trên database trống giống hệt chuỗi cũ về cột, ràng buộc, khóa ngoại, chỉ mục và enum). Migration không chứa dữ liệu: tài khoản quản trị do `pnpm db:seed:admin` tạo, nội dung nền nạp riêng từ `scripts/data/base-content.sql`. Database đã dựng từ chuỗi cũ chỉ cần bảng `drizzle.__drizzle_migrations` còn đúng một dòng ứng với tệp này (dòng đó mang mốc thời gian `when` của `drizzle/meta/_journal.json`, nên `pnpm db:migrate` không chạy lại). Bản sao lưu tạo trước ngày gộp mang 30 dòng migration nên CMS từ chối phục hồi (nhiều hơn mã đang chạy); muốn dùng lại phải checkout commit trước khi gộp. `pnpm db:check` kiểm tra metadata migration, không xác nhận migration đã chạy trên database cụ thể. Khi thay schema: rà dữ liệu cũ và tính tương thích, sinh/kiểm SQL, thử áp và kiểm tra dữ liệu trên database tạm, chuẩn bị sao lưu và phương án quay lui. Không tự chạy migration hay backfill phá hủy trên database người dùng.

Migration mới: sửa schema rồi `pnpm db:generate` (thêm tệp `0001_…` sau tệp khởi tạo); migration chỉ chuyển đổi dữ liệu thì `pnpm exec drizzle-kit generate --custom --name=<tên>` rồi viết SQL.

### Mẫu migration đổi liên kết đã lưu

Khi đổi hoặc gộp URL public, liên kết đã lưu trong dữ liệu phải đổi theo cùng migration. Mẫu dưới đây khớp theo tiền tố đoạn đường dẫn (kèm `/con`, `?query`, `#neo`), giữ nguyên nguồn của chuyển hướng (đó là URL cũ cần chuyển hướng) và lịch sử phiên bản (`*_revisions`), chạy lại không đổi thêm gì. Thay `/duong-dan-cu` và `/duong-dan-moi`; thêm bảng hoặc cột lưu liên kết nội bộ mới thì thêm vào ba danh sách (và vào `rewriteInternalLinks` ở `packages/shared/src/server/redirects/redirect-links.ts`). Thêm một dòng ở `legacyPaths` (`packages/shared/src/server/shared/legacy-paths.ts`) để website chuyển 301 URL cũ.

```sql
DO $$
DECLARE
  target text[];
  starts_with text := '^/duong-dan-cu([/#?]|$)';
BEGIN
  -- Cột chữ: đường dẫn đứng đầu giá trị.
  FOREACH target SLICE 1 IN ARRAY ARRAY[['menu_items', 'url'], ['redirects', 'destination_path'], ['posts', 'cta_url']] LOOP
    EXECUTE format('UPDATE %1$I SET %2$I = regexp_replace(%2$I, %3$L, %4$L) WHERE %2$I ~ %3$L', target[1], target[2], starts_with, '/duong-dan-moi\1');
  END LOOP;
  -- Canonical URL: giữ nguyên tên miền, chỉ đổi phần đường dẫn.
  FOREACH target SLICE 1 IN ARRAY ARRAY[['pages', 'canonical_url'], ['posts', 'canonical_url'], ['offerings', 'canonical_url'], ['sales_equipment', 'canonical_url']] LOOP
    EXECUTE format('UPDATE %1$I SET %2$I = regexp_replace(%2$I, %3$L, %4$L) WHERE %2$I ~ %3$L', target[1], target[2], '^(https?://[^/]+)/duong-dan-cu([/#?]|$)', '\1/duong-dan-moi\2');
  END LOOP;
  -- Cột JSON: chuỗi bắt đầu bằng đường dẫn, kết thúc ở / # ? hoặc dấu nháy đóng.
  FOREACH target SLICE 1 IN ARRAY ARRAY[['page_blocks', 'data'], ['posts', 'content'], ['offerings', 'content'], ['sales_equipment', 'blocks'], ['sales_equipment', 'page_layout']] LOOP
    EXECUTE format('UPDATE %1$I SET %2$I = regexp_replace(%2$I::text, %3$L, %4$L, ''g'')::jsonb WHERE %2$I::text ~ %3$L', target[1], target[2], '"/duong-dan-cu([/#?"])', '"/duong-dan-moi\1');
  END LOOP;
  -- Cài đặt website, trừ khóa hệ thống (lịch sử sao lưu, trạng thái chạy nền).
  UPDATE site_settings SET value = regexp_replace(value::text, '"/duong-dan-cu([/#?"])', '"/duong-dan-moi\1', 'g')::jsonb
    WHERE key NOT LIKE 'system.%' AND value::text ~ '"/duong-dan-cu([/#?"])';
END
$$;
```

`pnpm db:generate` sinh migration; `pnpm db:migrate` áp migration lên database được cấu hình; `pnpm db:studio` mở trình quản lý. Các lệnh seed, import, backfill và cleanup có thể ghi hoặc xóa dữ liệu: đọc lệnh và xác nhận đích trước khi chạy. Không lưu ảnh chụp số lượng dữ liệu local thành hiện trạng cố định trong tài liệu.
