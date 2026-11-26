# iOrder V2 — Hướng dẫn triển khai production

Tài liệu cho người cài đặt và vận hành hệ thống trên VPS. Toàn bộ hệ thống chạy bằng Docker Compose (`compose.production.yaml`). Kho Git này chỉ chứa những gì cần để build và chạy production.

## 1. Hệ thống gồm những gì

| Dịch vụ | Vai trò | Địa chỉ |
|---|---|---|
| `website` | Website công khai | `https://iorder.vn` |
| `admin` | CMS quản trị | `https://cms.iorder.vn` |
| `api` | Backend, chỉ nó được nói chuyện với database và S3 | nội bộ |
| `db` | PostgreSQL 17 (database `iorder_v2` và `umami`) | nội bộ |
| `s3` | SeaweedFS, lưu ảnh và tệp tải lên | nội bộ |
| `umami` | Thống kê truy cập | `https://stats.iorder.vn` |
| `proxy` | Caddy: tự cấp HTTPS, chia request theo tên miền | cổng 80, 443 |

Hai điều cần nhớ:

- **Git chỉ có mã nguồn.** Nội dung (database) và ảnh (S3) không nằm trong Git. Build Docker từ Git cho ra một website trống; phải nạp dữ liệu riêng (mục 4).
- **Tên miền nằm trong `.env.production`**, không nằm trong mã. Ba tên miền ở bảng trên là giá trị dự kiến; đổi ở `SITE_ADDRESS`, `ADMIN_SITE_ADDRESS`, `ANALYTICS_SITE_ADDRESS` **trước lần build đầu**, vì địa chỉ website được nhúng vào image CMS lúc build.

## 2. Chuẩn bị

- VPS Ubuntu 22.04 hoặc 24.04, RAM từ 4 GB (2 GB thì thêm swap 2 GB), ổ đĩa từ 40 GB. Build ba ứng dụng Next.js tốn nhiều RAM.
- Cài Docker Engine, plugin Docker Compose và git. Mở cổng 80 và 443 (nếu dùng `ufw`: cho phép 22, 80, 443, chặn phần còn lại).
- **Trỏ DNS trước khi chạy lần đầu**, cả ba tên miền về IP VPS (bản ghi A). Caddy cần DNS đúng để cấp TLS. Compose bắt buộc có đủ ba tên miền, kể cả khi chưa dùng Umami.
  - Nếu tên miền nằm ở Cloudflare, để các bản ghi này ở chế độ **DNS only** (đám mây xám) lúc cấp TLS lần đầu.
  - Nếu có `www`, `Caddyfile` chưa xử lý nó: thêm khối chuyển hướng riêng.
- Quyền đọc kho: dùng **Deploy Token** (`read_repository`) hoặc Deploy Key của GitLab, không dùng token cá nhân.

## 3. Cài đặt lần đầu

### 3.1 Lấy mã nguồn

```sh
git clone -b <tên-nhánh> --single-branch <URL-repo> /srv/iorder
cd /srv/iorder
```

### 3.2 Tạo `.env.production`

Tệp này chứa mật khẩu database, khóa S3 và các khóa bí mật. **Không đưa lên GitHub hay nơi công khai.** Chủ dự án đã chủ động đưa `.env.production` vào nhánh GitLab này (chỉ có ở GitLab, không có ở GitHub), nên sau khi clone tệp đã nằm sẵn ở thư mục gốc: chỉ cần khóa quyền.

```sh
chmod 600 .env.production
```

Chỉ sửa tệp này ở một nơi (máy phát triển, rồi phát hành lại lên GitLab). Sửa tay trên VPS thì lần `git pull` sau có thể báo xung đột ở đúng tệp này.

Nếu tệp không có hoặc cần tạo lại:

Cách 1: chép từ máy phát triển sang VPS rồi khóa quyền.

```sh
scp .env.production <user>@<vps>:/srv/iorder/
chmod 600 .env.production
```

Cách 2: sinh mới ngay trên VPS (cần Node 20+; khóa không rời khỏi máy này).

```sh
node scripts/generate-env-production.mjs --site iorder.vn --admin cms.iorder.vn --stats stats.iorder.vn
```

Script điền tên miền, sinh ngẫu nhiên mọi khóa bí mật đúng độ dài và không in giá trị ra màn hình. Nếu VPS không có Node, chạy qua Docker rồi đổi chủ tệp (cách này chưa được thử):

```sh
docker run --rm -v "$PWD":/app -w /app node:22-alpine node scripts/generate-env-production.mjs --site iorder.vn --admin cms.iorder.vn --stats stats.iorder.vn
sudo chown "$USER": .env.production
```

Lưu ý quan trọng:

