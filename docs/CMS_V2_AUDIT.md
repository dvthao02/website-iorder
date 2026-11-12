# Audit CMS V2: nghiệp vụ, dữ liệu và UI/UX

Ngày: 21/10/2026. Phạm vi: `apps/admin`, `apps/api/src/app/api/admin`, `apps/api/src/proxy.ts`, `packages/shared/src/server`, phần `apps/website` liên quan đến dữ liệu CMS.

Phương pháp: đọc code trên working tree hiện tại (gồm cả các thay đổi chưa commit), đối chiếu với `docs/PROJECT.md` và `docs/ROADMAP.md`. Mỗi vấn đề dưới đây có file/dòng làm bằng chứng. Chưa chạy lại cổng chất lượng, E2E hay thử trên trình duyệt cho đợt audit này. Những gì chưa kiểm chứng được ghi ở mục 7.

**Tiến độ 22/10:** đã làm P1-3, P1-4, P1-5, P2-2, P2-4, P2-5, P2-7 (một phần: link nội bộ đã trỏ thẳng, route cũ vẫn giữ). Chi tiết ở `docs/ROADMAP.md`. Chưa làm: các mục bảo mật (P0-1, P1-1, P1-2) theo yêu cầu, P1-6, P1-7, P2 còn lại. **28/10:** đã vá P0-1 và P1-1 (xem ROADMAP). **03/11:** xong P2-3 (PATCH đổi trạng thái trang, danh sách không kèm khối) và P2-12 (`liveContentCondition`).

Tóm tắt: nền tảng vững, gồm RBAC 2 lớp, optimistic concurrency, revision, audit log, xóa mềm, Zod ở mọi ranh giới. Không cần viết lại. Có **1 lỗ hổng leo thang quyền (P0)**. Phần còn lại là validation đường dẫn chưa đồng nhất, vài luồng SEO còn thiếu, và cấu trúc menu/trang khiến người vận hành khó tìm đúng chỗ sửa.

---

## 1. Tổng quan kiến trúc

```text
Trình duyệt → Caddy → cms (3001) ──rewrite /api──→ api (3002) → service → repository → PostgreSQL
                    → website (3000) ──fetch──→ api            └→ S3 (SeaweedFS)
```

| Lớp | Vị trí | Ghi chú |
|---|---|---|
| Phân quyền thô | `apps/api/src/proxy.ts` + `lib/admin-permission.ts` | Ánh xạ `segment đầu của /api/admin` × method → `module.action`. Tài nguyên lạ thì chỉ Super Admin được gọi |
| Phân quyền chi tiết | Route handler (`lib/admin-access.ts`: `denyUnless`, `denyPublishUnless`) | Nội dung đang/sẽ công khai cần `<module>.publish` |
| Nghiệp vụ | `packages/shared/src/server/<domain>/*.service.ts` | Zod parse đầu vào/đầu ra |
| Dữ liệu | `*.repository.ts` (Drizzle) | Transaction, `for update`, kiểm `draft_version`/`version` |
| CMS | `apps/admin/src/app/admin/(protected)/**` (Server Component) → `lib/backend.ts` (đọc) và `lib/admin-api.ts` (ghi) | `requireAdminPermission` ở từng trang; `useAdminPermissions().can()` chỉ để ẩn nút |
| Làm mới website | `revalidatePath` (wrapper) → HMAC → `website/api/internal/revalidate` | TTL 60 giây làm dự phòng |

Danh mục quyền (`packages/shared/src/server/auth/permissions.ts`) có 16 module × `view/create/update/delete/publish`. Role là dữ liệu, mỗi user một role, Super Admin (`is_system`) không sửa được. Quyền được đọc lại từ DB ở **mỗi request** (`auth.repository.ts` `findActiveAdministratorSession`), nên đổi role có hiệu lực ngay.

---

## 2. Luồng nghiệp vụ theo module

### 2.1 Trang (Pages)

