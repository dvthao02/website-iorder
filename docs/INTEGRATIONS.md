# Kết nối và tìm kiếm

## Thống kê Umami

Website chỉ chèn mã thống kê khi có `UMAMI_WEBSITE_ID`. Production chuyển tiếp script và sự kiện qua cùng domain website; CMS đọc số liệu qua API. Cấu hình API key và website ID ở môi trường hoặc mục Kết nối & khóa API theo quyền. Chưa kết nối hoặc dịch vụ lỗi thì kiểm tra trạng thái trong CMS và log; không suy diễn dữ liệu thiếu thành số 0 thực tế.

## Google Search Console

CMS chỉ đọc số liệu Search Analytics; tài khoản dịch vụ cần được cấp quyền cho đúng thuộc tính trong Search Console. Tạo tài khoản dịch vụ và bật API ở Google Cloud, chia sẻ thuộc tính cho email tài khoản dịch vụ, sau đó Super Admin cấu hình khóa tại **Hệ thống → Kết nối & khóa API** hoặc cấu hình máy chủ. Vào **Công việc → Google Search Console** để kiểm tra kết nối. Biến môi trường được ưu tiên khi cùng một cấu hình có ở CMS. Không đưa tệp khóa vào repository hay log.

## Gmail báo liên hệ mới

Khi khách gửi liên hệ từ website, Backend gửi thư báo từ Gmail đã kết nối tới chính Gmail đó và CC các địa chỉ trong danh sách (CMS › Kết nối & khóa API › "Gmail báo liên hệ mới", chỉ Super Admin). Kết nối bằng OAuth 2.0 (mã cấp quyền + PKCE): bấm Kết nối, nhập lại mật khẩu CMS, Google hỏi quyền, rồi CMS nhận token làm mới và cất mã hóa ở kho khóa (khóa `gmail_refresh_token`). Chỉ xin quyền gửi thư (`gmail.send`) và địa chỉ email, không đọc được hộp thư; bỏ tick quyền gửi thư ở màn Google thì kết nối bị từ chối.

Cài một lần ở Google Cloud: tạo project, bật Gmail API, màn OAuth consent loại External rồi **Publish app** (để Testing thì token hết hạn sau 7 ngày; Gmail cá nhân sẽ thấy cảnh báo "chưa xác minh" khi cấp quyền, chọn Tiếp tục), tạo OAuth client loại Web application với Authorized redirect URI `https://<tên miền CMS>/admin/integrations/gmail/callback` (thêm `http://localhost:3001/admin/integrations/gmail/callback` nếu muốn thử ở máy phát triển), rồi điền Client ID và Client secret ở thẻ "Gmail (gửi thư báo liên hệ mới)" (hoặc biến `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, biến thắng). Google chỉ nhận địa chỉ https hoặc localhost, nên phải mở CMS bằng tên miền (qua Tunnel) để kết nối, không bằng IP LAN.

Cách chạy (`packages/shared/src/server/gmail/`): chỉ liên hệ MỚI được lưu mới gửi thư (liên hệ trùng chỉ nhận mà không lưu thì không gửi); gửi ở nền, không chặn và không làm hỏng việc lưu liên hệ; tối đa 20 thư mỗi 10 phút (vượt thì bỏ qua thư, liên hệ vẫn ở hộp thư liên hệ). Không có hàng đợi nên thư lỗi không gửi lại: lỗi ghi ở trạng thái kết nối để CMS hiện; Google thu hồi quyền (`invalid_grant`) thì trạng thái thành "Cần kết nối lại". Thư là văn bản thuần gồm họ tên, số điện thoại, email, nhu cầu, lời nhắn, thiết bị hỏi mua, giờ và liên kết mở liên hệ trong CMS, tức có thông tin cá nhân của khách: chỉ CC cho người cần xử lý. Ở CMS, công tắc "Gửi thư báo khi có liên hệ mới" (`AdminSwitch`) có hiệu lực ngay khi bật/tắt, còn danh sách CC phải bấm Lưu cài đặt (công tắc chỉ gửi kèm CC đã lưu, không kéo theo địa chỉ đang nhập dở); chưa kết nối hoặc cần kết nối lại thì công tắc khóa ở trạng thái tắt. Cài đặt lưu ở `site_settings` khóa `gmail_notifications` (bật/tắt và CC, có `version`) và `gmail_connection` (tài khoản, trạng thái, lần gửi gần nhất; không có token). Ngắt kết nối thu hồi quyền ở Google và xóa token.

## Khóa kết nối

Giá trị nhập ở CMS được mã hóa trong `secure_settings`. Khóa chủ nằm ngoài database, trong biến môi trường hoặc tệp khóa của Backend. Cần bảo vệ và sao lưu khóa chủ riêng: chỉ phục hồi database mà thiếu khóa chủ sẽ không giải mã được các giá trị đã lưu. Không tạo đè khóa khi chưa xác định nguyên nhân lỗi.

## SEO và xem trước

CMS có công cụ hỗ trợ kiểm tra metadata, ảnh và từ khóa; kết quả là gợi ý, không bảo đảm thứ hạng. Website tạo sitemap, robots, RSS, `llms.txt` và dữ liệu cấu trúc theo cấu hình và nội dung công khai; không đưa số liệu hoặc đánh giá chưa xác minh vào nội dung. Khi đổi URL nội dung, kiểm tra chuyển hướng và liên kết sau khi xuất bản.

Xem trước dùng token và dữ liệu bản nháp theo quyền của nội dung. URL preview không được chia sẻ như URL công khai. Website lấy dữ liệu qua Backend; làm mới cache qua wrapper của API và cơ chế ký giữa hai ứng dụng. TTL là phương án dự phòng khi làm mới thất bại.
