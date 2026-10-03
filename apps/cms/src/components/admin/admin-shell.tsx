"use client";

import NextImage from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AdminToastProvider } from "@/components/admin/ui/admin-feedback";
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FolderTree,
  Handshake,
  History,
  Home,
  Image,
  Laptop,
  LayoutDashboard,
  Link as LinkIcon,
  Lightbulb,
  Menu,
  Newspaper,
  Palette,
  Search,
  Settings,
  Settings2,
  ShieldCheck,
  Tags,
  Users,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { LogoutButton } from "@/app/admin/(protected)/logout-button";
import { AdminIconButton } from "@/components/admin/ui/admin-icon-button";
import { AdminLoadingBar } from "@/components/admin/ui/admin-loading-bar";
import { AdminPopover } from "@/components/admin/ui/admin-popover";
import { CmsThemeProvider } from "@/components/admin/admin-theme-settings";
import { AdminGlobalSearch } from "@/components/admin/admin-global-search";

type Administrator = { fullName: string; username: string; role: string };
type HeaderNotification = { id: string; label: string; detail: string; href: string };

type NavigationItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean; matchesChildRoutes?: boolean };

type NavigationGroup = { id: string; label: string; icon: LucideIcon; items: NavigationItem[] };

function ensureUniqueNavigationPaths(groups: NavigationGroup[]) {
  const assignedPaths = new Map<string, string>();

  for (const group of groups) {
    for (const item of group.items) {
      const existingLabel = assignedPaths.get(item.href);
      if (existingLabel) throw new Error(`Đường dẫn quản trị ${item.href} đang được dùng cho cả “${existingLabel}” và “${item.label}”.`);
      assignedPaths.set(item.href, item.label);
    }
  }

  return groups;
}

const navigationGroups = ensureUniqueNavigationPaths([
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard, items: [{ href: "/admin", label: "Tổng quan", icon: Home }, { href: "/admin/analytics", label: "Thống kê & truy cập", icon: BarChart3 }] },
  {
    id: "content",
    label: "Nội dung website",
    icon: FileText,
    items: [
      { href: "/admin/pages", label: "Trang website", icon: FileText, matchesChildRoutes: true },
      { href: "/admin/tin-tuc", label: "Bài viết & Tin tức", icon: Newspaper, matchesChildRoutes: true },
      { href: "/admin/tai-nguyen", label: "Hỗ trợ cài đặt", icon: Download, matchesChildRoutes: true },
      { href: "/admin/media", label: "Hình ảnh & Tệp", icon: Image },
    ],
  },
  {
    id: "catalog",
    label: "Sản phẩm & Dịch vụ",
    icon: Boxes,
    items: [
      { href: "/admin/san-pham", label: "Sản phẩm", icon: Boxes, matchesChildRoutes: true },
      { href: "/admin/giai-phap", label: "Giải pháp hạ tầng", icon: Lightbulb, matchesChildRoutes: true },
      { href: "/admin/dich-vu", label: "Dịch vụ", icon: Wrench, matchesChildRoutes: true },
      { href: "/admin/thiet-bi", label: "Thiết bị", icon: Laptop, matchesChildRoutes: true },
    ],
  },
  {
    id: "website",
    label: "Website & SEO",
    icon: FolderTree,
    items: [
      { href: "/admin/menu", label: "Menu & Điều hướng", icon: Menu },
      { href: "/admin/phan-loai-bai-viet", label: "Chuyên mục & Thẻ", icon: Tags },
      { href: "/admin/seo", label: "SEO & Xuất bản", icon: Search, matchesChildRoutes: true },
      { href: "/admin/chuyen-huong", label: "Chuyển hướng URL", icon: ArrowRightLeft },
      { href: "/admin/lien-ket-ngoai", label: "Liên kết ngoài", icon: LinkIcon },
    ],
  },
  {
    id: "brand",
    label: "Khách hàng & Thương hiệu",
    icon: Handshake,
    items: [
      { href: "/admin/thong-tin-doanh-nghiep", label: "Thông tin doanh nghiệp", icon: Building2 },
      { href: "/admin/doi-tac", label: "Đối tác & Đánh giá", icon: Handshake },
      { href: "/admin/khach-hang-tiem-nang", label: "Khách hàng tiềm năng", icon: UsersRound },
    ],
  },
  {
    id: "administration",
    label: "Quản trị",
    icon: ShieldCheck,
    items: [
      { href: "/admin/tai-khoan", label: "Người dùng CMS", icon: Users, adminOnly: true },
      { href: "/admin/nhat-ky", label: "Nhật ký hoạt động", icon: History },
    ],
  },
  {
    id: "settings",
    label: "Cài đặt",
    icon: Settings,
    items: [
      { href: "/admin/cau-hinh", label: "Cấu hình website", icon: Settings2 },
      { href: "/admin/giao-dien-cms", label: "Giao diện CMS", icon: Palette },
    ],
  },
]);