- **Mô hình:** `pages` + `page_blocks` (block là discriminated union Zod, thêm loại không cần migration). Có 3 loại trang:
  - **Trang hệ thống** (`fixedWebsitePages`): route do code giữ, không tạo/xóa/đổi slug.
  - **Trang danh sách** (`kind: listing`): `/tin-tuc`, `/thiet-bi`… Module sở hữu (`ownerModule`) cũng sửa được.
  - **Trang tự tạo**: `/trang/[slug]`.
- **API:** `GET/POST /api/admin/pages` (POST là upsert, bắt buộc `expectedVersion` khi sửa), `GET/DELETE /api/admin/pages/[id]` (chỉ xóa trang đang lưu trữ, không xóa trang hệ thống).
- **Đổi trạng thái** (lưu trữ/khôi phục/xuất bản hàng loạt): gửi lại **toàn bộ** trang qua POST (`pages-manager.tsx:30` `pageStateRequest`). Bài viết, sản phẩm, thiết bị thì dùng `PATCH { action }` riêng.
- **CMS:**
  - "Trang chủ" (`/admin/trang-chu`) nằm ở nhóm Nội dung.
  - "Trang tự tạo" (`/admin/pages`, lọc `kind=custom`) kèm danh mục "Trang có sẵn" nằm ở nhóm Cấu trúc website.
  - Trang danh sách mở từ nút "Trang danh sách (n)" trong từng module.

### 2.2 Bài viết & Hướng dẫn (Posts)

- **Mô hình:** `posts` (type: news/promotion/case_study/announcement/guide) + chuyên mục/thẻ (`post_categories`, `post_tags`), nội dung rich text v2 được làm sạch ở server.
- **API:** `GET/POST /api/admin/posts`, `GET/PATCH/DELETE /api/admin/posts/[id]` (`PATCH { action: archive|restore|publish }` hoặc cập nhật nội dung kèm `expectedVersion`).
- **Phân luồng:** cùng một bảng nhưng hiển thị ở hai nơi.
  - Tin tức nằm ở `/admin/tin-tuc`.
  - Hướng dẫn nằm ở `/admin/tai-nguyen?tab=guides`; `/admin/tin-tuc/[id]` của bài hướng dẫn chuyển hướng sang `/admin/tai-nguyen/huong-dan/[id]`.
  - Quyền của hướng dẫn là `posts.*`, không phải `support_downloads.*`.
- **Vòng đời:** draft → review → scheduled → published → archived. Hẹn giờ được lọc lúc truy vấn. Trạng thái "Chờ duyệt" chỉ có tác dụng đếm trên chuông thông báo; không có người duyệt được chỉ định hay ghi chú duyệt.

### 2.3 Thư viện media

- **Upload:** kiểm magic bytes (PNG/JPEG/WebP/PDF/ZIP), tối đa 20 MB, khóa lưu trữ `uploads/<uuid>`. Lỗi ghi DB thì xóa object (`media.service.ts`).
- **Xóa:**
  - Gọi `collectMediaUsage`, tìm ở 12 nơi (ảnh bìa, khối trang, nội dung bài, logo, cấu hình OG…). Còn được dùng thì trả 409.
  - Không còn dùng thì xóa mềm (`deleted_at`). Job `pnpm db:cleanup-media` (chạy tay) xóa object sau 7 ngày.
- **Sửa alt/caption:** có `version`, trả 409 khi xung đột.

### 2.4 Người dùng

- `GET/POST /api/admin/users` (POST là upsert). Không có xóa, chỉ khóa (`status=disabled`); khóa thì thu hồi mọi session.
- Chặn tự đổi role/tự khóa mình. Chỉ Super Admin được động tới tài khoản Super Admin. Không mất Super Admin cuối cùng.
- Không có quên mật khẩu/TOTP (đã nằm trong ROADMAP P1.7).

### 2.5 Vai trò & quyền

