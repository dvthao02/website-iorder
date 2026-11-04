"use client";

import NextImage from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminToastProvider } from "@/components/admin/ui/admin-feedback";
import { AdminConfirmProvider } from "@/components/admin/ui/admin-confirm-dialog";
import { AdminPermissionsProvider } from "@/components/admin/ui/admin-permissions";
import {
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  FolderTree,
  Globe,
  Handshake,
  History,
  Home,
  Image,
  Laptop,
  LayoutDashboard,
  LayoutTemplate,
  Link as LinkIcon,
  Menu,
  Newspaper,
  Package,
  PanelsTopLeft,
  Settings,
  ShieldCheck,
  Star,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { LogoutButton } from "@/app/admin/(protected)/logout-button";
import { AdminIconButton } from "@/components/admin/ui/admin-icon-button";
import { AdminLoadingBar } from "@/components/admin/ui/admin-loading-bar";
import { AdminPopover } from "@/components/admin/ui/admin-popover";
import { usePopoverDismiss } from "@/components/admin/ui/use-popover-dismiss";
import { adminPageBarActionsId, adminPageBarMetaId } from "@/components/admin/ui/admin-page-bar";
import { AdminVersionConflictBanner } from "@/components/admin/ui/admin-version-conflict";
import { CmsThemeProvider } from "@/components/admin/admin-theme-settings";
import { AdminGlobalSearch } from "@/components/admin/admin-global-search";
import { publishedPublicUrl } from "@/lib/published-public-url";
import { hasAnyCmsPermission, hasCmsPermission, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";

type Administrator = { fullName: string; username: string; role: string; roleName?: string | null; permissions: string[] };
type HeaderNotification = { id: string; label: string; detail: string; href: string };

// `permission` may list several codes: the item shows when the user has any of them.
// `subPages`: màn thuộc về mục này nhưng không có dòng riêng trên sidebar; vẫn làm sáng mục và thêm nhãn vào thanh vị trí.
// `fallback`: người không có quyền của mục nhưng có quyền vào một màn con thì thấy mục trỏ thẳng tới màn con đó.
type NavigationItem = { href: string; label: string; icon: LucideIcon; matchesChildRoutes?: boolean; permission?: CmsPermissionCode | CmsPermissionCode[]; subPages?: Array<{ href: string; label?: string }>; fallback?: { href: string; label: string; permission: CmsPermissionCode } };

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
  // Thứ tự theo tần suất dùng: việc nội dung hằng ngày ở trên, quản trị hệ thống rồi cài đặt ở dưới cùng.
  // Mọi loại nội dung chung một nhóm: cấu trúc website (đường dẫn, menu) do admin đặt trong CMS nên sidebar không tách theo nó.
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard, items: [{ href: "/admin", label: "Tổng quan", icon: Home }, { href: "/admin/analytics", label: "Thống kê truy cập", icon: BarChart3, permission: "dashboard.view" }] },
  {
    id: "content",
    label: "Nội dung",
    icon: FileText,
    items: [
      { href: "/admin/homepage", label: "Trang chủ", icon: LayoutTemplate, permission: "pages.view" },
      { href: "/admin/news", label: "Bài viết & Tin tức", icon: Newspaper, matchesChildRoutes: true, permission: "posts.view", subPages: [{ href: "/admin/taxonomy", label: "Chuyên mục & Thẻ" }], fallback: { href: "/admin/taxonomy", label: "Chuyên mục & Thẻ", permission: "taxonomy.view" } },
      { href: "/admin/products", label: "Sản phẩm & Dịch vụ", icon: Package, matchesChildRoutes: true, permission: "offerings.view", subPages: [{ href: "/admin/solutions" }, { href: "/admin/services" }] },
      { href: "/admin/equipment", label: "Thiết bị", icon: Laptop, matchesChildRoutes: true, permission: "equipment.view" },
      { href: "/admin/partners", label: "Đối tác & Đánh giá", icon: Star, permission: "supporting.view" },
      { href: "/admin/resources", label: "Hỗ trợ cài đặt", icon: Download, matchesChildRoutes: true, permission: "support_downloads.view" },
      { href: "/admin/guides", label: "Hướng dẫn sử dụng", icon: BookOpen, matchesChildRoutes: true, permission: "posts.view" },
      { href: "/admin/media", label: "Thư viện media", icon: Image, permission: "media.view" },
    ],
  },
  {
    id: "customers",
    label: "Khách hàng",
    icon: Handshake,
    items: [
      { href: "/admin/leads", label: "Khách hàng tiềm năng", icon: UsersRound, permission: "leads.view" },
    ],
  },
  {
    id: "structure",
    label: "Cấu trúc website",
    icon: FolderTree,
    items: [
      { href: "/admin/menu", label: "Menu & Điều hướng", icon: Menu, permission: "navigation.view" },
      { href: "/admin/pages", label: "Trang tự tạo", icon: PanelsTopLeft, matchesChildRoutes: true, permission: "pages.view" },
      { href: "/admin/redirects", label: "Chuyển hướng URL", icon: ArrowRightLeft, permission: "redirects.view" },
      { href: "/admin/seo/publish-check", label: "Kiểm tra xuất bản", icon: ClipboardCheck, permission: "settings.view" },
    ],
  },
  {
    id: "administration",
    label: "Quản trị hệ thống",
    icon: ShieldCheck,
    items: [
      { href: "/admin/users", label: "Người dùng & vai trò", icon: Users, permission: ["users.view", "roles.view"] },
      { href: "/admin/audit-log", label: "Nhật ký hoạt động", icon: History, permission: "audit.view" },
    ],
  },
  {
    id: "settings",
    label: "Cài đặt website",
    icon: Settings,
    items: [
      { href: "/admin/company-profile", label: "Thông tin doanh nghiệp", icon: Building2, permission: "settings.view" },
      { href: "/admin/seo", label: "Tên miền & SEO", icon: Globe, permission: "settings.view" },
      { href: "/admin/external-links", label: "Liên kết & Mạng xã hội", icon: LinkIcon, permission: "settings.view" },
    ],
  },
]);