- Mật khẩu PostgreSQL và khóa S3 bị ghi cứng vào volume ở lần chạy đầu. **Lưu `.env.production` vào trình quản lý mật khẩu**; mất tệp là gặp rắc rối.
- Đừng chạy lại script với `--force` sau khi hệ thống đã chạy, trừ khi kèm `--from <tệp-cũ>` để giữ nguyên các giá trị đã có.
- Để trống cũng được: `UMAMI_WEBSITE_ID`, `UMAMI_API_KEY`, `SECRETS_MASTER_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `SEARCH_CONSOLE_PROPERTY`, `INDEXNOW_KEY`. Điền sau (mục 5).
- `INITIAL_ADMIN_USERNAME` và `INITIAL_ADMIN_PASSWORD` chỉ dùng cho tài khoản quản trị đầu tiên của hệ thống mới. Sau khi nạp dữ liệu (mục 4), bạn đăng nhập bằng tài khoản của bản gốc.

### 3.3 Build và chạy

```sh
APP_COMMIT=$(git rev-parse --short HEAD) docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

Lần build đầu mất vài phút. Migration database và tạo tài khoản admin tự chạy trước các ứng dụng. Kiểm tra:

```sh
docker compose --env-file .env.production -f compose.production.yaml ps
```

Mọi dịch vụ phải `healthy`; hai job `migrate` và `seed-admin` ở trạng thái `Exited (0)`. Nếu lỗi:

```sh
docker compose --env-file .env.production -f compose.production.yaml logs migrate seed-admin api
```

Để gõ ngắn hơn, đặt `alias dc='docker compose --env-file .env.production -f compose.production.yaml'` (các lệnh dưới đây dùng đầy đủ).

## 4. Nạp nội dung và ảnh

Chỉ làm khi hệ thống mới vừa lên và **chưa có dữ liệu thật**.

**Tạo gói chuyển** ở nơi đang có dữ liệu:

- Máy Windows phát triển: `powershell -ExecutionPolicy Bypass -File scripts/backup.ps1 -BackupDir D:\iorder-transfer`. Script này chỉ chạy được trên máy đang có stack Docker local (cần `compose.yaml` và `.env` của máy đó, cả hai không nằm trong Git) và cần container `db`, `storage` đang chạy.
- Hoặc từ một VPS khác: `scripts/backup.sh`.

Gói có dạng `<gói>/db/<mã-thời-gian>/{<tên-db>.dump, umami.dump, SHA256SUMS}` và `<gói>/media/`. Gói chứa dữ liệu khách hàng: chép trực tiếp, không đưa lên Git.

**Chép gói sang VPS** rồi nạp bằng một lệnh:

```sh
scp -r D:\iorder-transfer <user>@<vps>:/srv/iorder-transfer
CONFIRM=yes bash scripts/restore-package.sh /srv/iorder-transfer
```

Script làm lần lượt: kiểm checksum, bật `db` và `s3`, kiểm tra database đích còn trống, dừng ứng dụng, phục hồi database, đưa media lên S3, khởi động lại (migration còn thiếu tự áp), rồi đọc thử từng ảnh và tệp còn dùng qua Backend. Cuối cùng nó báo `Đọc được N/N tệp` hoặc liệt kê tệp lỗi.

Biến tùy chọn: `STAMP` (chọn bản trong gói; mặc định bản mới nhất), `WITH_UMAMI=1` (nạp cả thống kê Umami; khi đó `UMAMI_WEBSITE_ID` và `UMAMI_API_KEY` phải là giá trị của bản gốc), `FORCE=1` (bỏ kiểm tra "database đích còn trống").

**Nó ghi đè database đích.** Mặc định script từ chối nếu database đã có trang, bài viết hoặc media. Không dùng `FORCE=1` trên hệ thống đang chạy thật.

## 5. Việc phải làm sau khi nạp dữ liệu

Đăng nhập CMS (`https://cms.iorder.vn/admin`) bằng tài khoản của bản gốc.

| Việc | Ở đâu |
|---|---|
| Đổi **Địa chỉ website chính thức** sang `https://iorder.vn` | Cài đặt website → Tên miền & SEO |
| Đổi ô canonical của trang chủ nếu còn là tên miền cũ | Nội dung website → Trang chủ, phần SEO |
| Sửa nút kêu gọi hành động của các bài còn trỏ tên miền cũ: `chuoi-ca-phe-quan-ly-10-chi-nhanh`, `giam-thoi-gian-cho-mon-gio-cao-diem`, `huong-dan-cai-dat-may-in-hoa-don`, `thong-bao-lich-bao-tri-he-thong` | Nội dung website → Bài viết & Tin tức (bài hướng dẫn: Hướng dẫn sử dụng) |
| Tạo **khóa chủ** (khóa này không nằm trong gói chuyển), rồi nhập lại khóa API đã lưu | Hệ thống → Kết nối & khóa API |
| Kết nối lại Gmail với địa chỉ CMS mới; thêm địa chỉ gọi lại `https://cms.iorder.vn/...` trong Google Cloud Console | Hệ thống → Gmail báo liên hệ |
| Kết nối Google Search Console với tài sản `iorder.vn` | Công việc → Google Search Console |
| Kiểm tra không còn lỗi, đúng mã phiên bản (`APP_COMMIT`) | Hệ thống → Tình trạng hệ thống |