- `GET/POST/DELETE /api/admin/roles`. Ma trận checkbox. Chống leo thang: người không phải Super Admin chỉ được **thêm** quyền mà mình có (`assertCanGrant`), không sửa role của chính mình, không xóa role đang có người dùng.
- 7 role mặc định chỉ tạo một lần. Sau đó admin tự quản lý role.

### 2.6 Cài đặt website

| Màn | API | Dữ liệu |
|---|---|---|
| Thông tin doanh nghiệp | `PUT /api/admin/profile` | `site_profile`: tên, pháp nhân, hotline, email, địa chỉ, giờ làm, logo |
| Tên miền & SEO | `PUT /api/admin/publishing-config` | `siteUrl`, tiêu đề/mô tả mặc định, ảnh OG, cho phép index |
| Liên kết & Mạng xã hội | `PUT /api/admin/external-links` | appLogin, trial, facebook, zalo, youtube, appStore, googlePlay |
| Kiểm tra xuất bản | `GET` readiness | Checklist, lọc theo quyền xem |

Cả ba màn ghi đều dùng `{ values, expectedVersion }`. Quyền là `settings.view/update`.

### 2.7 Module khác (tóm tắt)

- **Sản phẩm/Giải pháp/Dịch vụ:** `offerings`, một màn có tab theo loại.
- **Thiết bị:** `equipment_groups` + `sales_equipment`.
- **Đối tác & Đánh giá:** `supporting`.
- **Tệp tải về:** `support_downloads`.
- **Menu:** `menus` theo location header/header_cta/footer. Mục menu liên kết theo `contentId` nên đổi slug không làm gãy menu; website chỉ hiện mục có đích đã xuất bản.
- **Chuyển hướng:** 301/308, chỉ nhận đường dẫn nội bộ.
- **Khách hàng tiềm năng:** 3 trạng thái, xuất CSV/XLSX.
- **Nhật ký:** chỉ ghi thêm, có IP/thiết bị/mã request.
- **Thống kê:** Umami.

---

## 3. Đánh giá UI/UX

### Điểm tốt nên giữ

- Bộ component dùng chung: `AdminDataTable` (sắp xếp, ghim, chọn nhiều), `AdminFilterBar`, `AdminSidePanel`, hộp xác nhận, toast, thanh xung đột 409 có nút tải bản mới.
- Editor 2 cột thống nhất cho bài viết/sản phẩm/thiết bị/trang:
  - Nút lưu nói rõ hành động.
  - Ctrl+S, bảo vệ bản nhập chưa lưu.
  - Mục "Nên có trước khi đăng", trợ lý SEO, lịch sử phiên bản tải khi mở.
- Không bắt người vận hành nhập JSON. Liên kết menu dạng ô tìm, có "Sửa nội dung" từ menu.
- Nút bị ẩn hoặc khóa theo quyền. Mở URL thiếu quyền thì vào màn "Không có quyền".

### Vấn đề chính

1. **Không tìm thấy trang để sửa.** Trang hệ thống nằm rải ở 3 nơi:
   - "Trang chủ" có mục riêng trong Nội dung.
   - Các trang danh sách nằm sau nút trong từng module.
   - Giới thiệu, Liên hệ, Chính sách… nằm trong danh mục phụ của màn **"Trang tự tạo"** ở nhóm Cấu trúc website.

   Nhãn "Trang tự tạo" khiến người dùng không nghĩ tới việc vào đó để sửa trang Giới thiệu. Nút đóng editor cũng quay về 3 nơi khác nhau tùy loại trang.
2. **Nhóm menu chưa nhất quán.**
   - "Khách hàng" chỉ có 1 mục.
   - "Kiểm tra xuất bản" (quyền `settings.view`, đường dẫn `/admin/seo/...`) lại nằm ở Cấu trúc website, trong khi màn "Tên miền & SEO" nằm ở Cài đặt.
   - Dashboard cũng có thẻ "Sẵn sàng xuất bản" trùng nội dung.
   - Nhãn module trong ma trận quyền khác nhãn trên sidebar: "Trang website", "Tài nguyên hỗ trợ", "Sản phẩm, giải pháp, dịch vụ, **ngành**" (loại Ngành đã bỏ ở migration 0011).