function matchesPath(pathname: string, href: string, childRoutes: boolean) {
  return pathname === href || (childRoutes && pathname.startsWith(`${href}/`));
}

function isActive(pathname: string, item: NavigationItem) {
  return matchesPath(pathname, item.href, item.matchesChildRoutes === true) || (item.subPages ?? []).some((page) => matchesPath(pathname, page.href, item.matchesChildRoutes === true));
}

function canAccessNavigation(administrator: Administrator, item: NavigationItem) {
  if (!item.permission) return true;
  return Array.isArray(item.permission) ? hasAnyCmsPermission(administrator, item.permission) : hasCmsPermission(administrator, item.permission);
}

function visibleNavigationItems(administrator: Administrator, items: NavigationItem[]): NavigationItem[] {
  return items.flatMap((item) => {
    if (canAccessNavigation(administrator, item)) return [item];
    const fallback = item.fallback;
    return fallback && hasCmsPermission(administrator, fallback.permission) ? [{ href: fallback.href, label: fallback.label, icon: item.icon, permission: fallback.permission }] : [];
  });
}

// Màn chỉnh sửa (tạo mới hoặc theo id) có header riêng kèm nút lưu/đóng nên không dùng thanh vị trí chung.
function isEditorRoute(pathname: string) {
  return pathname === "/admin/homepage" || /\/(moi|new)$/.test(pathname) || /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname) || pathname.startsWith("/admin/equipment/groups");
}

const extraPageLabels: Record<string, string[]> = { "/admin/appearance": ["Giao diện CMS"], "/admin/my-account": ["Tài khoản của tôi"], "/admin/forbidden": ["Không có quyền truy cập"] };

