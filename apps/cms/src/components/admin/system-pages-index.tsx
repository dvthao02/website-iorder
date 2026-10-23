import Link from "next/link";
import type { ReactNode } from "react";

import { getFixedWebsitePage, isListingPageSlug, type AdminPage } from "@iorder/core/server/pages/pages.contract";
import { listingPageModuleHref, listingPageModuleLabel } from "@/lib/listing-pages";

const statusLabels: Record<AdminPage["status"], string> = { draft: "Bản nháp", review: "Chờ duyệt", scheduled: "Hẹn giờ", published: "Đang hiển thị", archived: "Lưu trữ" };

// Danh mục gọn các trang có sẵn của website (route thuộc code). Không phải màn làm việc chính:
// Trang chủ có mục riêng trên sidebar, trang danh sách sửa từ module, trang khác mở từ Menu.
// Danh mục này giữ cho trang không nằm trên menu (chính sách, điều khoản…) vẫn mở được.
export function SystemPagesIndex({ pages }: { pages: AdminPage[] }) {
  const standard = pages.filter((page) => !isListingPageSlug(page.slug));
  const listing = pages.filter((page) => isListingPageSlug(page.slug));
  const row = (page: AdminPage, note: ReactNode) => <li key={page.id}>
    <Link className="admin-system-pages__link" href={page.slug === "home" ? "/admin/homepage" : `/admin/pages/${page.id}`}><strong>{page.title}</strong><code>{getFixedWebsitePage(page.slug)?.publicPath}</code></Link>
    <span className="admin-system-pages__note">{note}</span>
    <span className={page.status === "published" ? "admin-system-pages__status" : "admin-system-pages__status admin-system-pages__status--off"}>{statusLabels[page.status]}</span>
  </li>;
  return <section aria-labelledby="system-pages-title" className="admin-card admin-system-pages">
    <header><h2 id="system-pages-title">Trang có sẵn của website</h2><p className="admin-help">Đường dẫn cố định trong code; ở đây chỉ sửa nội dung và SEO. Thường mở từ <Link className="admin-link" href="/admin/menu">Menu &amp; Điều hướng</Link> (nút “Sửa nội dung”) hoặc từ module tương ứng.</p></header>
    <div className="admin-system-pages__groups">
      <div><h3>Trang nội dung</h3><ul>{standard.map((page) => row(page, page.slug === "home" ? "Có mục riêng trên sidebar" : null))}</ul></div>
      <div><h3>Trang danh sách</h3><ul>{listing.map((page) => isListingPageSlug(page.slug) ? row(page, <>Danh sách lấy từ <Link className="admin-link" href={listingPageModuleHref[page.slug]}>{listingPageModuleLabel[page.slug]}</Link></>) : null)}</ul></div>
    </div>
  </section>;
}