3. **Dashboard sai mục đích ở vài chỗ.**
   - Ô "Trang website" đếm cả trang hệ thống nhưng dẫn tới "Trang tự tạo" (chỉ có trang tự tạo), nên con số không khớp.
   - Nút chính của dashboard là "Tạo trang", một việc hiếm làm.
   - Người không có `dashboard.view` vẫn thấy khối thống kê báo "chưa kết nối" và nút "Thống kê 7 ngày" dẫn tới màn "Không có quyền".
4. **Header editor lặp thông tin.** Header của `AdminDetailPanel` có tên và mô tả, ngay dưới lại là ô tên lớn cùng dòng đường dẫn. Đã sửa riêng cho trang hệ thống hôm nay; bài viết/sản phẩm/trang tự tạo vẫn lặp.
5. **Trường nhập nhưng không dùng.** Sản phẩm có nhóm "Thông tin bổ sung" mà CMS tự ghi là "chưa hiện trên website hiện tại" (`cms-content-manager.tsx:185`). Người vận hành nhập dữ liệu mà không thấy kết quả.
6. **Hướng dẫn nằm sai chỗ theo quyền.** Bài hướng dẫn nằm trong "Hỗ trợ cài đặt" nhưng dùng quyền `posts.*`. Role chỉ có `support_downloads.*` thấy màn Hỗ trợ cài đặt mà không thấy tab Hướng dẫn, và ngược lại.
7. **Route cũ còn sót trong CMS.** Có 11 route chỉ để chuyển hướng: `noi-dung`, `cau-hinh`, `tieu-de-catalog`, `tieu-de-trang`, `huong-dan`, `huong-dan/[id]`, `huong-dan/moi`, `giai-phap/theo-nganh` (3 route), `/login`. Thêm `giai-phap`, `dich-vu` (danh sách) và link dashboard trỏ vào chúng, nên phải qua thêm một bước chuyển hướng.

---

## 4. Danh sách vấn đề

### P0: nghiêm trọng

**P0-1. Người có `users.update` chiếm được tài khoản có quyền cao hơn mình (leo thang quyền)**

- **File:** `packages/shared/src/server/users/users.repository.ts:62-64`; route `POST /api/admin/users`.
- **Hiện trạng:** `assertCanGrant` chỉ chạy khi **đổi role** (`if (roleChanged)`). Kịch bản:
  1. A không phải Super Admin, có `users.update`.
  2. B có role R với các quyền A không có (ví dụ `roles.*`, `settings.update`).
  3. A gửi lại đúng role R của B kèm **mật khẩu mới**, nên `roleChanged = false` và bước kiểm bị bỏ qua.
  4. A đăng nhập bằng B và có quyền của R.

  Cách này cũng cho A khóa hoặc đổi email của B. Điều này trái quy tắc "chỉ cấp quyền mình có" ghi trong `docs/PROJECT.md` mục 3.
- **Hướng xử lý:** trong `writeCmsUser`, khi sửa user khác mà actor không phải Super Admin, luôn gọi `assertCanGrant(access, rolePermissionCodes(role hiện tại của B))`, kể cả khi role không đổi. Thêm fixture `audit:users-db` cho kịch bản trên.
- **Lý do:** role mặc định chỉ có Super Admin giữ `users.*`, nhưng role là dữ liệu do admin tạo, nên chỉ cần một role tùy chỉnh có `users.update` là mở ra lỗ hổng.

### P1: quan trọng

**P1-1. Admin đặt lại mật khẩu cho người khác nhưng không thu hồi phiên đăng nhập**

