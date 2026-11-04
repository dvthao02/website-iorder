"use client";

import { useRouter } from "next/navigation";

import { AdminFilterTabs } from "./admin-filter-tabs";
import { requestNavigationFocus } from "./navigation-focus";

/** Tab chuyển giữa các màn cùng một trang (mỗi tab một URL, ví dụ Người dùng / Vai trò & quyền). Một tab thì không hiện. */
export function AdminRouteTabs<Value extends string>({ ariaLabel, items, value }: { ariaLabel: string; items: { label: string; value: Value; href: string }[]; value: Value }) {
  const router = useRouter();
  if (items.length < 2) return null;
  return <AdminFilterTabs ariaLabel={ariaLabel} items={items} restoreNavigationFocus value={value} onValueChange={(next) => {
    const target = items.find((item) => item.value === next);
    if (!target || next === value) return;
    requestNavigationFocus(target.href);
    router.push(target.href);
  }} />;
}
