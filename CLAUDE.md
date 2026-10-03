# iOrder V2 — Toàn cảnh dự án

Đọc file này trước khi thay đổi source. Đây là bối cảnh làm việc cho toàn bộ dự án, không chỉ CMS.

## 1. Scope, mục tiêu và thứ tự ưu tiên

- Repository hiện tại: `D:\work\webiorderv2`, package `iorder-v2`.
- Đây là ứng dụng Next.js duy nhất, phục vụ cả website công khai, CMS `/admin`, API route handlers và server logic.
- Repository cũ `D:\work\iorderwebsite\iorder-website` chỉ là **V1 để tham khảo hành vi/dữ liệu**. Không copy kiến trúc hay source V1 vào V2.
- Ưu tiên theo thứ tự: yêu cầu người dùng hiện tại -> source/runtime thực tế -> file này -> `PROJECT_CONTEXT.md`.
- Mục tiêu không phải tạo nhanh thật nhiều source: xây dựng hệ thống CMS/public site thật, dễ hiểu, dùng dữ liệu thật, có thể mở rộng và vận hành.

Không tự thêm framework lớn, microservice, Redis, queue, Kubernetes, search engine, ORM/database mới hoặc dependency mới chỉ để tiết kiệm vài dòng code. Làm từng vertical slice hoàn chỉnh.

## 2. Công nghệ và runtime

| Phần | Công nghệ |
|---|---|
| Ứng dụng | Next.js 16 App Router, React 19, TypeScript |
| Giao diện | Tailwind CSS 4, CSS semantic tokens, `lucide-react` |
| Validation | Zod 4 |
| Database | PostgreSQL + Drizzle ORM |
| Media | S3-compatible storage, local S3 mock |
| Auth | Session server-side, cookie HttpOnly cho CMS |
| Package manager | pnpm 10 |

Local runtime:

```text
Next app:       http://localhost:3000
PostgreSQL:     127.0.0.1:5433
S3 mock:        http://localhost:9090
Infrastructure: compose.yaml
```

Docker có thể tốn RAM đáng kể trên máy Windows 8 GB. Chỉ khởi động Docker, chạy migration hoặc seed khi task cần và người dùng đã cho phép. Không ghi secrets vào source/log/response.

Lệnh chính:

```bash
pnpm dev
pnpm db:generate
pnpm db:migrate
pnpm db:check
pnpm db:studio
pnpm test
pnpm exec tsc --noEmit
pnpm lint
```

Nếu script seed `tsx` bị `spawn UNKNOWN` trên Windows/Node 24, chạy trực tiếp:

```bash
node --import tsx scripts/<script>.ts
```

## 3. Cấu trúc source

```text
src/
  app/
    (web)/                 # website công khai, server-rendered routes
    admin/                 # login và CMS bảo vệ
    api/                   # route handlers cho CMS/public forms
    media/[...storageKey]/ # proxy/serve media
    robots.ts, sitemap.ts  # SEO infrastructure
  components/
    site/                  # component website công khai
    admin/                 # CMS managers, editors và UI primitives
  server/
    <domain>/              # contracts, repository, service của domain
    auth/, audit/, revisions/, shared/
  db/schema/               # Drizzle schema theo domain
drizzle/                   # SQL migrations sinh bởi Drizzle
scripts/                   # seed/import vận hành
public/                    # static assets
```

Luồng dữ liệu chuẩn:

```text
Client component
  -> /api route handler
  -> service (validation + nghiệp vụ + audit)
  -> repository (Drizzle queries)
  -> PostgreSQL / S3
```

Với Server Component, gọi service/repository trực tiếp; không tự fetch HTTP vào API nội bộ nếu không cần. API dành cho client interaction, external consumer, webhook hoặc integration.

## 4. Quy tắc backend và dữ liệu

Mỗi domain mới/chỉnh sửa đáng kể phải theo contracts-first:

1. Zod input/output contract và TypeScript type.
2. Drizzle schema + migration nếu dữ liệu thay đổi.
3. Repository chỉ chứa truy vấn Drizzle/transaction/serializer.
4. Service chứa validation, nghiệp vụ, authorization, version conflict và audit.
5. Route handler mỏng: parse input, gọi service, trả HTTP response tiếng Việt.
6. UI/API/public rendering dùng dữ liệu service thật.
7. Unit test service với repository/media mock khi domain có nghiệp vụ.

