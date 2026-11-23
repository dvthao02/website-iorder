# Kết nối và tìm kiếm

## Thống kê Umami

Website chỉ chèn mã thống kê khi có `UMAMI_WEBSITE_ID`. Production chuyển tiếp script và sự kiện qua cùng domain website; CMS đọc số liệu qua API. Cấu hình API key và website ID ở môi trường hoặc mục Kết nối & khóa API theo quyền. Chưa kết nối hoặc dịch vụ lỗi thì kiểm tra trạng thái trong CMS và log; không suy diễn dữ liệu thiếu thành số 0 thực tế.

## Google Search Console

CMS chỉ đọc số liệu Search Analytics; tài khoản dịch vụ cần được cấp quyền cho đúng thuộc tính trong Search Console. Tạo tài khoản dịch vụ và bật API ở Google Cloud, chia sẻ thuộc tính cho email tài khoản dịch vụ, sau đó Super Admin cấu hình khóa tại **Hệ thống → Kết nối & khóa API** hoặc cấu hình máy chủ. Vào **Công việc → Google Search Console** để kiểm tra kết nối. Biến môi trường được ưu tiên khi cùng một cấu hình có ở CMS. Không đưa tệp khóa vào repository hay log.

## Khóa kết nối

Giá trị nhập ở CMS được mã hóa trong `secure_settings`. Khóa chủ nằm ngoài database, trong biến môi trường hoặc tệp khóa của Backend. Cần bảo vệ và sao lưu khóa chủ riêng: chỉ phục hồi database mà thiếu khóa chủ sẽ không giải mã được các giá trị đã lưu. Không tạo đè khóa khi chưa xác định nguyên nhân lỗi.

## SEO và xem trước

CMS có công cụ hỗ trợ kiểm tra metadata, ảnh và từ khóa; kết quả là gợi ý, không bảo đảm thứ hạng. Website tạo sitemap, robots, RSS, `llms.txt` và dữ liệu cấu trúc theo cấu hình và nội dung công khai; không đưa số liệu hoặc đánh giá chưa xác minh vào nội dung. Khi đổi URL nội dung, kiểm tra chuyển hướng và liên kết sau khi xuất bản.

Xem trước dùng token và dữ liệu bản nháp theo quyền của nội dung. URL preview không được chia sẻ như URL công khai. Website lấy dữ liệu qua Backend; làm mới cache qua wrapper của API và cơ chế ký giữa hai ứng dụng. TTL là phương án dự phòng khi làm mới thất bại.
