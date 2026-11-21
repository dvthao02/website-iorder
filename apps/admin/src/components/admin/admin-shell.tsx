"use client";

import NextImage from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdminToastProvider } from "@/components/admin/ui/admin-feedback";
import { AdminConfirmProvider } from "@/components/admin/ui/admin-confirm-dialog";
import { AdminPermissionsProvider } from "@/components/admin/ui/admin-permissions";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { isActive, navigationGroups, visibleNavigationItems, type NavigationGroup, type NavigationItem } from "@/components/admin/admin-navigation";

import { LogoutButton } from "@/app/admin/(protected)/logout-button";
import { AccountPanel, type AccountTab } from "@/components/admin/account-panel";
import { LazyChristmasBrandDecor, LazyChristmasTopbarDecor } from "@/components/admin/christmas-decor-lazy";
import { AdminAvatar } from "@/components/admin/ui/admin-avatar";
import { AdminIconButton } from "@/components/admin/ui/admin-icon-button";
import { AdminLoadingBar } from "@/components/admin/ui/admin-loading-bar";
import { AdminPopover } from "@/components/admin/ui/admin-popover";
import { usePopoverDismiss } from "@/components/admin/ui/use-popover-dismiss";
import { adminPageBarActionsId, adminPageBarMetaId } from "@/components/admin/ui/admin-page-bar";
import { AdminVersionConflictBanner } from "@/components/admin/ui/admin-version-conflict";
import { CmsThemeProvider } from "@/components/admin/admin-theme-settings";
import { AdminGlobalSearch } from "@/components/admin/admin-global-search";
import { useWebsiteUrl } from "./website-origin-context";
import { hasCmsPermission } from "@iorder/shared/server/auth/permissions";

type Administrator = { fullName: string; username: string; email?: string | null; phone?: string | null; avatarUrl?: string | null; role: string; roleName?: string | null; permissions: string[] };
type HeaderNotification = { id: string; label: string; detail: string; href: string };

// Màn chỉnh sửa (tạo mới hoặc theo id) có header riêng kèm nút lưu/đóng nên không dùng thanh vị trí chung.
function isEditorRoute(pathname: string) {
  return pathname === "/admin/homepage" || /\/(moi|new)$/.test(pathname) || /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname) || pathname.startsWith("/admin/equipment/groups");
}

// Màn không thuộc mục nào của thanh bên. Màn con có trang cha kèm liên kết quay về (mục cuối là màn đang mở).
const extraPageCrumbs: Record<string, Array<{ label: string; href?: string }>> = {
  "/admin/appearance": [{ label: "Giao diện CMS" }],
  "/admin/forbidden": [{ label: "Không có quyền truy cập" }],
};

// Chỉ tên trang (kèm trang cha khi đang ở trang con, có link quay về); tên nhóm thanh bên không lặp lại ở đây.
function pageBarCrumbs(pathname: string, current: { group: NavigationGroup; item: NavigationItem } | undefined): Array<{ label: string; href?: string }> {
  if (current) {
    const subPage = current.item.subPages?.find((page) => page.label && pathname === page.href);
    const itemCrumb = { label: current.item.label, href: pathname === current.item.href ? undefined : current.item.href };
    return subPage?.label ? [itemCrumb, { label: subPage.label }] : [itemCrumb];
  }
  return extraPageCrumbs[pathname] ?? [{ label: "iOrder CMS" }];
}

// Menu thả xuống dựng bằng <details>: bấm một mục trong menu thì đóng menu, kể cả khi mục đó trỏ về chính trang đang mở
// (khi đó đường dẫn không đổi nên usePopoverDismiss không tự đóng).
function closeMenu(event: { currentTarget: HTMLElement }) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

// Tài khoản cá nhân là panel trượt (AccountPanel), không còn là trang. Hai đường dẫn cũ vẫn mở được (dấu trang, liên kết cũ):
// mở panel đúng tab rồi chuyển về /admin.
function legacyAccountTab(pathname: string): AccountTab | null {
  if (pathname === "/admin/my-account") return "profile";
  if (pathname === "/admin/my-account/password") return "password";
  return null;
}

