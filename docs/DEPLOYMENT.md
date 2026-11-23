# Chạy, sao lưu và triển khai

## Local

Chuẩn bị `.env` từ `.env.example` và cấu hình giá trị phù hợp; không đưa tệp thật vào Git. Có hai cách chạy:

1. **Cả hệ thống bằng Docker:** `docker compose up -d --build`. Compose chạy migration và đảm bảo tài khoản quản trị trước khi khởi động API, CMS và website. Nội dung mẫu chỉ được nạp khi chủ động dùng profile `bootstrap`.
2. **Phát triển ứng dụng trên host:** `docker compose up -d db storage`, sau đó mở ba terminal chạy `pnpm dev:api`, `pnpm dev:admin`, `pnpm dev`. Windows có `pnpm dev:all`; script không tự migrate hoặc seed. `-Analytics` thêm Umami, `-NoDocker` dùng dịch vụ đã chạy.

Website: `http://localhost:3000`; CMS: `http://localhost:3001`; API: `http://localhost:3002`. PostgreSQL và SeaweedFS (S3) local chỉ mở loopback. `pnpm dev:stop` kết thúc mọi tiến trình đang giữ cổng 3000–3002, kể cả ứng dụng khác: kiểm tra trước khi dùng. Dừng Compose không xóa named volume; đổi tên project/volume có thể khiến dữ liệu cũ không còn được gắn vào stack mới.

Trước khi chạy migration trên database có dữ liệu, xem SQL, chuẩn bị bản sao và thử trên môi trường riêng. Không chạy seed, import, backfill hoặc lệnh dọn dữ liệu chỉ để khởi động hằng ngày. Nếu database mới chưa có bảng, cần migration; nội dung nền là bước khởi tạo riêng có chủ đích.

## Production

1. Trỏ ba domain website, CMS và thống kê tới VPS, mở cổng 80/443. Chuẩn bị `.env.production` từ `.env.production.example`, thay mọi giá trị mẫu và giới hạn quyền đọc tệp. Tên biến, không phải giá trị, nằm trong tệp mẫu.
2. Kiểm tra cấu hình, dung lượng và bản sao lưu; chạy `docker compose --env-file .env.production -f compose.production.yaml up -d --build`. Theo dõi `docker compose --env-file .env.production -f compose.production.yaml ps` và log của `migrate`, `seed-admin`, `api`. Các job migration và tài khoản quản trị chạy trước ứng dụng.
3. Chỉ nạp dữ liệu nền sau khi xác nhận đúng database và bảng đích còn trống. `scripts/data/base-content.sql` không chứa object media: phải chuyển và đối soát tệp riêng. Không chạy `scripts/purge-history.sh` như một bước cài đặt.
4. Kiểm tra TLS/domain, đăng nhập, trang công khai, upload và đọc media, nội dung được làm mới sau khi lưu. Nếu dùng Umami, đổi mật khẩu quản trị mặc định ngay và cấu hình website ID/API key; nếu chưa cấu hình, thống kê không hoạt động.

Trước mỗi cập nhật, xem migration và khả năng quay lui, tạo bản sao đã kiểm tra và lưu ngoài máy. Sau cập nhật kiểm tra health, log và nghiệp vụ quan trọng. Trên môi trường thật cần tự xác minh quy trình và thông số RAM; kết quả local không thay thế nghiệm thu VPS.

## Sao lưu và phục hồi

Windows: `pnpm backup:local`; VPS: `scripts/backup.sh`. Mặc định sao lưu database, thử phục hồi vào database tạm có tên riêng, sao lưu media và giữ các bản gần nhất. Không tắt bước thử phục hồi trừ khi hiểu rõ giới hạn của bản sao. Lưu thêm bản sao ngoài máy chủ và kiểm tra checksum định kỳ. Khóa chủ giải mã cấu hình bảo mật nằm ngoài database; cần bảo vệ và sao lưu nó riêng.

Media được đối soát theo ETag của S3 và sổ `.iorder-media-manifest.json` trong thư mục media (không xóa, không sửa tay; mất hoặc hỏng thì lần sau tự dựng lại): object đổi nội dung dù cùng kích thước vẫn được tải lại, tệp không tải được hay sai checksum bị ghi lỗi mà không chặn các tệp còn lại (script thoát mã 1). Sổ giúp lượt thường chỉ so kích thước và ETag mà không đọc lại cả thư mục; để băm lại toàn bộ tệp trên đĩa và bắt tệp hỏng, chạy `node scripts/backup-media.mjs backup <thư-mục> --verify` (Windows: `scripts/backup.ps1 -VerifyMedia`; VPS: `BACKUP_MEDIA_VERIFY=1 scripts/backup.sh`). Chỉ object có ETag là MD5 (tải lên một lần) mới băm được; object multipart/mã hóa phía máy chủ chỉ đối soát kích thước và ETag.

Khôi phục database ghi đè dữ liệu hiện tại. Trước khi thao tác, xác định môi trường và bản cần dùng, sao lưu hiện trạng, kiểm tra checksum, thử `pg_restore` vào database tạm và chuẩn bị đường quay lui. Dừng các ứng dụng đang ghi. Chỉ phục hồi media nếu phạm vi yêu cầu gồm media; cơ chế restore media bổ sung object thiếu, object đã có nhưng khác nội dung bản sao lưu chỉ được báo (`--overwrite` mới ghi đè). Sau đó kiểm tra trạng thái dịch vụ, đăng nhập, nội dung và ảnh.