// Chỉ tên trang (kèm trang cha khi đang ở trang con, có link quay về); tên nhóm thanh bên không lặp lại ở đây.
function pageBarCrumbs(pathname: string, current: { group: NavigationGroup; item: NavigationItem } | undefined): Array<{ label: string; href?: string }> {
  if (current) {
    const subPage = current.item.subPages?.find((page) => page.label && pathname === page.href);
    const itemCrumb = { label: current.item.label, href: pathname === current.item.href ? undefined : current.item.href };
    return subPage?.label ? [itemCrumb, { label: subPage.label }] : [itemCrumb];
  }
  return (extraPageLabels[pathname] ?? ["iOrder CMS"]).map((label) => ({ label }));
}

function initials(fullName: string) {
  return fullName.split(/\s+/).filter(Boolean).slice(-2).map(word => word[0]).join("").toUpperCase() || "AD";
}

export function AdminShell({ administrator, children, notifications }: { administrator: Administrator; children: ReactNode; notifications: HeaderNotification[] }) {
  const pathname = usePathname();
  usePopoverDismiss();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileNavigationPath, setMobileNavigationPath] = useState<string | null>(null);
  const isMobileNavigationOpen = mobileNavigationPath === pathname;
  const [collapsedNavigationGroups, setCollapsedNavigationGroups] = useState<Set<string>>(() => new Set());
  const [compactNavigationGroups, setCompactNavigationGroups] = useState<Set<string>>(() => new Set());
  const [sidebarTooltip, setSidebarTooltip] = useState<{ label: string; top: number } | null>(null);
  // Menu nhóm của thanh bên thu gọn: bấm ra ngoài thanh bên hoặc Esc thì đóng.
  const hasCompactGroupOpen = compactNavigationGroups.size > 0;
  useEffect(() => {
    if (!hasCompactGroupOpen) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key !== "Escape" : event.target instanceof Node && document.querySelector(".admin-sidebar")?.contains(event.target)) return;
      setCompactNavigationGroups(new Set());
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [hasCompactGroupOpen]);
  const currentNavigation = navigationGroups
    .flatMap((group) => visibleNavigationItems(administrator, group.items)
      .map((item) => ({ group, item })))
    .find(({ item }) => isActive(pathname, item));
  const currentNavigationLabel = currentNavigation?.item.label ?? "Tổng quan";

  function toggleMobileNavigation() {
    if (!isMobileNavigationOpen) {
      const activeGroupId = currentNavigation?.group.id;
      setIsSidebarCollapsed(false);
      setCompactNavigationGroups(new Set());
      setCollapsedNavigationGroups(new Set(navigationGroups.filter((group) => group.id !== activeGroupId).map((group) => group.id)));
    }
    setMobileNavigationPath(isMobileNavigationOpen ? null : pathname);
  }

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

    // Thanh bên thu gọn: mỗi lần chỉ mở một nhóm (menu nổi), như các menu thả xuống khác.
    setCompactNavigationGroups(current => current.has(groupId) ? new Set() : new Set([groupId]));
  }

  function showSidebarTooltip(label: string, target: HTMLElement) {
    if (!isSidebarCollapsed) return;
    const rect = target.getBoundingClientRect();
    setSidebarTooltip({ label, top: rect.top + rect.height / 2 });
  }

  return <AdminToastProvider><AdminPermissionsProvider actor={administrator}><AdminConfirmProvider><CmsThemeProvider><AdminLoadingBar />
    <div className={["admin-shell", isSidebarCollapsed ? "admin-shell--collapsed" : "", isMobileNavigationOpen ? "admin-shell--mobile-navigation-open" : ""].filter(Boolean).join(" ")}>
      <header className="admin-topbar">
        <button aria-controls="admin-mobile-navigation" aria-expanded={isMobileNavigationOpen} aria-label={isMobileNavigationOpen ? "Đóng điều hướng" : "Mở điều hướng"} className="admin-mobile-navigation-toggle" onClick={toggleMobileNavigation} type="button">
          {isMobileNavigationOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}
        </button>
        {isSidebarCollapsed ? <div className="admin-topbar__context" title={currentNavigation?.group.label ?? currentNavigationLabel}><span>{currentNavigationLabel}</span></div> : null}
        <AdminGlobalSearch />
        <a className="admin-topbar__view-site" href={publishedPublicUrl("/")} rel="noreferrer" target="_blank">Xem website <span aria-hidden="true">↗</span></a>
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
              <header><strong>Việc cần xử lý</strong><Link href="/admin/seo/publish-check">Kiểm tra xuất bản</Link></header>
              {notifications.length > 0 ? <div>{notifications.map(item => <Link href={item.href} key={item.id}><strong>{item.label}</strong><small>{item.detail}</small></Link>)}</div> : <p>Không có liên hệ mới hay nội dung chờ duyệt.</p>}
            </div>
          </AdminPopover>
          <AdminPopover
            className="admin-account-menu"
            label="Mở menu tài khoản"
            trigger={<>
              <span className="admin-avatar" aria-hidden="true">{initials(administrator.fullName)}</span>
              <span><strong>{administrator.fullName}</strong><small>{administrator.roleName ?? administrator.role}</small></span>
              <i aria-hidden="true">⌄</i>
            </>}
          >
            <div className="admin-header-popover admin-header-popover--account">
              <strong className="admin-account-menu__title">Tài khoản của tôi</strong>
              <Link href="/admin/my-account">Đổi mật khẩu</Link>
              <Link href="/admin/appearance">Giao diện CMS</Link>
              <div><LogoutButton /></div>
            </div>
          </AdminPopover>
        </div>
      </header>

      <div className="admin-shell__body">
        <aside className="admin-sidebar" id="admin-mobile-navigation">
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
              const items = visibleNavigationItems(administrator, group.items);
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
                <div className="admin-navigation__items" hidden={isSidebarCollapsed ? !isCompactGroupOpen : isGroupCollapsed} id={`admin-navigation-group-${group.id}`} onClick={isSidebarCollapsed ? (event) => { if (event.target instanceof Element && event.target.closest("a")) setCompactNavigationGroups(new Set()); } : undefined}>
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
        {isMobileNavigationOpen ? <button aria-label="Đóng điều hướng" className="admin-mobile-navigation-backdrop" onClick={() => setMobileNavigationPath(null)} type="button" /> : null}
        {sidebarTooltip ? <span className="admin-sidebar-tooltip" role="tooltip" style={{ top: sidebarTooltip.top }}>{sidebarTooltip.label}</span> : null}

        <div className="admin-shell__main">
        <div className="admin-shell__content">
          {isEditorRoute(pathname) ? null : <div className="admin-page-bar">
            <div className="admin-page-bar__title">
              <nav aria-label="Vị trí hiện tại" className="admin-page-bar__crumbs">{pageBarCrumbs(pathname, currentNavigation).map((crumb, index, all) => <span aria-current={index === all.length - 1 ? "page" : undefined} key={crumb.label}>{crumb.href && index < all.length - 1 ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}{index < all.length - 1 ? <ChevronRight aria-hidden="true" size={14} /> : null}</span>)}</nav>
              <span className="admin-page-bar__meta" id={adminPageBarMetaId} />
            </div>
            <div className="admin-page-bar__actions" id={adminPageBarActionsId} />
          </div>}
          {/* Vùng cuộn duy nhất của nội dung: thanh tiêu đề trang đứng yên phía trên. */}
          <div className="admin-shell__scroll">
            <AdminVersionConflictBanner />
            {children}
          </div>
        </div>
        </div>
      </div>
    </div>
  </CmsThemeProvider></AdminConfirmProvider></AdminPermissionsProvider></AdminToastProvider>;
}
