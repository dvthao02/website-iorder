import { createServer } from "node:http";
import { pageInputSchema } from "@iorder/core/server/pages/pages.contract";

export const uxHomePage = {
  id: "10000000-0000-4000-8000-000000000020", draftVersion: 1, updatedAt: new Date(), publishedAt: new Date(),
  ...pageInputSchema.parse({ title: "Trang chủ", slug: "home", template: "home", status: "published", seoTitle: null, seoDescription: null, canonicalUrl: null, scheduledAt: null, blocks: [
    { type: "hero", isEnabled: true, data: { eyebrow: "iOrder", title: "Phần mềm và thiết bị cho doanh nghiệp", description: "Giải pháp quản lý cửa hàng", primaryAction: { label: "Nhận tư vấn", href: "/lien-he" }, secondaryAction: null, mediaId: null } },
    { type: "partners", isEnabled: true, data: { eyebrow: null, title: "Đối tác và khách hàng đồng hành cùng iOrder", description: "Cùng phát triển với doanh nghiệp", kind: "all", limit: 28 } },
    { type: "features", isEnabled: true, data: { eyebrow: null, title: "Một đối tác cho phần mềm và thiết bị", description: "Nền tảng đồng bộ", items: [{ title: "Phần mềm bán hàng", description: "Quản lý vận hành", href: "/phan-mem" }] } },
    { type: "media_text", isEnabled: true, data: { eyebrow: null, title: "Phần mềm quản lý bán hàng iOrder", description: "Theo dõi đơn hàng và doanh thu", mediaId: null, primaryAction: null, secondaryAction: null } },
    { type: "features", isEnabled: true, data: { eyebrow: null, title: "Vì sao doanh nghiệp chọn iOrder", description: null, items: [{ title: "Hỗ trợ triển khai", description: "Đồng hành cùng cửa hàng", href: null }] } },
    { type: "grouped_list", isEnabled: true, data: { eyebrow: null, title: "Thiết bị và hạ tầng đồng bộ", description: "Danh mục thiết bị", groupLabel: null, groups: [{ title: "Thiết bị bán hàng", icon: null, items: [{ label: "Máy in hóa đơn", icon: null, href: "/thiet-bi" }], action: null }] } },
    { type: "collection_list", isEnabled: true, data: { source: "posts", eyebrow: null, title: "Tin tức và chia sẻ từ iOrder", description: "Thông tin mới", limit: 3, anchor: null } },
    { type: "lead_form", isEnabled: true, data: { title: "Cần tư vấn triển khai?", description: "Để lại thông tin để được hỗ trợ", submitLabel: "Gửi yêu cầu", needOptions: ["Phần mềm bán hàng", "Thiết bị"] } },
  ] }),
};

export const uxDownload = { id: "10000000-0000-4000-8000-000000000009", fileMediaId: null, icon: "download", title: "Tệp cài đặt có sẵn", description: null, meta: null, sortOrder: 0, isEnabled: false, downloadUrl: null, originalName: null, mimeType: null, draftVersion: 1, archivedAt: null, status: "draft" as const };

