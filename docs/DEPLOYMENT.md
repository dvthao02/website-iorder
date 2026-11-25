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

## Website trên Cloudflare Workers (đã thử, không dùng)

Ngày 25/11/2026 website được đưa lên Cloudflare Workers qua OpenNext (`apps/website/wrangler.jsonc`, Worker `website-iorder-v2`); `BACKEND_URL` trỏ `api.iorder.com.vn`, tức Backend trên máy chạy Docker, qua Cloudflare Tunnel. Đo trên Worker thật bằng `wrangler tail website-iorder-v2 --format json`, các lý do không dùng:

- **Gói Free không đủ CPU.** Giới hạn 10 ms mỗi request, trong khi trang chủ cần khoảng 60–140 ms (khởi động nguội ~470 ms). Khoảng 20% request trả 503 (lỗi 1102, `exceededCpu` ở đúng mốc 10 ms). Request bị cắt giữa chừng còn để isolate nạp dở module nên các request sau trả 500 (`ComponentMod.handler is not a function`, `AppRouteRouteModule is not a constructor`). Cần gói Workers Paid (5 USD/tháng, 30 giây CPU mỗi request); không sửa được bằng mã. Gói Free còn giới hạn 100.000 request/ngày và 50 subrequest mỗi request.
- **Ảnh trả 404.** OpenNext chỉ đọc URL tương đối của `/_next/image` từ binding ASSETS, còn `/media` là rewrite sang Backend, nên mọi ảnh qua `/_next/image` đều 404. Cách đã thử là `images.unoptimized: true` (ảnh phục vụ nguyên bản, mất AVIF/WebP), không giữ lại trong mã. Cách còn lại là Cloudflare Images (Transformations chưa bật: `/cdn-cgi/image/...` trả 404).
- **Không có Caddy.** `/stats/*` (Umami) chỉ được rewrite khi lúc build có `UMAMI_URL` truy cập được từ Internet; thiếu thì `/stats/script.js` trả 404 và không có thống kê.
- **Không có cache dữ liệu.** OpenNext chạy không cấu hình incremental cache nên `revalidate` và `revalidateTag` vô hiệu, mỗi lượt xem trang gọi Backend khoảng 10 lần qua Tunnel (~450 ms mỗi trang, so với ~120 ms ở container Docker).
- **Xem trước trong CMS** hiện trang 404 trong khung xem trước khi website là Worker (`/cms-preview` vẫn nhận token; lỗi nằm ở bước sau, chưa tìm nguyên nhân).

Mã cho Worker vẫn còn trong repo: `wrangler.jsonc`, `open-next.config.ts`, các script `*:cloudflare` và tiêu đề `x-iorder-origin-secret` (Worker gửi cho Backend để lượt đọc công khai không bị gom vào một hạn mức theo IP Cloudflare). Nếu không dùng Worker nữa, ngắt kết nối Git của Worker để mỗi lần đẩy lên `main` không build vô ích. Website cần chạy cùng nơi luôn bật với Backend, database và ảnh: xem [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md).

## Cách tạm: Cloudflare Tunnel về Docker máy phát triển

Từ 25/11/2026 `iorder.com.vn` được publish bằng container `website` trên máy chạy Docker, qua tunnel `iorder-desktop` (container `iorder-cloudflared` cùng mạng `iorder_default`). Route trong Tunnel: `iorder.com.vn` → `http://website:3000`, `cms.iorder.com.vn` → `http://admin:3000`. Route `api.iorder.com.vn` → `http://api:3000` chỉ phục vụ bản Worker cũ; không có mã nào khác dùng nó (CMS và website gọi Backend nội bộ qua `BACKEND_URL=http://api:3000`), nên nên xóa để không mở API ra Internet.

Kiểm sau khi đổi route: 30 lượt tải trang chủ không lỗi (trung bình 0,32 giây đo từ máy phát triển), `/_next/image` trả AVIF, `/stats/script.js`, `/media/...`, sitemap, feed, `llms.txt`, manifest đều 200, `?lang=en` ghi cookie `iorder_lang`, biểu mẫu liên hệ bị giới hạn theo IP khách thật (lượt thứ 20 trong một phút trả 429).

