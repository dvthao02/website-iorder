# iOrder V2 — Tài liệu hệ thống

Tài liệu duy nhất mô tả kiến trúc, dữ liệu, bảo mật và vận hành. Hiện trạng, so sánh với CMS hiện đại và backlog nằm ở [ROADMAP.md](ROADMAP.md). Quy tắc cho agent nằm ở [AGENTS.md](../AGENTS.md).

## 1. Tổng quan

Website doanh nghiệp iOrder gồm site public và CMS quản trị nội dung. Đây là monorepo pnpm, Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Zod 4, PostgreSQL + Drizzle ORM, lưu media trên S3-compatible storage.

| App | Cổng local | Vai trò |
|---|---|---|
| `apps/publish-web` | 3000 | Website public, render phía server, đọc dữ liệu qua Backend |
| `apps/cms` | 3001 | Giao diện CMS `/admin`, gọi Backend qua rewrite `/api`, `/media` |
| `apps/backend` | 3002 | Route handlers `/api/*`, `/media/*`; app duy nhất truy cập DB và S3 |
| `packages/core` | — | Drizzle schema, contracts (Zod), services, repositories dùng chung |

V1 (`D:\work\iorderwebsite\iorder-website`) chỉ là tài liệu tham khảo hành vi/dữ liệu; không copy kiến trúc hay source V1.

```text
apps/{backend,cms,publish-web}/   ba app Next.js độc lập
packages/core/src/db/             Drizzle client + schema theo domain
packages/core/src/server/<domain> contract → service → repository
drizzle/                          migration SQL + snapshot
scripts/                          seed, import V1, fixture audit, job dọn dẹp
compose.yaml                      PostgreSQL + S3Mock cho local
compose.production.yaml           stack production
Dockerfile, Caddyfile             build standalone đa stage, TLS/reverse proxy
```

### Luồng dữ liệu

```text
Browser → Caddy → cms | publish-web ──rewrite/fetch──→ backend → service → repository → PostgreSQL
                                                          └──→ S3 (SeaweedFS)
```

- CMS và publish-web không có credential DB/S3; chỉ Backend có.
- publish-web chỉ proxy `/api/leads` và `/media/*` cho trình duyệt; dữ liệu render đọc thẳng `BACKEND_URL` từ server. API admin chỉ đi qua domain CMS.
- Mutation admin gọi `revalidatePath` (wrapper ở `apps/backend/src/lib/publish-cache-revalidation.ts`). Wrapper gom lại và gửi **một** POST HMAC tới `publish-web/api/internal/revalidate`, làm mới tag `public-content`. Data Cache public có TTL 60 giây làm dự phòng.

## 2. Mô hình dữ liệu

Quy ước:

- UUID do database sinh, mọi bảng có `created_at`/`updated_at`.
- Vòng đời nội dung: `draft → review → scheduled → published → archived`. Xóa mềm bằng `deleted_at`. Nội dung hẹn giờ tự hiện khi `published_at <= now()`, lọc ngay lúc truy vấn, không cần job.
- Revision là snapshot JSONB bất biến, không thay cho `audit_logs`. `audit_logs` chỉ ghi thêm.
- Optimistic concurrency: mutation gửi `expectedVersion`; sai version trả HTTP 409, form giữ nguyên dữ liệu. Nội dung xuất bản dùng `draft_version`; cấu hình và danh mục (`site_settings`, `site_profile`, `redirects`, `categories`, `tags`, `partners`, `testimonials`, `equipment_groups`, `menus`) dùng cột `version`, API admin nhận `{ values, expectedVersion }` (bắt buộc khi sửa). Seed/script gọi service không truyền version thì bỏ qua kiểm tra.
- Media lưu `storage_key`, không lưu URL cố định; DTO dựng URL theo môi trường.
- JSONB chỉ dùng cho cấu trúc biến thiên (block, nội dung bài, section offering, thông số thiết bị) và luôn có Zod schema.
- Giá thiết bị là `bigint price_vnd`.

| Domain | Bảng |
|---|---|
| Tài khoản & quyền | `users`, `roles` (`is_system` cho Super Admin), `permissions`, `user_roles`, `role_permissions`, `sessions`, `login_throttle_buckets` |
| Media | `media_assets` |
| Bài viết | `posts`, `post_revisions`, `categories`, `tags`, `post_categories`, `post_tags` |
| Catalog | `offerings`, `offering_revisions` (type: software/solution/service; loại `industry` đã bỏ ở migration `0011`) |
| Thiết bị | `equipment_groups`, `sales_equipment`, `sales_equipment_revisions` |
| Trang | `pages`, `page_blocks`, `page_revisions` (homepage là page `template = home`) |
| Điều hướng & cấu hình | `menus`, `menu_items`, `menu_revisions`, `site_profile`, `site_settings`, `redirects` |
| Nội dung hỗ trợ | `partners`, `testimonials`, `support_downloads`, `support_download_revisions` |
| Nghiệp vụ | `contact_leads`, `audit_logs` |

Quyết định thiết kế đáng nhớ:

- Một mô hình trang duy nhất (`pages` + `page_blocks`). `page_blocks.type` là text + Zod discriminated union, nên thêm block không cần migration.
- Header/footer/CTA đều là `menus` theo `location`.
- `redirects` chỉ nhận đường dẫn nội bộ bắt đầu bằng `/`, mã 301/308, thực thi trong `apps/publish-web/src/proxy.ts`.
- `site_settings` giữ cấu hình xuất bản và liên kết ngoài. Khi thêm key mới phải có default tương thích, và seed chỉ bổ sung key còn thiếu.
- **Mọi URL public là một Trang.** Trang hệ thống (`fixedWebsitePages` trong `pages.contract.ts`) có route do code giữ; CMS sửa nội dung, SEO, trạng thái nhưng không tạo/xóa/đổi slug. Trang danh sách (`kind: "listing"`: `/tin-tuc`, `/thiet-bi`, `/ho-tro/cai-dat`, `/phan-mem`, `/giai-phap`, `/dich-vu`) lấy phần đầu từ khối "Mở đầu" đầu tiên và SEO của trang; các khối còn lại hiển thị theo thứ tự, danh sách là khối `collection_list` (nguồn: bài viết, hướng dẫn, tệp cài đặt, thiết bị, phần mềm, giải pháp, dịch vụ) đặt được ở mọi trang. Trang danh sách thiếu khối danh sách thì route tự thêm danh sách mặc định (`defaultListingCollections`). `featured_posts`/`download_list` là loại cũ: vẫn đọc và render qua `collection_list`, CMS không cho thêm mới. Người có quyền `update`/`publish` của module sở hữu (`ownerModule`) sửa được trang danh sách của module đó. Key cũ `listing_content`/`catalog_content` chỉ còn là dự phòng tới khi chạy `pnpm db:backfill-listing-pages`.

### Quy tắc khi thêm nội dung public

| Nghiệp vụ | Nguồn dữ liệu | Route public |
|---|---|---|
| Trang, homepage, phần đầu trang danh sách | `pages`, `page_blocks` | `/`, `/trang/[slug]`, các trang tĩnh, trang danh sách |
| Catalog | `offerings` | `/phan-mem`, `/giai-phap`, `/dich-vu` |
| Thiết bị | `equipment_groups`, `sales_equipment` | `/thiet-bi` |
| Bài viết, hướng dẫn | `posts`, taxonomy | `/tin-tuc`, `/ho-tro/cai-dat` |
| Header, CTA, footer | `menus`, `site_settings` | layout public |
| Liên hệ, đối tác, đánh giá, tải về | domain tương ứng | page block, trang hỗ trợ |

- Route public mới phải có một dòng ownership ở bảng trên, kèm contract/service CMS; không dùng nội dung tĩnh làm nguồn lâu dài.
- Editor CMS dùng form nghiệp vụ, không bắt người vận hành nhập JSON.
- `/admin/**` luôn `noindex`; `robots.txt` chặn `/admin/` và `/api/`.

## 3. Bảo mật

| Lớp | Cơ chế |
|---|---|
| Phiên đăng nhập | Token 32 byte ngẫu nhiên, DB chỉ lưu SHA-256; cookie `HttpOnly`, `SameSite=Lax`, `Secure` ở production, hạn 7 ngày |
| Chống dò mật khẩu | Quota PostgreSQL nguyên tử: 5 lần/15 phút theo username, 10 lần/15 phút theo IP; HTTP 429 kèm `Retry-After`; DB chỉ lưu HMAC |
| Chống request khác nguồn | `apps/backend/src/proxy.ts`: mutation `/api/admin/*` có `Origin` khác host public (theo `X-Forwarded-Host`) trả 403 |
| Phân quyền | RBAC `module.action` (`view/create/update/delete`, thêm `publish` cho nội dung xuất bản). Danh mục quyền là code (`permissions.ts`), seed đồng bộ vào DB; role là dữ liệu do admin tạo/sửa ở trang Vai trò, mỗi user một role. Kiểm tra 2 lớp: `apps/backend/src/proxy.ts` theo module + method, route handler kiểm tra đúng hành động và `publish` (`lib/admin-access.ts`). Super Admin (`is_system`) không sửa/xóa được, luôn đủ quyền, không mất Super Admin cuối. Chống leo thang: chỉ cấp quyền mình có, không tự sửa role/khóa mình, chỉ Super Admin đụng tài khoản Super Admin. CMS dùng `useAdminPermissions().can()` chỉ để ẩn thao tác |
| Input | Zod strict ở mọi ranh giới; Drizzle tham số hóa truy vấn |
| Media | Kiểm magic bytes (PNG/JPEG/WebP/PDF/ZIP), tối đa 20 MB, object đã xóa mềm trả 404 |
| Lead | Honeypot, tối đa 1 lần/15 phút cho mỗi IP đã băm; khóa advisory chống request đồng thời |
| IP client | Lấy giá trị ngoài cùng bên phải của `X-Forwarded-For` (Caddy ghi đè). Nếu đặt CDN trước Caddy phải cấu hình `trusted_proxies` |
| Biên mạng | Chỉ Caddy mở 80/443. Header `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`. `/api/internal/*` trả 404 ở Caddy. S3 nằm ở network `storage` nội bộ, chỉ Backend truy cập |
| Secret | `.env*` không được commit. Compose dùng `${VAR:?missing}` nên thiếu secret thì stack không khởi động |