function isActive(pathname: string, item: NavigationItem) {
  return pathname === item.href || (item.matchesChildRoutes === true && pathname.startsWith(`${item.href}/`));
}

function initials(fullName: string) {
  return fullName.split(/\s+/).filter(Boolean).slice(-2).map(word => word[0]).join("").toUpperCase() || "AD";
}

export function AdminShell({ administrator, children, notifications }: { administrator: Administrator; children: ReactNode; notifications: HeaderNotification[] }) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [collapsedNavigationGroups, setCollapsedNavigationGroups] = useState<Set<string>>(() => new Set());
  const [compactNavigationGroups, setCompactNavigationGroups] = useState<Set<string>>(() => new Set());
  const [sidebarTooltip, setSidebarTooltip] = useState<{ label: string; top: number } | null>(null);
  const currentNavigation = navigationGroups
    .flatMap((group) => group.items
      .filter((item) => !item.adminOnly || administrator.role === "admin")
      .map((item) => ({ group, item })))
    .find(({ item }) => isActive(pathname, item));
  const currentNavigationLabel = currentNavigation?.item.label ?? "Tổng quan";

  function toggleNavigationGroup(groupId: string) {
    setCollapsedNavigationGroups(current => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function openNavigationGroup(groupId: string) {
    if (!isSidebarCollapsed) {
      toggleNavigationGroup(groupId);
      return;
    }

    setCompactNavigationGroups(current => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function showSidebarTooltip(label: string, target: HTMLElement) {
    if (!isSidebarCollapsed) return;
    const rect = target.getBoundingClientRect();
    setSidebarTooltip({ label, top: rect.top + rect.height / 2 });
  }

  return <AdminToastProvider><CmsThemeProvider><AdminLoadingBar />
    <div className={isSidebarCollapsed ? "admin-shell admin-shell--collapsed" : "admin-shell"}>
      <header className="admin-topbar">
        {isSidebarCollapsed ? <div className="admin-topbar__context" title={currentNavigation?.group.label ?? currentNavigationLabel}><span>{currentNavigationLabel}</span></div> : null}
        <AdminGlobalSearch />
        <Link className="admin-topbar__view-site" href="/" target="_blank">Xem website <span aria-hidden="true">↗</span></Link>
        <div className="admin-topbar__account">
          <AdminPopover
            className="admin-notifications"
            label="Xem thông báo"
            trigger={<>
              <span aria-hidden="true" className="admin-notifications__icon" />
              {notifications.length > 0 ? <b>{notifications.length}</b> : null}
            </>}
          >
            <div className="admin-header-popover admin-header-popover--notifications">
              <header><strong>Việc cần chú ý</strong><Link href="/admin/seo/kiem-tra-xuat-ban">Xem tất cả</Link></header>
              {notifications.length > 0 ? <div>{notifications.map(item => <Link href={item.href} key={item.id}><strong>{item.label}</strong><small>{item.detail}</small></Link>)}</div> : <p>Không có việc cần xử lý từ dữ liệu hiện tại.</p>}
            </div>
          </AdminPopover>
          <AdminPopover
            className="admin-account-menu"
            label="Mở menu tài khoản"
            trigger={<>
              <span className="admin-avatar" aria-hidden="true">{initials(administrator.fullName)}</span>
              <span><strong>{administrator.fullName}</strong><small>{administrator.role === "admin" ? "Quản trị hệ thống" : "Biên tập viên"}</small></span>
              <i aria-hidden="true">⌄</i>
            </>}
          >
            <div className="admin-header-popover admin-header-popover--account">
              <strong className="admin-account-menu__title">Tài khoản quản trị</strong>
              <Link href="/admin/thong-tin-doanh-nghiep">Thông tin doanh nghiệp</Link>
              {administrator.role === "admin" ? <Link href="/admin/tai-khoan">Người dùng CMS</Link> : null}
              <Link href="/admin/nhat-ky">Nhật ký hoạt động</Link>
              <div><LogoutButton /></div>
            </div>
          </AdminPopover>
        </div>
      </header>

      <div className="admin-shell__body">
        <aside className="admin-sidebar">
          <Link aria-label="Trang tổng quan iOrder CMS" className="admin-brand" href="/admin">
            <NextImage alt="iOrder" className="admin-brand__logo admin-brand__logo--full admin-brand__logo--light" height={51} priority src="/brand/iorder-logo.png" width={140} />
            <NextImage alt="iOrder" className="admin-brand__logo admin-brand__logo--full admin-brand__logo--dark" height={47} priority src="/brand/iorder-logo-dark.png" width={140} />
            <span className="admin-brand__edition">CMS</span>
            <NextImage alt="" aria-hidden="true" className="admin-brand__logo admin-brand__logo--mark admin-brand__logo--light" height={42} priority src="/brand/iorder-logo-mark.png" width={42} />
            <NextImage alt="" aria-hidden="true" className="admin-brand__logo admin-brand__logo--mark admin-brand__logo--dark" height={42} priority src="/brand/iorder-logo-mark-dark.png" width={42} />
          </Link>
          <AdminIconButton
            aria-expanded={!isSidebarCollapsed}
            aria-label={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            className="admin-sidebar-toggle"
            onClick={() => { setIsSidebarCollapsed(value => !value); setCompactNavigationGroups(new Set()); setSidebarTooltip(null); }}
          >
            {isSidebarCollapsed ? <ChevronRight aria-hidden="true" size={18} /> : <ChevronLeft aria-hidden="true" size={18} />}
          </AdminIconButton>
          <div className="admin-sidebar__scroll">
          <nav className="admin-navigation" aria-label="Điều hướng quản trị">
            {navigationGroups.map(group => {
              const items = group.items.filter(item => !item.adminOnly || administrator.role === "admin");
              if (!items.length) return null;
              const isGroupCollapsed = collapsedNavigationGroups.has(group.id);
              const isCompactGroupOpen = compactNavigationGroups.has(group.id);
              const GroupIcon = group.icon;
              const groupClassName = [
                "admin-navigation__group",
                isGroupCollapsed ? "admin-navigation__group--collapsed" : "",
                isCompactGroupOpen ? "admin-navigation__group--compact-open" : "",
              ].filter(Boolean).join(" ");
              return <section className={groupClassName} key={group.id}>
                <button
                  aria-controls={`admin-navigation-group-${group.id}`}
                  aria-expanded={isSidebarCollapsed ? isCompactGroupOpen : !isGroupCollapsed}
                  aria-label={isSidebarCollapsed ? `Mở nhóm ${group.label}` : undefined}
                  className="admin-navigation__group-toggle"
                  onClick={() => openNavigationGroup(group.id)}
                  onBlur={() => setSidebarTooltip(null)}
                  onFocus={(event) => showSidebarTooltip(group.label, event.currentTarget)}
                  onMouseEnter={(event) => showSidebarTooltip(group.label, event.currentTarget)}
                  onMouseLeave={() => setSidebarTooltip(null)}
                  type="button"
                >
                  <GroupIcon aria-hidden="true" size={15} />
                  <span>{group.label}</span>
                  <ChevronDown aria-hidden="true" size={14} />
                </button>
                <div className="admin-navigation__items" hidden={isSidebarCollapsed ? !isCompactGroupOpen : isGroupCollapsed} id={`admin-navigation-group-${group.id}`}>
                  {items.map(item => {
                  const active = isActive(pathname, item);
                  const ItemIcon = item.icon;
                  return <Link aria-current={active ? "page" : undefined} aria-label={isSidebarCollapsed ? item.label : undefined} className={active ? "admin-navigation__link admin-navigation__link--active" : "admin-navigation__link"} href={item.href} key={item.href} onBlur={() => setSidebarTooltip(null)} onFocus={(event) => showSidebarTooltip(item.label, event.currentTarget)} onMouseEnter={(event) => showSidebarTooltip(item.label, event.currentTarget)} onMouseLeave={() => setSidebarTooltip(null)}>
                  <span aria-hidden="true" className="admin-navigation__item-icon"><ItemIcon size={16} /></span><span className="admin-navigation__label">{item.label}</span>
                  </Link>;
                  })}
                </div>
              </section>;
            })}
          </nav>
          </div>
        </aside>
        {sidebarTooltip ? <span className="admin-sidebar-tooltip" role="tooltip" style={{ top: sidebarTooltip.top }}>{sidebarTooltip.label}</span> : null}

        <div className="admin-shell__main">
        <div className="admin-shell__content">{children}</div>
        </div>
      </div>
    </div>
  </CmsThemeProvider></AdminToastProvider>;
}
