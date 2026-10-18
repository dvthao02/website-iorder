import Link from "next/link";

export type SupportCenterTab = "downloads" | "guides";

type SupportCenterTabsProps = {
  active: SupportCenterTab;
  showDownloads: boolean;
  showGuides: boolean;
};

const tabs: Array<{ value: SupportCenterTab; label: string; href: string }> = [
  { value: "downloads", label: "Tệp cài đặt", href: "/admin/tai-nguyen" },
  { value: "guides", label: "Hướng dẫn", href: "/admin/tai-nguyen?tab=guides" },
];

// Trang "Hỗ trợ cài đặt" gom hai nguồn dữ liệu hiển thị chung ở /ho-tro/cai-dat:
// tệp tải về (support_downloads) và bài hướng dẫn (posts type=guide).
export function SupportCenterTabs({ active, showDownloads, showGuides }: SupportCenterTabsProps) {
  const visible = tabs.filter((tab) => tab.value === "downloads" ? showDownloads : showGuides);
  if (visible.length < 2) return null;
  return <nav aria-label="Nội dung hỗ trợ cài đặt" className="admin-view-tabs">
    {visible.map((tab) => <Link aria-current={tab.value === active ? "page" : undefined} className={tab.value === active ? "admin-view-tabs__tab admin-view-tabs__tab--active" : "admin-view-tabs__tab"} href={tab.href} key={tab.value}>{tab.label}</Link>)}
  </nav>;
}