Hạn chế:

- **Chỉ chạy khi máy mở và Docker đang chạy.** Máy tắt thì khách thấy lỗi 1033 của Cloudflare. Đây là cách tạm; publish thật cần VPS ([DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md)).
- **Docker/máy khởi động lại phải kéo cả db lên theo.** Ngày 25/11/2026 Docker Desktop khởi động lại, container `db` thoát mã 255 và không tự chạy lại (chỉ `cloudflared` và `umami` có `restart`), trong khi `api`/`website`/`admin` được bật lại bằng tay. Mỗi truy vấn của Backend phải chờ phân giải tên `db` thất bại (~4 giây, chỉ ~2 lượt song song), nên hàng đợi dồn thành nhiều phút: website báo `TypeError: fetch failed` / `UND_ERR_HEADERS_TIMEOUT` (Next bỏ `signal` khi làm mới nền một mục cache đã cũ nên timeout 10 giây trong `backend.ts` không áp dụng, còn undici đợi 5 phút) và Umami lặp lại khởi động. Từ 26/11/2026 `apps/website/src/lib/fetch-timeout.ts` (gắn trong `instrumentation.ts`, chạy trước khi Next vá fetch) giới hạn 10 giây cho mọi fetch không có `signal`; đã kiểm bằng bản build thật với Backend giả treo sau khi cache cũ: lượt làm mới nền báo `TimeoutError` sau ~10 giây, còn image chưa có bản vá vẫn báo `UND_ERR_HEADERS_TIMEOUT` sau 300 giây (cần build lại container `website` để áp dụng). `compose.yaml` nay đặt `restart: unless-stopped` cho `db`, `storage`, `api`, `admin`, `website` và `api` phụ thuộc `db` khỏe; container đang chạy được áp dụng bằng `docker update --restart unless-stopped`. Gặp lại lỗi này thì chạy `docker ps -a` xem `iorder-db-1` có đang `Exited` không rồi `docker start iorder-db-1`; không cần dựng lại hay xóa volume.
- **Tiêu đề bảo mật do ứng dụng gửi, không phải Caddy.** `next.config.ts` (`securityHeaders`, `pageHeaders`) đặt `Strict-Transport-Security`, `Permissions-Policy`, `X-Content-Type-Options`, và với mọi trang trừ `/cms-preview` thêm `X-Frame-Options: DENY`, `Referrer-Policy`, CSP nền; giá trị giống `Caddyfile`. `/cms-preview` không bị chặn khung vì phải nhúng được vào CMS (`src/proxy.ts` tự đặt `frame-ancestors`). Đã kiểm trên bản build riêng; chỉ có hiệu lực trên site thật sau khi build lại container `website`. Phản hồi rewrite sang Backend/Umami (`/media/*`, `/stats/*`) mang tiêu đề của nguồn, không có nhóm này.
- `/api/internal/*` trả 401 (có chữ ký HMAC bảo vệ) thay vì 404 như Caddy.
- Xem trước trong CMS: khi website là Worker khung xem trước hiện 404; chưa thử lại sau khi chuyển sang Docker.

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
- `pnpm db:cleanup-login-throttles` và `pnpm db:cleanup-sessions` có thể lên lịch sau khi xác định môi trường. `pnpm db:cleanup-media` là thao tác dọn dữ liệu, chỉ chạy khi đã chốt chính sách và kiểm tra tham chiếu. `pnpm db:cleanup-revisions` (mặc định chỉ đếm, `--apply` mới xóa) rút lịch sử phiên bản về N bản mới nhất mỗi nội dung.
- Khi báo lỗi, lấy mã request từ phản hồi và đối chiếu log theo mã. Không đưa mật khẩu, token, khóa API hay dữ liệu liên hệ vào log, issue hoặc tài liệu.
- Trước khi đặt CDN/proxy ngoài Caddy, cấu hình nguồn proxy tin cậy và kiểm tra IP client, rate limit và TLS theo topology thực tế.