- **File:** `users.repository.ts:77`.
- **Hiện trạng:** session chỉ bị thu hồi khi khóa tài khoản. Đặt lại mật khẩu thường là phản ứng khi lộ mật khẩu, nhưng phiên của kẻ lạ vẫn sống 7 ngày. Màn "Tài khoản của tôi" thì có đăng xuất phiên khác (`replaceOwnPassword`).
- **Hướng xử lý:** khi `passwordHash` có giá trị, thu hồi mọi session của user đó trong cùng transaction và ghi nhật ký.

**P1-2. Đường dẫn do người vận hành nhập không được kiểm giao thức đồng nhất**

- **File:**
  - `settings/external-links.contract.ts:3` (`z.string().url()`)
  - `pages/pages.contract.ts:87, 95` (`href` của nút/thẻ trong khối trang: chuỗi bất kỳ)
  - `posts/posts.contract.ts:75` (`ctaUrl`)
  - `supporting/supporting.contract.ts:15` (`websiteUrl`)
  - Trường `canonicalUrl` ở pages/posts/offerings/equipment.
- **Hiện trạng:** đã chạy thử Zod của repo. `javascript:alert(1)` và `data:text/html,…` đều qua `z.string().url()`. React 19 chặn `javascript:` trong `href` lúc render nên hiện chưa khai thác được, nhưng dữ liệu bẩn vẫn vào DB, JSON-LD (`structured-data.tsx` dùng `sameAs`) và mọi nơi render khác sau này. Menu thì đã dùng `safeLinkSchema` (http/https/mailto/tel hoặc `/…`).
- **Hướng xử lý:**
  - Dùng `safeLinkSchema` cho mọi link hiển thị.
  - Dùng một schema `httpUrlSchema` (chỉ http/https) cho `canonicalUrl`, `websiteUrl` và liên kết mạng xã hội.
  - Kiểm lại dữ liệu hiện có trước khi siết (trả 400 với dữ liệu cũ sẽ chặn việc lưu).

**P1-3. Đổi đường dẫn nội dung đã xuất bản làm gãy URL cũ (SEO)**

- **File:** `posts-content-manager.tsx`, `cms-content-manager.tsx`, `equipment-editor.tsx`, `page-editor-detail.tsx` (các chỗ có dòng "đổi đường dẫn sẽ làm hỏng liên kết cũ, nên tạo chuyển hướng").
- **Hiện trạng:** CMS chỉ cảnh báo. Người vận hành phải tự sang màn Chuyển hướng để tạo. Thực tế dễ quên, và Google sẽ gặp 404.
- **Hướng xử lý:** khi lưu nội dung `published` có slug mới, service tạo redirect 301 cũ→mới trong cùng transaction. Đã có sẵn `redirects` và hàm kiểm vòng lặp `redirect-cycle.ts`. CMS thêm ô "Tự tạo chuyển hướng" bật sẵn.

**P1-4. Trang hệ thống (kể cả Trang chủ) có thể bị chuyển về Bản nháp/Lưu trữ**

- **File:** `page-editor-detail.tsx` (`ContentStatusChoice` không giới hạn), `apps/website/src/app/(web)/page.tsx` (thiếu trang thì hiện "Trang chủ đang chờ được xuất bản trong CMS").
- **Hiện trạng:** chỉ một lần bấm nhầm là website mất trang chủ hoặc trang danh sách (404). Không có cảnh báo riêng.
- **Hướng xử lý:**
  - Trang chủ: không cho chọn Lưu trữ, chuyển về nháp phải xác nhận.
  - Trang hệ thống khác: hộp xác nhận ghi rõ "URL … sẽ trả 404".
  - Backend chặn `archived` với trang hệ thống.

**P1-5. Role thiếu `taxonomy.view` thấy editor bài viết với chuyên mục/thẻ trống**

