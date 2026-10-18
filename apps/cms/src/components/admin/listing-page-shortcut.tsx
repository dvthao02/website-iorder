import { ExternalLink, PanelTop } from "lucide-react";

import { getFixedWebsitePage, pagePermissionCodes, type ListingPageSlug } from "@iorder/core/server/pages/pages.contract";
import { hasAnyCmsPermission } from "@iorder/core/server/auth/permissions";
import { getAdminSystemPageBySlug, getRequestAdministrator } from "@/lib/backend";
import { publishedPublicUrl } from "@/lib/published-public-url";

import Link from "next/link";

import { AdminPageBarActions } from "./ui/admin-page-bar";

// Lối tắt từ màn quản lý module tới trang danh sách public của nó (giống Sanity ghim
// "Blog page" cạnh danh sách bài viết). Nội dung trang nằm trong "Trang website".
// Server Component: quyền được kiểm tra tại đây (AdminButton với `permission` chỉ dùng được phía client).
export async function ListingPageShortcut({ slugs }: { slugs: readonly ListingPageSlug[] }) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return null;
  // Chỉ hiện trang người dùng được xem (quyền "Trang website" hoặc module sở hữu); không báo nhầm "chưa tạo".
  const visibleSlugs = slugs.filter((slug) => hasAnyCmsPermission(administrator, pagePermissionCodes(slug, "view")));
  if (!visibleSlugs.length) return null;
  const pages = (await Promise.all(visibleSlugs.map(async (slug) => ({ slug, page: await getAdminSystemPageBySlug(slug) }))))
    .map(({ slug, page }) => ({ slug, page, fixed: getFixedWebsitePage(slug)! }));
  return <AdminPageBarActions><aside aria-label="Trang danh sách trên website" className="admin-page-link">
    <PanelTop aria-hidden="true" size={15} />
    {pages.map(({ slug, page, fixed }) => <span key={slug}>
      <span>Trang danh sách <code>{fixed.publicPath}</code></span>
      {page
        ? hasAnyCmsPermission(administrator, pagePermissionCodes(slug, "update"))
          ? <Link className="admin-link" href={`/admin/pages/${page.id}`}>Sửa phần đầu trang & SEO</Link>
          : <span className="admin-text-muted">Chỉ xem</span>
        : <span className="admin-text-warning">Chưa tạo trang; chạy <code>pnpm db:backfill-listing-pages</code>.</span>}
      {page?.status === "published" ? <a className="admin-link" href={publishedPublicUrl(fixed.publicPath)} rel="noreferrer" target="_blank">Xem <ExternalLink aria-hidden="true" size={13} /></a> : null}
    </span>)}
  </aside></AdminPageBarActions>;
}