Không để route handler truy cập database trực tiếp. Không dùng TypeScript type thay cho validation runtime.

### Domain hiện có

- Identity: users, roles, sessions, auth/password.
- Content: posts, categories, tags, pages/page blocks, offerings, equipment.
- Site: navigation, profile, settings, redirects, audit logs.
- Media: assets, upload/storage, usage.
- Supporting: partners, testimonials, downloads, leads.
- Shared infrastructure: revisions, publishing readiness, global search, analytics.

### Lifecycle và audit

Nội dung biên tập phải hỗ trợ đúng lifecycle phù hợp domain: `draft`, review/scheduled khi có, `published`, `archived`. Mutation luôn ghi audit log. Domain đã có revision phải preserve optimistic versioning; version cũ trả lỗi nghiệp vụ tiếng Việt và không ghi đè dữ liệu người khác.

Không xóa rồi tạo lại toàn bộ item khi có thể cập nhật ổn định theo UUID. Lưu trữ phải ưu tiên archive/restore thay vì hard delete.

## 5. Website công khai, SEO và media

Website nằm dưới `src/app/(web)/`. Các nhóm route chính gồm trang chủ, giới thiệu/liên hệ, catalog (phần mềm/giải pháp/dịch vụ), thiết bị, bài viết/taxonomy, hướng dẫn/hỗ trợ và trang CMS tạo.

Public pages phải ưu tiên:

- Server rendering khi cần dữ liệu CMS/SEO.
- Metadata, canonical URL, Open Graph, robots, sitemap và JSON-LD khi phù hợp.
- Semantic HTML, URL sạch, internal linking, Core Web Vitals và tối ưu ảnh.
- Chỉ hiển thị nội dung `published` công khai.

Static data trong website chỉ là fallback tạm thời, phải đánh dấu `REMOVE-BY: <mốc>` và có kế hoạch thay bằng CMS. Không biến mock/static thành nguồn dữ liệu chính.

Media qua `media.service` và storage adapter; không để UI tự gọi S3. Dùng `publicUrl` thật khi kiểm tra media. Trước khi xóa/thay file, kiểm tra endpoint usage để không làm gãy content đang tham chiếu.

## 6. CMS: nguyên tắc UI nhất quán

Toàn bộ CMS dùng tiếng Việt, semantic tokens và toast; không dùng `window.confirm()`.

### Chọn đúng kiểu UI

| Dữ liệu | UI chuẩn | Ví dụ |
|---|---|---|
| Bản ghi phẳng, nhiều item | `AdminDataTable` + filter + phân trang | Posts, Pages, Offers, Equipment, Audit |
| Form ngắn | Table/list -> `AdminSidePanel` | Downloads, Redirects, Users, Leads, Taxonomy |
| Dữ liệu cây | List/tree toàn trang -> side panel | Menu navigation |
| Nội dung dài/rich text/block | Table/list -> full editor | Post, Page, Offering, Guide, Equipment phức tạp |
| Media trực quan | Gallery/list -> inspector side panel | Media assets |
| Cấu hình một bản ghi | Form theo section + action bar đáy | Site profile, SEO, external links, CMS appearance |

`AdminDataTable` (`src/components/admin/ui/admin-data-table.tsx`) cung cấp cấu hình cột theo user: ẩn/hiện, đổi tên, kéo thứ tự, chỉnh độ rộng và ghim cột. Dùng nó cho collection phẳng; không ép tree/media gallery vào table.

`AdminSidePanel` (`src/components/admin/ui/admin-side-panel.tsx`) là drawer chuẩn cho tạo/sửa ngắn:

- List vẫn hiện phía sau overlay.
- Có nút đóng, body riêng có scroll, footer action cố định.
- Click backdrop, đóng, link nội bộ và unload phải tôn trọng dirty guard.
- Mobile dùng toàn chiều rộng viewport.