- **File:** `apps/admin/src/lib/backend.ts:235` (403 thì trả danh sách rỗng), `posts-content-manager.tsx:309`, `permissions.ts:66` (role Marketing không có `taxonomy`).
- **Hiện trạng:** bài đang có chuyên mục vẫn hiện "Chưa có chuyên mục.", người dùng không thấy và không đổi được. Dữ liệu không mất vì `categoryIds` được giữ, nhưng giao diện nói sai sự thật.
- **Hướng xử lý:** cho `GET /api/admin/taxonomy` nhận thêm `posts.view` (đọc danh mục là một phần của việc sửa bài). Tạo/sửa/xóa chuyên mục vẫn cần `taxonomy.*`. Sửa trong `admin-permission.ts`, thêm test.

**P1-6. Cấu trúc sidebar khiến trang hệ thống khó tìm**

- **File:** `apps/admin/src/components/admin/admin-shell.tsx:78-135`, `apps/admin/src/app/admin/(protected)/pages/page.tsx`.
- **Hiện trạng:** xem mục 3, vấn đề 1.
- **Hướng xử lý:** xem mục 5. Gom thành một mục **"Trang website"** có 2 tab "Trang có sẵn" và "Trang tự tạo". Giữ lối tắt "Trang chủ".

**P1-7. Đặt lại mật khẩu, khóa, đổi tên user không có `expectedVersion`**

- **File:** `users.contract.ts`, `roles.contract.ts`.
- **Hiện trạng:** hai admin cùng sửa một user/role thì người lưu sau ghi đè người trước mà không có 409. Điều này trái quy ước optimistic concurrency của dự án. Với role, ghi đè có nghĩa là mất thay đổi quyền.
- **Hướng xử lý:** thêm cột `version` cho `users`, `roles` (migration chỉ thêm cột, có default), làm như 8 bảng cấu hình hiện có.

### P2: cải thiện

