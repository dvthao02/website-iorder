import { ChevronDown, ExternalLink, PanelTop, PencilLine } from "lucide-react";

import { getFixedWebsitePage, pagePermissionCodes, type ListingPageSlug } from "@iorder/core/server/pages/pages.contract";
import { hasAnyCmsPermission } from "@iorder/core/server/auth/permissions";
import { getAdminSystemPageBySlug, getRequestAdministrator } from "@/lib/backend";
import { publishedPublicUrl } from "@/lib/published-public-url";

import Link from "next/link";

import { AdminPageBarActions } from "./ui/admin-page-bar";
import { AdminPopover } from "./ui/admin-popover";

// Lối tắt từ màn quản lý module tới trang danh sách public của nó (giống Sanity ghim
// "Blog page" cạnh danh sách bài viết). Nội dung trang nằm trong "Trang website".
// Luôn là một nút menu gọn ("Trang /tin-tuc ▾") để thanh tiêu đề không dàn ba liên kết chữ cạnh các nút.
// Server Component: quyền được kiểm tra tại đây (AdminButton với `permission` chỉ dùng được phía client).
export async function ListingPageShortcut({ slugs }: { slugs: readonly ListingPageSlug[] }) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return null;
  // Chỉ hiện trang người dùng được xem (quyền "Trang website" hoặc module sở hữu); không báo nhầm "chưa tạo".
  const visibleSlugs = slugs.filter((slug) => hasAnyCmsPermission(administrator, pagePermissionCodes(slug, "view")));
  if (!visibleSlugs.length) return null;
  const pages = (await Promise.all(visibleSlugs.map(async (slug) => ({ slug, page: await getAdminSystemPageBySlug(slug) }))))
    .map(({ slug, page }) => ({ slug, page, fixed: getFixedWebsitePage(slug)! }));
  const single = pages.length === 1 ? pages[0] : null;
  const trigger = single ? <>Trang {single.fixed.publicPath}</> : <>Trang danh sách ({pages.length})</>;
  return <AdminPageBarActions><AdminPopover className="admin-create-menu" label="Trang danh sách trên website" trigger={<span className="admin-button admin-button--secondary"><PanelTop aria-hidden="true" size={16} />{trigger}<ChevronDown aria-hidden="true" size={14} /></span>}>
    <div className="admin-header-popover admin-header-popover--menu admin-transfer-menu">
      {pages.map(({ slug, page, fixed }) => {
        const prefix = single ? "" : `${page?.title ?? fixed.label} · `;
        if (!page) return <span className="admin-header-popover__item" key={slug}><strong>{prefix}Trang {fixed.publicPath} chưa sẵn sàng</strong><small>Liên hệ quản trị hệ thống để khởi tạo trang này.</small></span>;
        const canEdit = hasAnyCmsPermission(administrator, pagePermissionCodes(slug, "update"));
        return [
          canEdit
            ? <Link href={`/admin/pages/${page.id}`} key={`${slug}-edit`}><strong><PencilLine aria-hidden="true" size={14} />{prefix}Sửa trang danh sách</strong><small>Tiêu đề, mô tả, bố cục và thông tin Google của trang {fixed.publicPath}</small></Link>
            : <span className="admin-header-popover__item" key={`${slug}-edit`}><strong>{prefix}Chỉ xem</strong><small>Cần quyền sửa để đổi trang {fixed.publicPath}</small></span>,
          page.status === "published"
            ? <a href={publishedPublicUrl(fixed.publicPath)} key={`${slug}-view`} rel="noreferrer" target="_blank"><strong><ExternalLink aria-hidden="true" size={14} />{prefix}Xem trên website</strong><small>Mở {fixed.publicPath} ở tab mới</small></a>
            : null,
        ];
      })}
    </div>
  </AdminPopover></AdminPageBarActions>;
}
