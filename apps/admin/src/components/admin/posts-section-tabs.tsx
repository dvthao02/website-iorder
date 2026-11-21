"use client";

import { useRouter } from "next/navigation";

import { postsSectionHref, postsSectionLabel, type PostsSectionTab } from "./posts-section";
import { useOptionalAdminPermissions } from "./ui/admin-permissions";
import { AdminFilterTabs } from "./ui/admin-filter-tabs";
import { requestNavigationFocus } from "./ui/navigation-focus";

type PostsSectionTabsProps = {
  active: PostsSectionTab;
  disabled?: boolean;
  /** Tab xử lý ngay trên màn đang mở (không chuyển trang), ví dụ Chuyên mục/Thẻ trong màn Chuyên mục & Thẻ. */
  localTabs?: PostsSectionTab[];
  onLocalSelect?: (tab: PostsSectionTab) => void;
};

/** Hàng tab chung của mục Bài viết & Tin tức: danh sách · Chuyên mục · Thẻ · Tác giả. Tab không đủ quyền thì ẩn. */
export function PostsSectionTabs({ active, disabled, localTabs = [], onLocalSelect }: PostsSectionTabsProps) {
  const router = useRouter();
  const { can } = useOptionalAdminPermissions();
  const tabs: PostsSectionTab[] = ["posts", "categories", "tags", "authors"];
  const items = tabs
    .filter((tab) => tab === "posts" || tab === "authors" ? can("posts.view") : can("taxonomy.view"))
    .map((tab) => ({ label: postsSectionLabel(tab), value: tab }));
  return <AdminFilterTabs<PostsSectionTab> ariaLabel="Nhóm nội dung bài viết" disabled={disabled} items={items} restoreNavigationFocus value={active} onValueChange={(next) => {
    if (next === active) return;
    if (localTabs.includes(next)) { onLocalSelect?.(next); return; }
    const href = postsSectionHref(next);
    requestNavigationFocus(href);
    router.push(href);
  }} />;
}
