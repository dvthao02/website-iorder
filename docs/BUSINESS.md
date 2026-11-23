# Luồng nghiệp vụ và dữ liệu

Tài liệu này nối công việc của người vận hành với dữ liệu và mã nguồn. Tên module và quyền đầy đủ lấy từ `packages/shared/src/server/auth/permissions.ts`; giao diện chỉ hiện các mục tài khoản được phép xem. Danh mục dưới đây là bản đồ tra cứu, không thay cho việc kiểm tra từng luồng trên hệ thống đang triển khai.

| Nghiệp vụ | Nơi quản lý | Dữ liệu chính | Kết quả |
|---|---|---|---|
| Trang chủ, trang thường và trang hệ thống | Trang chủ, Trang website | `pages`, `page_blocks`, `page_revisions` | Website dựng trang và các khối đang bật |
| Tin tức, bài viết và hướng dẫn | Bài viết & Tin tức, Hướng dẫn sử dụng | `posts`, `post_revisions`, chuyên mục, thẻ, tác giả | Trang chi tiết và danh sách nội dung |
| Phần mềm, giải pháp (tư vấn và phát triển theo yêu cầu thuộc Giải pháp) | Sản phẩm & Giải pháp | `offerings`, `offering_revisions` | Trang danh sách và trang chi tiết theo loại |
| Thiết bị | Thiết bị và nhóm thiết bị | `sales_equipment`, `equipment_groups`, `sales_equipment_revisions` | Trang thiết bị, thông số, giá và tình trạng hàng |
| Tệp cài đặt | Tệp cài đặt | `support_downloads`, `support_download_revisions`, `media_assets` | Trang tải tệp hoặc mở liên kết ngoài |
| Đối tác và đánh giá | Đối tác & Đánh giá | `partners`, `testimonials`, `media_assets` | Các khối lấy nội dung đối tác hoặc đánh giá |
| Ảnh và tệp | Thư viện hình ảnh & tệp | `media_assets` và object trong S3 | Tệp dùng trong nội dung, có thể kiểm tra nơi sử dụng |
| Điều hướng và thiết lập | Menu, Chuyển hướng URL, Cài đặt website | `menus`, `menu_items`, `menu_revisions`, `redirects`, `site_profile`, `site_settings` | Menu, liên kết và thông tin chung của website |
| Khách hàng tiềm năng | Khách hàng tiềm năng | `contact_leads` | Nhân viên xem, xử lý trạng thái và xuất dữ liệu theo quyền |
| Người dùng và vận hành | Người dùng & vai trò, Tình trạng hệ thống, Nhật ký, Sao lưu | `users`, `roles`, `permissions`, `sessions`, `audit_logs`, cấu hình | Quản lý truy cập, theo dõi và khôi phục hệ thống |

## Một lần lưu nội dung đi qua đâu?

1. CMS gửi dữ liệu và phiên bản đang sửa đến API. Backend xác thực, kiểm tra quyền và xác thực dữ liệu đầu vào.
2. Service xử lý quy tắc nghiệp vụ; repository ghi dữ liệu, phiên bản và lịch sử phù hợp trong transaction. Nếu phiên bản không khớp, máy chủ trả 409 để tránh ghi đè thay đổi của người khác.
3. Mutation liên quan nội dung công khai gọi lớp làm mới cache của website. Website đọc dữ liệu qua Backend; ứng dụng website và CMS không kết nối trực tiếp database hoặc S3.
4. Việc một nội dung có hiện công khai còn phụ thuộc trạng thái, thời gian hẹn, cờ hiển thị và quy tắc của module. Ví dụ trang hệ thống có ràng buộc riêng về đường dẫn và không thể xóa từ CMS.

Các bảng `*_revisions` là lịch sử nội dung, còn `audit_logs` là nhật ký thao tác; chúng có mục đích khác nhau. Khối trang và một số nội dung biến thiên được lưu JSONB, với hợp đồng Zod trong `packages/shared/src/server/`. Không chỉnh JSON trực tiếp để thay thế quy trình lưu của ứng dụng.

## Quyền và vòng đời

Danh mục quyền được định nghĩa trong code, còn vai trò đã tạo và quyền gán thực tế được quản lý trong CMS. Quyền mặc định không tự chứng minh một tài khoản hiện có quyền đó. Các màn và API có thể yêu cầu quyền xem, sửa hoặc xuất bản khác nhau; không xem việc ẩn nút là cơ chế bảo mật duy nhất.

Nội dung có vòng đời dùng các trạng thái nháp, chờ duyệt, hẹn giờ, xuất bản và lưu trữ. Nội dung hẹn giờ được xét theo thời điểm hiển thị; không giả định mọi module dùng cùng bảng hay cùng cờ trạng thái. Trước khi xóa, thay đổi quyền hoặc phục hồi, kiểm tra tác động và các ràng buộc thực tế của module tương ứng.