export function AdminShell({ administrator, children, notifications }: { administrator: Administrator; children: ReactNode; notifications: HeaderNotification[] }) {
  const pathname = usePathname();
  const websiteUrl = useWebsiteUrl();
  const router = useRouter();
  usePopoverDismiss();
  const [accountTab, setAccountTab] = useState<AccountTab | null>(null);
  const pathAccountTab = legacyAccountTab(pathname);
  const [openedForPath, setOpenedForPath] = useState<string | null>(null);
  if (pathAccountTab && openedForPath !== pathname) { setOpenedForPath(pathname); setAccountTab(pathAccountTab); }
  else if (!pathAccountTab && openedForPath !== null) setOpenedForPath(null);
  useEffect(() => { if (pathAccountTab) router.replace("/admin"); }, [pathAccountTab, router]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileNavigationPath, setMobileNavigationPath] = useState<string | null>(null);
  const isMobileNavigationOpen = mobileNavigationPath === pathname;
  const [collapsedNavigationGroups, setCollapsedNavigationGroups] = useState<Set<string>>(() => new Set());
  const [sidebarTooltip, setSidebarTooltip] = useState<{ label: string; top: number } | null>(null);
  // Thanh dọc đánh dấu mục đang chọn: trượt tới mục mới (ngay khi bấm, rồi theo trang thật sự mở). Đặt vị trí bằng
  // style trực tiếp (không qua state) vì chỉ là hiệu ứng; ẩn khi thanh bên thu gọn hoặc nhóm chứa mục đang gập.
  const navigationRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  function placeIndicator(link: HTMLElement | null) {
    const nav = navigationRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    if (!link || isSidebarCollapsed || link.closest("[hidden]") || !link.offsetHeight) { delete indicator.dataset.visible; return; }
    const top = link.getBoundingClientRect().top - nav.getBoundingClientRect().top;
    indicator.style.transform = `translateY(${top}px)`;
    indicator.style.height = `${link.offsetHeight}px`;
    indicator.dataset.visible = "";
    // Lần đầu đặt thẳng vào chỗ (không trượt từ đầu thanh bên); từ đó mới bật chuyển động.
    if (!("ready" in indicator.dataset)) requestAnimationFrame(() => { indicator.dataset.ready = ""; });
  }
  useEffect(() => {
    const nav = navigationRef.current;
    if (!nav) return;
    const update = () => placeIndicator(nav.querySelector<HTMLElement>(".admin-navigation__link--active"));
    update();
    // Nhóm phía trên mở/gập, cỡ chữ đổi… làm mục đang chọn dịch chỗ: đo lại.
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => observer.disconnect();
  });
  const currentNavigation = navigationGroups
    .flatMap((group) => visibleNavigationItems(administrator, group.items)
      .map((item) => ({ group, item })))
    .find(({ item }) => isActive(pathname, item));

  // Mở trang thuộc nhóm đang gập (từ ô tìm kiếm, liên kết trong trang, nút Quay lại) thì mở nhóm đó ra, kẻo mục đang chọn bị giấu. Chỉ làm một lần cho mỗi
  // trang: người dùng gập nhóm lại khi vẫn ở trang đó thì được giữ nguyên.
  const [expandedForPath, setExpandedForPath] = useState<string | null>(null);
  const activeGroupId = currentNavigation?.group.id;
  if (activeGroupId && expandedForPath !== pathname) {
    setExpandedForPath(pathname);
    if (collapsedNavigationGroups.has(activeGroupId)) setCollapsedNavigationGroups((current) => { const next = new Set(current); next.delete(activeGroupId); return next; });
  }

  function toggleMobileNavigation() {
    if (!isMobileNavigationOpen) {
      const activeGroupId = currentNavigation?.group.id;
      setIsSidebarCollapsed(false);
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

  // Thanh bên thu gọn hay mở rộng đều giữ cùng cấu trúc nhóm: bấm nút nhóm thì gập/mở nhóm đó.
  function openNavigationGroup(groupId: string) {
    toggleNavigationGroup(groupId);
  }

  function showSidebarTooltip(label: string, target: HTMLElement) {
    if (!isSidebarCollapsed) return;
    const rect = target.getBoundingClientRect();
    setSidebarTooltip({ label, top: rect.top + rect.height / 2 });
  }

  const notificationCount = notifications.length;
  // Lối tắt "Kiểm tra xuất bản" cùng quyền với mục trên thanh bên (settings.view), không dẫn người khác tới trang cấm.
  const canCheckPublishing = hasCmsPermission(administrator, "settings.view");

  return <AdminToastProvider><AdminPermissionsProvider actor={administrator}><AdminConfirmProvider><CmsThemeProvider><AdminLoadingBar />
    <div className={["admin-shell", isSidebarCollapsed ? "admin-shell--collapsed" : "", isMobileNavigationOpen ? "admin-shell--mobile-navigation-open" : ""].filter(Boolean).join(" ")}>
      <header className="admin-topbar">
        <button aria-controls="admin-mobile-navigation" aria-expanded={isMobileNavigationOpen} aria-label={isMobileNavigationOpen ? "Đóng điều hướng" : "Mở điều hướng"} className="admin-mobile-navigation-toggle" onClick={toggleMobileNavigation} type="button">
          {isMobileNavigationOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}
        </button>
        <AdminGlobalSearch />
        <LazyChristmasTopbarDecor />
        <a aria-label="Xem website (mở trong tab mới)" className="admin-topbar__view-site" href={websiteUrl("/")} rel="noreferrer" target="_blank"><span>Xem website</span><ExternalLink aria-hidden="true" size={14} /></a>
        <div className="admin-topbar__account">
          <AdminPopover
            className="admin-notifications"
            label={notificationCount > 0 ? `Xem thông báo, ${notificationCount} việc cần xử lý` : "Xem thông báo"}
            trigger={<>
              <Bell aria-hidden="true" className="admin-notifications__icon" size={18} />
              {notificationCount > 0 ? <b aria-hidden="true">{notificationCount > 9 ? "9+" : notificationCount}</b> : null}
            </>}
          >
            <div className="admin-header-popover admin-header-popover--notifications">
              <header><strong>Việc cần xử lý</strong>{canCheckPublishing ? <Link href="/admin/seo/publish-check">Kiểm tra xuất bản</Link> : null}</header>
              {notificationCount > 0
                ? <div>{notifications.map(item => <Link href={item.href} key={item.id}><strong>{item.label}</strong><small>{item.detail}</small></Link>)}</div>
                : <div className="admin-notifications__empty"><CircleCheck aria-hidden="true" size={22} /><strong>Không có việc cần xử lý</strong><small>Không có liên hệ mới, nội dung chờ duyệt hay cảnh báo hệ thống.</small></div>}
            </div>
          </AdminPopover>
          <AdminPopover
            className="admin-account-menu"
            label="Mở menu tài khoản"
            trigger={<>
              <AdminAvatar avatarUrl={administrator.avatarUrl} fullName={administrator.fullName} size={32} />
              <span><strong>{administrator.fullName}</strong><small>{administrator.roleName ?? administrator.role}</small></span>
              <ChevronDown aria-hidden="true" className="admin-account-menu__chevron" size={16} />
            </>}
          >
            <div className="admin-header-popover admin-header-popover--account">
              <button className="admin-account-menu__identity" onClick={(event) => { closeMenu(event); setAccountTab("profile"); }} type="button">
                <AdminAvatar avatarUrl={administrator.avatarUrl} fullName={administrator.fullName} size={36} />
                <span><strong>{administrator.fullName}</strong><small>{administrator.email || administrator.username}</small></span>
              </button>
              <button onClick={(event) => { closeMenu(event); setAccountTab("profile"); }} type="button">Thông tin cá nhân</button>
              <button onClick={(event) => { closeMenu(event); setAccountTab("password"); }} type="button">Đổi mật khẩu</button>
              <Link href="/admin/appearance" onClick={closeMenu}>Giao diện CMS</Link>
              <div><LogoutButton /></div>
            </div>
          </AdminPopover>
        </div>
      </header>
      <AccountPanel administrator={administrator} onClose={() => setAccountTab(null)} onTabChange={setAccountTab} tab={accountTab} />

      <div className="admin-shell__body">
        <aside className="admin-sidebar" id="admin-mobile-navigation">
          <Link aria-label="Trang tổng quan iOrder CMS" className="admin-brand" href="/admin">
            <NextImage alt="iOrder" className="admin-brand__logo admin-brand__logo--full" height={47} preload src="/brand/iorder-logo-dark.png" width={140} />
            <span className="admin-brand__edition">CMS</span>
            <LazyChristmasBrandDecor />
            <NextImage alt="" aria-hidden="true" className="admin-brand__logo admin-brand__logo--mark" height={42} preload src="/brand/iorder-logo-mark-dark.png" width={42} />
          </Link>
          <AdminIconButton
            aria-expanded={!isSidebarCollapsed}
            aria-label={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            className="admin-sidebar-toggle"
            onClick={() => { setIsSidebarCollapsed(value => !value); setSidebarTooltip(null); }}
          >
            {isSidebarCollapsed ? <ChevronRight aria-hidden="true" size={18} /> : <ChevronLeft aria-hidden="true" size={18} />}
          </AdminIconButton>
          <div className="admin-sidebar__scroll">
          <nav aria-label="Điều hướng quản trị" className="admin-navigation" onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const link = event.target instanceof Element ? event.target.closest<HTMLElement>(".admin-navigation__link") : null;
            if (link) placeIndicator(link);
          }} ref={navigationRef}>
            <span aria-hidden="true" className="admin-navigation__indicator" ref={indicatorRef} />
            {navigationGroups.map(group => {
              const items = visibleNavigationItems(administrator, group.items);
              if (!items.length) return null;
              const isGroupCollapsed = collapsedNavigationGroups.has(group.id);
              const GroupIcon = group.icon;
              const groupClassName = [
                "admin-navigation__group",
                isGroupCollapsed ? "admin-navigation__group--collapsed" : "",
              ].filter(Boolean).join(" ");
              return <section className={groupClassName} key={group.id}>
                <button
                  aria-controls={`admin-navigation-group-${group.id}`}
                  aria-expanded={!isGroupCollapsed}
                  aria-label={isSidebarCollapsed ? `${isGroupCollapsed ? "Mở" : "Gập"} nhóm ${group.label}` : undefined}
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
                <div className="admin-navigation__items" hidden={isGroupCollapsed} id={`admin-navigation-group-${group.id}`}>
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
          {isEditorRoute(pathname) ? null : <div className="admin-page-bar admin-panel-header">
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