| # | File/route | Hiện trạng | Hướng xử lý | Lý do |
|---|---|---|---|---|
| P2-1 | `media.service.ts:20` | Kiểm "còn được dùng" nằm ngoài transaction xóa, nên ai đó gắn ảnh vào nội dung đúng lúc đó thì ảnh vẫn bị xóa mềm | Kiểm lại trong transaction của `queueMediaAssetDeletion`, hoặc khi lưu nội dung từ chối media đã xóa mềm | Hiếm, nhưng gây ảnh vỡ trên website |
| P2-2 | `revisions/[target]/[id]/route.ts:35` | Khôi phục phiên bản luôn cần `.publish`, kể cả với bản nháp chưa từng xuất bản | Dùng `denyPublishUnless` theo trạng thái hiện tại/sau khôi phục như route sửa | Biên tập viên không khôi phục được bản nháp của chính mình |
| P2-3 | `pages-manager.tsx:30`, `pages.service.ts` | Lưu trữ/xuất bản trang từ danh sách gửi lại toàn bộ trang (kể cả khối); API danh sách trả cả khối của mọi trang | Thêm `PATCH /api/admin/pages/[id] { action }` dùng `contentStateRequestSchema` như các module khác; danh sách trả projection gọn | Nhất quán API, giảm payload |
| P2-4 | `(protected)/page.tsx:43, 78`; `dashboard/route.ts:21` | Ô "Trang website" lệch số; người thiếu `dashboard.view` thấy thống kê "chưa kết nối" và nút dẫn tới màn không có quyền; nút chính là "Tạo trang" | Đếm riêng trang tự tạo/trang có sẵn hoặc trỏ tới màn gộp; ẩn khối thống kê khi thiếu quyền; nút chính theo quyền (Viết bài) | Dashboard là màn đầu tiên |
| P2-5 | `permissions.ts:15-30` | Nhãn module khác sidebar, còn chữ "ngành" | Đồng bộ nhãn: Trang website, Bài viết & Tin tức, Sản phẩm & Dịch vụ, Hỗ trợ cài đặt (tệp tải về)… | Ma trận quyền khó hiểu |
| P2-6 | `cms-content-manager.tsx:185` | Nhóm "Thông tin bổ sung" không hiện trên website | Hoặc hiển thị trên trang chi tiết sản phẩm, hoặc ẩn khỏi CMS tới khi có giao diện | Tránh nhập dữ liệu vô ích |
| P2-7 | 11 route chuyển hướng cũ (mục 3, vấn đề 7), link dashboard tới `/admin/giai-phap`, `/admin/dich-vu` | Thêm một bước chuyển hướng, dễ gây nhầm khi bảo trì | Link nội bộ trỏ thẳng `/admin/san-pham?type=`; giữ route cũ một thời gian rồi xóa | Gọn code |
| P2-8 | `AdminDetailPanel` + editor | Header lặp tên/mô tả với ô tên lớn | Header editor chỉ còn loại nội dung + trạng thái; tên chỉ ở ô nhập | Nhất quán với thay đổi trang hệ thống hôm nay |
| P2-9 | `leads.contract.ts` | Lead chỉ có 3 trạng thái, không có ghi chú/người phụ trách/spam, không xóa được; chưa có thời hạn lưu (dữ liệu cá nhân) | Thêm ghi chú + trạng thái "Spam"; job ẩn danh/xóa theo thời hạn đã chốt | Vận hành CSKH, Nghị định 13/2023 về dữ liệu cá nhân |
| P2-10 | Trạng thái "Chờ duyệt" | Không có người duyệt, ghi chú duyệt hay thông báo ngoài chuông | Khi cần quy trình duyệt thật: thêm ghi chú khi trả về nháp, lọc "Chờ tôi duyệt" | Hiện "review" chỉ là nhãn |
| P2-11 | Trường `canonicalUrl` | Nhận URL domain bất kỳ, sai một ký tự là Google bỏ index trang | Chỉ hiện ở chế độ nâng cao; cảnh báo khi khác domain `siteUrl` | SEO |
| P2-12 | `navigation/pages/posts/offerings/equipment .repository.ts` | Điều kiện "đang công khai" (`published` hoặc `scheduled` đã tới giờ) viết lại 9 lần ở 5 file | Gom một helper `isLive(table, now)` | Tránh lệch logic khi sửa |
| P2-13 | Session, audit log | Không có job dọn session hết hạn; audit lưu IP vô thời hạn | Lên lịch theo ROADMAP P1.10 sau khi chốt thời hạn | Đã có trong backlog |
| P2-14 | Route public `/privacy-policy`, `/terms` | Slug tiếng Anh trong khi các route khác là tiếng Việt | Chỉ đổi khi làm lại cấu trúc URL, kèm 301 | SEO nhất quán, rủi ro thấp nếu để nguyên |

---

## 5. Cấu trúc CMS đề xuất

Nguyên tắc: nhóm theo việc người vận hành làm, mỗi loại dữ liệu có đúng một nơi sửa, URL CMS giữ nguyên nếu được.

```text
Tổng quan
  Tổng quan · Thống kê truy cập
Nội dung
  Trang website        ← GỘP: tab "Trang có sẵn" (trang chủ, giới thiệu, liên hệ, chính sách, trang danh sách) + tab "Trang tự tạo"
  Bài viết & Tin tức   (Chuyên mục & Thẻ là màn con — giữ)
  Sản phẩm & Dịch vụ   (giữ)
  Thiết bị             (giữ)
  Hỗ trợ cài đặt       (giữ; ghi rõ tab Hướng dẫn cần quyền Bài viết)
  Đối tác & Đánh giá   (giữ)
  Thư viện media       (giữ)
Khách hàng tiềm năng   ← đưa lên cấp trên, bỏ nhóm 1 mục
Website
  Menu & Điều hướng · Chuyển hướng URL
Cài đặt
  Thông tin doanh nghiệp · Tên miền & SEO (+ "Kiểm tra xuất bản" thành tab) · Liên kết & Mạng xã hội
Quản trị hệ thống
  Người dùng · Vai trò & quyền · Nhật ký
```