// Chỉ dành cho audit giao diện: dữ liệu giả, không đọc .env, DB hoặc S3; mọi mutation bị chặn.
export async function startCmsUxBackend() {
  const pageOf = (url: URL, items: unknown[] = []) => ({ items, page: Number(url.searchParams.get("page") ?? 1), pageSize: Number(url.searchParams.get("pageSize") ?? 25), total: items.length, totalPages: 1 });
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("X-IOrder-UX-Fixture", "1");
    const url = new URL(request.url ?? "/", "http://127.0.0.1:3102");
    const send = (body: unknown) => response.end(JSON.stringify(body));
    if (request.method !== "GET") {
      response.statusCode = 405;
      return send({ error: { code: "FIXTURE_READ_ONLY", message: "Dữ liệu mô phỏng chỉ cho phép đọc." } });
    }
    switch (url.pathname) {
      case "/api/admin/session": {
        const viewOnly = request.headers.cookie?.includes("ux-view-only=1");
        const downloadEditor = request.headers.cookie?.includes("ux-download-editor=1");
        return send({ administrator: { userId: "10000000-0000-4000-8000-000000000001", username: "ux-fixture", fullName: "Kiểm tra giao diện", role: viewOnly || downloadEditor ? "editor" : "admin", permissions: viewOnly ? ["users.view", "roles.view", "settings.view", "supporting.view", "taxonomy.view", "media.view", "redirects.view", "equipment.view", "support_downloads.view"] : downloadEditor ? ["support_downloads.view", "support_downloads.create", "support_downloads.update", "media.view"] : [] } });
      }
      case "/api/admin/notifications": return send({ notifications: [] });
      case "/api/admin/equipment": return send({ equipmentGroups: [] });
      case "/api/admin/support-downloads": return send({ downloads: [request.headers.cookie?.includes("ux-download-published=1") ? { ...uxDownload, isEnabled: true, status: "published" } : uxDownload] });
      case "/api/admin/pages": return send({ page: url.searchParams.get("slug") === "home" ? uxHomePage : null });
      case "/api/public/redirect": return send({ redirect: null });
      case "/api/public/content": {
        switch (url.searchParams.get("resource")) {
          case "shared": return send({ settings: { config: { siteUrl: null, defaultTitle: "iOrder", defaultDescription: "Giải pháp cho doanh nghiệp", defaultOgMediaId: null, allowSearchIndexing: false }, profile: null, externalLinks: null, catalogContent: {}, listingContent: {} }, navigation: { header: [], headerCta: [], footer: [] } });
          case "page": return send({ page: uxHomePage });
          case "partners": return send({ partners: [{ id: "10000000-0000-4000-8000-000000000021", name: "Đối tác kiểm chứng", kind: "partner", logo: null, websiteUrl: "https://example.com", description: null }] });
          case "post-summaries": return send({ posts: [] });
          default: return send({ posts: [], offerings: [], equipment: [], testimonials: [] });
        }
      }
      case "/api/admin/redirects": return send({ redirects: [{ id: "10000000-0000-4000-8000-000000000002", sourcePath: "/duong-dan-cu", destinationPath: "/duong-dan-moi", statusCode: 301, isEnabled: true, version: 1 }] });
      case "/api/admin/users": return send({ result: { ...pageOf(url), counts: { all: 0, active: 0, admins: 0 } }, roles: [{ code: "editor", name: "Biên tập viên", isSystem: false }] });
      case "/api/admin/roles": return send({ roles: [{ id: "10000000-0000-4000-8000-000000000005", code: "editor", name: "Biên tập viên", description: "Vai trò thử nghiệm", isSystem: false, permissions: ["posts.view"], userCount: 0 }], modules: [{ key: "posts", name: "Bài viết", actions: ["view", "create", "update", "delete", "publish"] }], actionLabels: { view: "Xem", create: "Tạo", update: "Sửa", delete: "Xóa", publish: "Xuất bản" } });
      case "/api/admin/taxonomy": return send({ taxonomy: { categories: [{ id: "10000000-0000-4000-8000-000000000006", parentId: null, name: "Chuyên mục có sẵn", slug: "chuyen-muc-co-san", description: null, sortOrder: 0, version: 1 }], tags: [] } });
      case "/api/admin/profile": return send({ profile: null, version: 2 });
      case "/api/admin/external-links": return send({ links: null, version: 3 });
      case "/api/admin/publishing-config": return send({ config: { siteUrl: null, defaultTitle: null, defaultDescription: null, defaultOgMediaId: null, allowSearchIndexing: false }, version: 4 });
      case "/api/admin/supporting": {
        const kind = url.searchParams.get("kind") ?? "partners";
        const items = kind === "partners" && request.headers.cookie?.includes("ux-view-only=1") ? [{ id: "10000000-0000-4000-8000-000000000007", name: "Đối tác có sẵn", kind: "partner", logoMediaId: null, logo: null, description: null, websiteUrl: null, sortOrder: 0, isEnabled: true, version: 1 }] : [];
        return send({ kind, result: pageOf(url, items) });
      }
      case "/api/admin/media": return send({ ...pageOf(url), assets: [], items: undefined });
      case "/api/admin/tim-kiem": return send({ items: [] });
      default: response.statusCode = 404; return send({ error: { code: "FIXTURE_NOT_FOUND", message: "Chưa có dữ liệu mô phỏng cho đường dẫn này." } });
    }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(3102, "127.0.0.1", resolve); });
  return async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); };
}