Nếu đổi từ tên miền cũ (ví dụ `iorder.com.vn`) sang `iorder.vn`: chuyển hướng 301 tên miền cũ sang tên miền mới (Redirect Rule của Cloudflare là gọn nhất, hoặc thêm khối `redir` vào `Caddyfile`) để link cũ không gãy và không trùng nội dung.

Nếu dùng Umami: đăng nhập `https://stats.iorder.vn` bằng mật khẩu mặc định của Umami và **đổi ngay**, tạo website, điền `UMAMI_WEBSITE_ID` và `UMAMI_API_KEY` vào `.env.production`, rồi chạy lại lệnh `up -d` ở mục 3.3.

## 6. Nghiệm thu

- `https://iorder.vn` và `https://cms.iorder.vn` mở được, TLS hợp lệ, không cảnh báo.
- Trang có ảnh hiển thị đủ; thử mở một ảnh trực tiếp dạng `https://iorder.vn/media/uploads/<tên-tệp>`.
- CMS: tải lên một ảnh rồi mở lại; sửa một nội dung và xuất bản, website cập nhật.
- Gửi thử biểu mẫu liên hệ; khách hàng tiềm năng hiện ở CMS.
- Xem `https://iorder.vn/sitemap.xml` và `https://iorder.vn/robots.txt`: địa chỉ phải là `iorder.vn`.

## 7. Cập nhật phiên bản

1. Xem migration mới (`drizzle/`), tạo bản sao lưu đã kiểm tra và chép ra ngoài máy chủ.
2. `git pull`, rồi chạy lại lệnh `up -d --build` ở mục 3.3.
3. Kiểm tra `ps`, log và vài nghiệp vụ chính.
4. `docker builder prune -f` để giải phóng bộ nhớ đệm build.

Muốn quay lại bản trước: `git checkout <mã-commit-cũ>` rồi chạy lại `up -d --build`. Migration đã áp không tự lùi; vì thế bước sao lưu ở trên là bắt buộc.

## 8. Sao lưu

- Chạy hằng ngày bằng cron của máy chủ:

  ```sh
  30 2 * * * cd /srv/iorder && scripts/backup.sh >> /var/log/iorder-backup.log 2>&1
  ```

  Mặc định lưu ở `/var/backups/iorder` (đổi bằng `BACKUP_DIR`), giữ 14 bản database gần nhất (đổi bằng `BACKUP_KEEP`), tự thử phục hồi vào database tạm và sao lưu media. Kết quả hiện ở CMS → Hệ thống → Tình trạng hệ thống.
- **Chép bản sao lưu ra ngoài máy chủ** và kiểm tra checksum định kỳ.
- **Khóa chủ** nằm trong volume `secrets-data`, không có trong bản sao lưu database: sao lưu riêng.
- Phục hồi database ghi đè dữ liệu hiện tại. Dừng `api`, `admin`, `website` trước, kiểm tra `SHA256SUMS` của bản dùng, rồi:

  ```sh
  docker compose --env-file .env.production -f compose.production.yaml exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB" && pg_restore -U "$POSTGRES_USER" --no-owner --exit-on-error -d "$POSTGRES_DB"' < DUONG_DAN_TOI_TEP.dump
  ```

  Thay đường dẫn bằng bản đã xác minh. Media: chạy dịch vụ `backup-media` với thư mục media của bản sao lưu gắn vào `/backup/media` và lệnh `node scripts/backup-media.mjs restore /backup/media`.

## 9. Vận hành hằng ngày

```sh
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs -f --tail=100 api
docker compose --env-file .env.production -f compose.production.yaml restart website
```

