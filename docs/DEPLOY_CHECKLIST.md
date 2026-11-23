# Checklist triển khai lên VPS

Bản rút gọn để làm theo lần đầu. Chi tiết, sao lưu và phục hồi: [DEPLOYMENT.md](DEPLOYMENT.md). Các bước dưới đây dựa trên cấu hình và tài liệu, chưa được thử trên VPS thật; số RAM trong compose cũng chưa đo trên VPS.

## 1. Chuẩn bị

- [ ] VPS Ubuntu 22/24, RAM từ 4 GB (2 GB thì thêm swap ~2 GB), ổ đĩa từ 40 GB.
- [ ] Cài Docker Engine, plugin Compose và git. Mở cổng 80 và 443.
- [ ] Trỏ DNS ba tên miền về IP VPS **trước khi chạy lần đầu** (Caddy cần để cấp TLS): website, `admin.` và `stats.`. Compose bắt buộc có cả ba, kể cả khi chưa dùng Umami.
- [ ] Quyết định dữ liệu ban đầu: database prod **rỗng**, website trống cho tới khi nạp. Chọn nội dung nền (`scripts/data/base-content.sql`) hoặc phục hồi bản sao lưu từ máy local. Cả hai đều không kèm media, ảnh phải chuyển riêng (mục 4).

## 2. Cấu hình

- [ ] `git clone` repo lên VPS (repo private thì dùng deploy key hoặc token), rồi `cd` vào thư mục repo.
- [ ] `cp .env.production.example .env.production && chmod 600 .env.production`
- [ ] Điền ba tên miền: `SITE_ADDRESS`, `ADMIN_SITE_ADDRESS`, `ANALYTICS_SITE_ADDRESS`.
- [ ] Đổi **mọi** giá trị mẫu. Mật khẩu mặc định trong tệp mẫu là mật khẩu đoán được. Sinh chuỗi ngẫu nhiên bằng `openssl` rồi dán vào `.env.production` (không dán vào chat, issue hay Git):

  | Biến | Cách sinh |
  |---|---|
  | `POSTGRES_PASSWORD` | `openssl rand -hex 24` (chỉ chữ và số, tránh `/ ? # :`) |
  | `LEAD_IP_HASH_SALT` | `openssl rand -hex 32` |
  | `PUBLISH_WEB_REVALIDATE_SECRET` | `openssl rand -hex 32` |
  | `S3_ACCESS_KEY_ID` | `openssl rand -hex 12` |
  | `S3_SECRET_ACCESS_KEY` | `openssl rand -hex 32` |
  | `INITIAL_ADMIN_PASSWORD` | mật khẩu dài, tự đặt (đổi lại trong CMS sau lần đăng nhập đầu) |
  | `UMAMI_APP_SECRET` | `openssl rand -hex 32` |
  | `UMAMI_TWO_FACTOR_ENCRYPTION_KEY` | `openssl rand -hex 32` (đúng 64 ký tự hex) |

- [ ] Biến còn lại (Search Console, IndexNow, khóa chủ, `UMAMI_WEBSITE_ID`, `UMAMI_API_KEY`) để trống được; điền sau.

## 3. Chạy

- [ ] `APP_COMMIT=$(git rev-parse --short HEAD) docker compose --env-file .env.production -f compose.production.yaml up -d --build`
      Lần build đầu mất vài phút. Migration và tạo tài khoản admin tự chạy trước các app.
- [ ] `docker compose --env-file .env.production -f compose.production.yaml ps`: mọi service `healthy`, hai job `migrate` và `seed-admin` đã `Exited (0)`.
- [ ] Nếu có lỗi: `docker compose --env-file .env.production -f compose.production.yaml logs migrate seed-admin api`.

## 4. Nạp dữ liệu (chỉ khi xác nhận đúng database và bảng còn trống)

- [ ] Nạp nội dung nền hoặc phục hồi bản sao lưu theo [DEPLOYMENT.md](DEPLOYMENT.md). Không chạy seed hay restore trên dữ liệu thật để thử.
- [ ] Chuyển và đối soát media bằng `backup-media` (xem DEPLOYMENT.md, mục Sao lưu và phục hồi).

## 5. Nghiệm thu

- [ ] Mở `https://<website>` và `https://admin.<website>`: có TLS hợp lệ, không cảnh báo.
- [ ] Đăng nhập CMS, **đổi mật khẩu admin ngay** (Tài khoản của tôi → Mật khẩu).
- [ ] CMS → Tình trạng hệ thống: không báo lỗi, đúng mã phiên bản (`APP_COMMIT`).
- [ ] Upload một ảnh, đọc lại ảnh đó. Sửa một nội dung rồi xuất bản: website cập nhật.
- [ ] Hệ thống → Kết nối & khóa API: Super Admin bấm **Tạo khóa chủ** (nếu chưa đặt `SECRETS_MASTER_KEY`).

## 6. Sau khi chạy ổn

- [ ] Cron sao lưu hằng ngày, ví dụ: `30 2 * * * cd /srv/iorder && scripts/backup.sh >> /var/log/iorder-backup.log 2>&1`
- [ ] Chép bản sao lưu ra **ngoài máy chủ**, và sao lưu riêng khóa chủ (volume `secrets-data`, không nằm trong sao lưu database).
- [ ] Đổi mật khẩu quản trị Umami mặc định nếu dùng thống kê, rồi điền `UMAMI_WEBSITE_ID` và `UMAMI_API_KEY` và chạy lại `up -d`.

## Cập nhật sau này

1. Xem migration mới và tạo bản sao lưu đã kiểm tra, lưu ngoài máy.
2. `git pull`, rồi chạy lại lệnh `up -d --build` ở mục 3.
3. Kiểm tra `ps`, log và nghiệp vụ quan trọng.
4. `docker builder prune -f` để giải phóng build cache.