## 4. Vận hành

### Local

```sh
docker compose up -d          # PostgreSQL 127.0.0.1:5433, S3Mock 127.0.0.1:9090
pnpm db:migrate && pnpm db:seed:cms
pnpm dev:backend              # 3002
pnpm dev:cms                  # 3001
pnpm dev                      # 3000
```

- Cấu hình nằm ở `.env` gốc repo (mẫu: `.env.example`). Nếu `tsx` báo `spawn UNKNOWN` trên Windows, chạy `node --import tsx scripts/<file>.ts`.
- `pnpm db:import:v1-content` nhập lại nội dung V1. Mọi script seed/import đều idempotent và không ghi đè nội dung đã sửa trong CMS.

### Production (VPS + Docker Compose)

Dịch vụ: `proxy` (Caddy), `publish-web`, `cms`, `backend`, `db` (PostgreSQL 17), `s3` (SeaweedFS một node), `umami` (thống kê truy cập, database `umami` riêng trên cùng PostgreSQL), cùng các job chạy một lần `migrate`, `seed-admin`, `umami-db-init`. Image nền được ghim digest.

1. Trỏ DNS `SITE_ADDRESS`, `CMS_SITE_ADDRESS` và `ANALYTICS_SITE_ADDRESS` về VPS, mở cổng 80/443.
2. `cp .env.production.example .env.production && chmod 600 .env.production`, rồi thay mọi giá trị `replace_with_...`.
3. `docker compose --env-file .env.production -f compose.production.yaml up -d --build`
4. Kiểm tra `logs seed-admin`. Job này tạo hoặc nâng quyền tài khoản `INITIAL_ADMIN_*`, không ghi đè mật khẩu đã có.
5. Kiểm tra storage: `... run --rm migrate node scripts/audit-s3-storage.mjs`
6. Thống kê: mở `ANALYTICS_SITE_ADDRESS`, đăng nhập `admin`/`umami` và **đổi mật khẩu ngay**, thêm website (domain = `SITE_ADDRESS`), tạo API key; điền `UMAMI_WEBSITE_ID`, `UMAMI_API_KEY` vào `.env.production` rồi chạy lại lệnh `up -d`. Chưa điền thì website không chèn script và CMS báo "chưa kết nối".

Cập nhật: `git pull --ff-only`, rồi chạy lại lệnh `up -d --build`. Migration chạy trước khi thay container; nếu release không lên, xem `logs migrate`.

Tác vụ định kỳ (lên lịch ở host, chạy qua image migration):

| Lệnh | Tần suất | Ghi chú |
|---|---|---|
| `pnpm db:cleanup-login-throttles` | Hằng ngày | Tối đa 500 bucket hết hạn mỗi lần |
| `pnpm db:cleanup-media` | Thủ công | Media xóa mềm quá 7 ngày, bỏ qua tệp còn được tham chiếu. Chưa lên lịch, chờ chốt policy |

Sao lưu:

- Database: `... exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > iorder-db.sql`
- Volume `seaweed-data`.
- Phải thử restore trước khi tin vào bản sao lưu.

Chuyển dữ liệu từ MinIO cũ: volume `seaweed-data` là volume mới. Nếu production đã có media thì phải sao chép object và đối soát với `storage_key` trước khi cutover, đồng thời giữ volume cũ cho đến khi restore đạt.

### Thống kê truy cập (Umami)

- Website chèn `/stats/script.js` khi có `UMAMI_WEBSITE_ID`; script và sự kiện (`/stats/api/send`) đi qua cùng domain website. Production: Caddy chỉ mở hai đường này tới `umami`; giao diện Umami ở `ANALYTICS_SITE_ADDRESS`. Local: rewrite của publish-web khi có `UMAMI_URL`, chạy `docker compose --profile analytics up -d` (cổng 3005).
- Backend đọc số liệu qua Umami API bằng API key (`Authorization: Bearer umami_…`), response kiểm bằng Zod; Umami lỗi thì CMS hiện trạng thái lỗi, không làm hỏng dashboard. Không dùng cookie nên không cần banner đồng ý.

## 5. Kiểm thử và cổng chất lượng

| Lệnh | Nội dung |
|---|---|
| `pnpm typecheck` | Root + 3 app |
| `pnpm lint` | ESLint toàn workspace |
| `pnpm test` | Unit/contract test (`node --test`) |
| `pnpm db:check` | Kiểm tra metadata migration |
| `pnpm audit --prod` | Kiểm tra lỗ hổng dependency |
| `pnpm build` | Build cả 3 app |
| `pnpm audit:*-db`, `scripts/audit-*.mjs` | Fixture tích hợp DB/HTTP; chỉ chạy trên DB localhost hoặc Compose tạm, tự dọn schema |

CI: `.github/workflows/quality.yml` chạy các cổng trên cho push `main` và pull request.