- Lỗi của Backend cũng hiện ở CMS → Hệ thống → Nhật ký lỗi.
- Giới hạn RAM mặc định: `admin` 384 MB, `website` 768 MB, `api` 384 MB. Nếu container tự khởi động lại vì thiếu bộ nhớ (`docker inspect --format '{{.State.OOMKilled}}' <container>`), tăng bằng `ADMIN_MEM_LIMIT`, `WEBSITE_MEM_LIMIT`, `API_MEM_LIMIT` (và `*_HEAP_MB`) trong `.env.production`, rồi `up -d`.
- Giới hạn số request theo IP chặn nhầm người dùng thật: đặt `RATE_LIMIT_DISABLED=1`, chạy `up -d`, xử lý xong thì bỏ đi.
- Dọn dữ liệu định kỳ (chưa thử trên VPS; đọc phần chú thích đầu mỗi script trước khi chạy): `docker compose --env-file .env.production -f compose.production.yaml run --rm migrate pnpm db:cleanup-sessions`, tương tự `db:cleanup-login-throttles`. `db:cleanup-revisions` mặc định chỉ đếm, thêm `--apply` mới xóa.

## 10. Sự cố thường gặp

| Hiện tượng | Nguyên nhân hay gặp | Xử lý |
|---|---|---|
| `docker compose up` báo `required variable ... is missing` | Thiếu biến trong `.env.production` | Điền biến được nêu tên rồi chạy lại |
| `api` không lên, `seed-admin` lỗi | Thiếu `INITIAL_ADMIN_USERNAME` hoặc `INITIAL_ADMIN_PASSWORD` | Điền rồi `up -d` |
| Build bị kill giữa chừng | Hết RAM | Thêm swap 2 GB hoặc dùng VPS lớn hơn |
| Trình duyệt báo chứng chỉ lỗi, Caddy không cấp TLS | DNS chưa trỏ đúng, cổng 80/443 bị chặn, hoặc Cloudflare đang bật proxy | Kiểm tra DNS và tường lửa; xem `logs proxy` |
| Trang hiện nhưng ảnh 404 | Media chưa được nạp | Chạy lại bước media ở mục 8 hoặc `restore-package.sh` trên hệ thống trống |
| Không đăng nhập được CMS sau khi nạp | Tài khoản đã được thay bằng tài khoản của bản gốc | Dùng tài khoản của bản gốc |
| `restore-package.sh` từ chối chạy | Database đích đã có dữ liệu | Kiểm tra đúng máy chủ; chỉ dùng `FORCE=1` khi chắc chắn |

## 11. Bảo mật

- Không đưa `.env.production` lên GitHub hay nơi công khai; trên GitLab chỉ giữ khi repo giới hạn đúng những người cần đọc. Không đưa gói sao lưu hay khóa chủ lên Git, chat hay issue.
- Nghi ngờ `.env.production` bị lộ: nếu hệ thống chưa chạy lần đầu thì sinh lại bằng script (`--force`) rồi phát hành lại. Nếu đã chạy thì xoay khóa phức tạp hơn, vì mật khẩu database và khóa S3 đã nằm trong volume.
- Đổi mật khẩu quản trị CMS sau lần đăng nhập đầu; đổi mật khẩu mặc định của Umami.
- Chỉ cổng 80 và 443 mở ra ngoài; database, S3 và Backend chỉ nằm trong mạng nội bộ của Docker.
- Chép bản sao lưu ra ngoài máy chủ và thử phục hồi định kỳ.

## 12. Cấu trúc kho

| Đường dẫn | Nội dung |
|---|---|
| `apps/website`, `apps/admin`, `apps/api` | Ba ứng dụng Next.js |
| `packages/shared` | Mã dùng chung, schema database |
| `drizzle/` | Migration SQL |
| `Dockerfile`, `compose.production.yaml`, `Caddyfile` | Build và chạy production |
| `.env.production.example` | Mẫu biến môi trường (tên biến, không có giá trị thật) |
| `.env.production` | Biến môi trường production thật; chỉ có ở nhánh GitLab, không có ở GitHub |
| `scripts/` | Chỉ các script production dùng: `generate-env-production.mjs`, `restore-package.sh`, `backup.sh`, `backup.ps1` (chỉ cho máy Windows phát triển), `backup-media.mjs`, `backup-status.sql`, `seed-admin.ts`, `cleanup-*.ts`, `data/base-content.sql` |

## 13. Đã kiểm chứng và chưa kiểm chứng

- Đã kiểm: kiểm tra kiểu (`tsc`) trên cây của kho này; `docker compose config` với `.env.production` sinh bằng script; `docker buildx build --check` cho các target của `Dockerfile`; diễn tập nạp gói chuyển trên stack Docker tạm (checksum, 40 bảng khớp số dòng, 455 tệp media, 200/200 ảnh đọc được qua Backend).
- Chưa kiểm: build đầy đủ ba ứng dụng trên VPS, cấp TLS thật, và lần nạp dữ liệu đầu tiên trên VPS. Lần chạy đầu trên VPS chính là lần thử đầy đủ; làm theo từng mục và dừng lại khi có lỗi.