CMS local cung cấp cho Super Admin (màn Sao lưu & phục hồi; vai trò chỉ xem chỉ thấy lịch sử): sao lưu ngay, bật/tắt lịch 21:00, danh sách bản đang nằm trên máy, **phục hồi**, **tải về** (gói .zip gồm `.dump` và `SHA256SUMS`, đã kiểm checksum, không gồm media; ghi Nhật ký), **xóa tay** từng bản (gõ chữ xác nhận; không xóa được bản dùng được cuối cùng), chỉnh **số bản giữ lại** (3–60, mặc định 14; lưu ở `site_settings` khóa `system.backup.keep`, cả `backup.ps1` và `backup.sh` chạy theo lịch đọc cùng giá trị; tham số `-Keep` hoặc biến `BACKUP_KEEP` thắng) và **xóa lịch sử** 30 dòng ở màn này (chỉ xóa danh sách, không đổi tình trạng "lần sao lưu gần nhất"; ghi Nhật ký). Mọi thao tác ghi `backup.*` vào Nhật ký hoạt động. Dọn bản cũ chỉ tính thư mục đúng dạng mã thời gian `20261122T100000Z`; mục lạ trong thư mục `db` không bị tính hay bị xóa.

**Nhập bản sao lưu từ nơi khác:** chép thư mục (có `.dump` và `SHA256SUMS`, giải nén từ gói .zip đã tải) vào `<thư-mục-sao-lưu>/db/` với tên đúng dạng mã thời gian; bấm Quét lại thì bản hiện trong danh sách. Không có đường tải tệp lên qua web: bản sao lưu chạy lệnh SQL bằng quyền cao nhất của database, nên chỉ ai chép được vào máy chủ mới đưa được bản vào. Bản chép mang tên database khác vẫn dùng được (nhận tệp `.dump` duy nhất không phải Umami); bản có nhiều migration hơn mã đang chạy (so với `drizzle/meta/_journal.json`) bị từ chối. Bản chép vào chịu cùng quy tắc giữ lại như bản khác, nên bản cũ nhất có thể bị dọn ở lần sao lưu sau.

Phục hồi theo thứ tự: kiểm tra `SHA256SUMS` của bản chọn (thiếu hoặc lệch thì dừng), tự sao lưu hiện trạng, nạp bản chọn vào database tạm và đếm dữ liệu, đưa lại media còn thiếu, rồi chặn kết nối, đổi tên database tạm thành database thật (database cũ được đổi tên sang một bên và chỉ xóa sau khi mọi thứ xong). Phiên đăng nhập còn hạn của chính người bấm được đưa sang bản phục hồi (nếu tài khoản còn hoạt động ở đó; không thì phải đăng nhập lại), cùng lịch sử sao lưu và số bản giữ lại. Lỗi trước hoặc trong lúc đổi tên không làm mất dữ liệu cũ; thời gian ngừng nhận kết nối chỉ là vài lệnh `ALTER DATABASE`, không kéo dài suốt `pg_restore`. Sao lưu/phục hồi từ CMS cũng dừng nếu `backup.ps1` (lịch 21:00 hoặc `pnpm backup:local`) đang giữ `.lock` trong thư mục sao lưu. Khi dùng VPS, theo hướng dẫn thủ công trong màn Sao lưu & phục hồi và kiểm tra chính xác lệnh/đường dẫn trước khi chạy. Không chạy restore trên dữ liệu thật để thử tính năng.

Với VPS, sau khi hoàn tất các bước xác minh và dừng ứng dụng, lệnh sau **xóa và tạo lại database đích**. Thay đường dẫn dump bằng bản đã xác minh, không giữ nguyên chữ mẫu:

```sh
docker compose --env-file .env.production -f compose.production.yaml stop api admin website
docker compose --env-file .env.production -f compose.production.yaml exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB" && pg_restore -U "$POSTGRES_USER" --no-owner --exit-on-error -d "$POSTGRES_DB"' < DUONG_DAN_DUMP
```

Nếu cần phục hồi media, chạy service `backup-media` với thư mục media của bản sao lưu được gắn vào `/backup/media`, dùng `node scripts/backup-media.mjs restore /backup/media`; kiểm tra đúng bucket và đường dẫn trước. Khởi động lại stack và kiểm tra kết quả. Giữ bản sao an toàn cho đến khi hoàn tất nghiệm thu.

## Vận hành thường xuyên

- Lên lịch sao lưu, kiểm tra bản sao ngoài máy và diễn tập phục hồi. Kiểm tra trạng thái sao lưu trong CMS; trạng thái lưu trong chính database không thay thế bản sao ngoài máy.
- `pnpm db:cleanup-login-throttles` và `pnpm db:cleanup-sessions` có thể lên lịch sau khi xác định môi trường. `pnpm db:cleanup-media` là thao tác dọn dữ liệu, chỉ chạy khi đã chốt chính sách và kiểm tra tham chiếu.
- Khi báo lỗi, lấy mã request từ phản hồi và đối chiếu log theo mã. Không đưa mật khẩu, token, khóa API hay dữ liệu liên hệ vào log, issue hoặc tài liệu.
- Trước khi đặt CDN/proxy ngoài Caddy, cấu hình nguồn proxy tin cậy và kiểm tra IP client, rate limit và TLS theo topology thực tế.