| Hành động | Mục |
|---|---|
| **Giữ** | RBAC 2 lớp, optimistic concurrency, revision, audit, khuôn editor 2 cột, component dùng chung, quan hệ menu theo `contentId`, cơ chế trang hệ thống/danh sách |
| **Sửa** | P0-1, P1-1 → P1-5, P1-7; validation link (P1-2) |
| **Gộp** | "Trang chủ" + "Trang tự tạo" + danh mục trang có sẵn thành "Trang website" (vẫn giữ lối tắt Trang chủ); "Kiểm tra xuất bản" vào "Tên miền & SEO"; nhóm "Khách hàng" lên cấp trên |
| **Loại bỏ** | Route chuyển hướng cũ (sau một thời gian), "Thông tin bổ sung" nếu website không dùng, nhãn "ngành" |
| **Bổ sung** | Tự tạo redirect khi đổi slug, bảo vệ trang hệ thống, `version` cho users/roles, API đổi trạng thái trang, ghi chú lead |

---

## 6. Kế hoạch theo thứ tự ưu tiên

Mỗi bước là một vertical slice: contract → service → route → CMS → test. Không thêm dependency, không đổi kiến trúc.

| Bước | Nội dung | Phạm vi | Migration | Kiểm chứng |
|---|---|---|---|---|
| 1 | P0-1 leo thang quyền qua sửa user + P1-1 thu hồi session khi đặt lại mật khẩu | `users.repository.ts` | Không | Test đơn vị + fixture `audit:users-db` trên schema tạm |
| 2 | P1-2 siết validation link (sau khi quét dữ liệu hiện có) | contract pages/posts/supporting/settings/offerings/equipment | Không | Test contract; quét DB local chỉ đọc |
| 3 | P1-4 bảo vệ trang hệ thống | `pages.service.ts`, `page-editor-detail.tsx` | Không | Test service + E2E editor trang |
| 4 | P1-5 cho phép đọc chuyên mục/thẻ khi có `posts.view` | `admin-permission.ts`, route taxonomy | Không | Test ma trận quyền |
| 5 | P1-3 tự tạo chuyển hướng khi đổi slug | service posts/offerings/equipment/pages + CMS | Không | Fixture DB + E2E đổi slug → URL cũ 301 |
| 6 | P1-7 `version` cho users/roles | schema + contract + CMS | **Có** (chỉ thêm cột) | `db:check`, fixture roles/users |
| 7 | P1-6 + P2-4 gộp "Trang website", sửa dashboard, gom nhóm sidebar | CMS (`admin-shell.tsx`, `pages/page.tsx`, dashboard) | Không | E2E `sidebar.spec.ts`, chụp màn hình |
| 8 | P2 còn lại theo bảng mục 4, làm theo cụm (API trạng thái trang, nhãn quyền, route cũ, header editor, media race, khôi phục bản nháp) | Nhiều file nhỏ | Không | Cổng chất lượng chuẩn |
| 9 | P2-9, P2-13 (lead, thời hạn lưu) | Chờ chủ sản phẩm chốt thời hạn lưu | Có thể | — |

Mỗi bước kết thúc bằng `pnpm typecheck && pnpm lint && pnpm test && pnpm db:check`, build app bị ảnh hưởng, và cập nhật `docs/ROADMAP.md`.

---

## 7. Chưa kiểm chứng trong đợt audit này

- Chưa chạy cổng chất lượng, E2E hay fixture DB. Kết luận dựa trên đọc code.
- P0-1 được suy ra từ luồng code (`users.repository.ts:62-64`), **chưa tái hiện bằng request thật**. Bước 1 của kế hoạch sẽ viết fixture tái hiện trước khi sửa.
- P1-2: đã chạy thử Zod trong repo và xác nhận `javascript:`/`data:` lọt qua `z.string().url()`. Chưa kiểm hành vi chặn của React 19 trên build production.
- Chưa đánh giá trên điện thoại/tablet và chưa đo hiệu năng cho đợt này (ROADMAP đã có số đo bố cục 31 màn).
- Không xem xét giao diện website ngoài các điểm liên quan trực tiếp đến dữ liệu CMS.