`ContentEditorPage` là layout hai panel cũ. Không dùng nó cho màn mới; khi chạm domain phù hợp, chuyển dần sang list + drawer hoặc table + full editor.

`AdminEditorActions` phục vụ các form full-page/singleton còn lại: action bar ghim đáy, nút canh phải, không tạo khe ngoài vô ích.

### Trạng thái hiện tại của UX migration

- Menu & Điều hướng: tree list toàn trang + drawer; validation URL, revision, restore, audit và version conflict đã có.
- Downloads: list + drawer; direct upload tự gắn file và tự tạo/lưu draft; chỉ nhận PDF/ZIP; lifecycle draft/published/archived, revision/restore/audit đã có.
- Offers, Posts, Pages, Equipment, Audit: đã có `AdminDataTable`; editor dài vẫn là màn riêng.
- Next candidates: Redirects -> Users -> Leads -> Taxonomy -> Media inspector.

## 7. Auth, authorization và operational safety

- CMS routes là protected routes. Dùng helper auth/request administrator hiện có, không tự kiểm tra header tùy tiện.
- Không đưa password, cookie, token, connection string hoặc PII vào log, toast hay commit.
- Với user management, tránh làm mất admin cuối cùng hoặc thu hồi nhầm session hiện hành.
- Với publish/archive/delete/restore, dùng action rõ nghĩa, toast tiếng Việt và audit log.
- Giữ database container localhost-bound và giữ nguyên volume prefix khi sửa Docker/deploy.

## 8. Ngôn ngữ, code style và dependency

- UI text, toast, validation message, `error.message`, log vận hành và output script: **tiếng Việt**.
- `error.code` là tiếng Anh ngắn, ổn định, phục vụ client logic; không render code trực tiếp cho người dùng.
- Reuse component và CSS token hiện có trước khi tạo abstraction/package mới.
- Trước khi thêm package, giải thích vấn đề, lựa chọn built-in, nhu cầu thực tế và chi phí bảo trì.
- Không tạo file/module “phòng khi cần”. Mỗi file mới phải có owner/importer rõ ràng.

## 9. Quy trình làm việc và kiểm chứng

Trước khi sửa:

1. Xác nhận đúng repo bằng `package.json`, `compose.yaml`, port và file liên quan.
2. Đọc contract/service/repository/UI cùng domain, không chỉ component.
3. Giữ mọi thay đổi worktree của người dùng; không reset/checkout rộng hay xóa hàng loạt.
4. Giải thích ngắn file mới hoặc thay đổi kiến trúc khi thay đổi không hiển nhiên.

Sau khi sửa code:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```

Nếu thay đổi persistence và Docker được phép: chạy migration/check và kiểm tra thực tế browser -> API -> database -> browser. Typecheck/lint không thay thế E2E thật.

Khi debug: triệu chứng -> lỗi -> execution path -> root cause -> fix nhỏ nhất -> verify. Không đoán rồi sửa hàng loạt.

## 10. Release/deploy và source cũ

Source V1 chỉ dùng để hiểu behavior, content, data shape, public routes và business rules. Quy trình là: đọc V1 -> rút requirement -> thiết kế tối giản cho V2 -> implement -> so sánh behavior. Không copy folder/module V1.

Khi deploy, giữ `VOLUME_PREFIX`, để API/storage exposure ở mức tối thiểu, kiểm tra real media `publicUrl`, `docker compose ps` và readiness endpoint sau cập nhật. Không khẳng định production/live database thành công nếu chưa có bằng chứng runtime.

## 11. Cách cộng tác

Người dùng muốn phát triển từng slice, hiểu kiến trúc và nhìn thấy proof trên browser. Vì vậy:

- Giải thích vừa đủ về lý do và trade-off, dùng tên file thật.
- Không tự mở rộng sang domain khác ngoài yêu cầu hiện tại.
- Ưu tiên dữ liệu thật và browser verification hơn mock UI.
- Báo rõ điều gì đã kiểm tra, điều gì chưa chạy và vì sao.
- Khi nhiều hướng hợp lý, đề xuất một hướng phù hợp kiến trúc hiện có thay vì đưa danh sách thư viện tùy chọn.
