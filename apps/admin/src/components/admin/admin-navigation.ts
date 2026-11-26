import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  DatabaseBackup,
  Download,
  FileText,
  FolderTree,
  Globe,
  History,
  Home,
  Image,
  KeyRound,
  Laptop,
  Languages,
  LayoutDashboard,
  LayoutTemplate,
  Link as LinkIcon,
  Mail,
  Menu,
  MessageSquareText,
  Megaphone,
  Newspaper,
  Package,
  PanelsTopLeft,
  SearchCheck,
  Settings2,
  ShieldCheck,
  Star,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { hasAnyCmsPermission, hasCmsPermission, isSuperAdmin, type CmsActor, type CmsPermissionCode } from "@iorder/shared/server/auth/permissions";

// Mô hình thanh điều hướng của CMS: một nguồn duy nhất cho thanh bên, thanh vị trí và mọi nơi cần biết "người này mở được trang đó không"
// (ví dụ lối tắt ở màn Tình trạng hệ thống). Không phụ thuộc React/trình duyệt nên test được trực tiếp.

// `permission` may list several codes: the item shows when the user has any of them.
// `subPages`: màn thuộc về mục này nhưng không có dòng riêng trên sidebar; vẫn làm sáng mục và thêm nhãn vào thanh vị trí.
// `fallback`: người không có quyền của mục nhưng có quyền vào một màn con thì thấy mục trỏ thẳng tới màn con đó.
export type NavigationItem = { href: string; label: string; icon: LucideIcon; matchesChildRoutes?: boolean; permission?: CmsPermissionCode | CmsPermissionCode[]; superAdminOnly?: boolean; subPages?: Array<{ href: string; label?: string }>; fallback?: { href: string; label: string; permission: CmsPermissionCode } };

export type NavigationGroup = { id: string; label: string; icon: LucideIcon; items: NavigationItem[] };

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

export const navigationGroups = ensureUniqueNavigationPaths([
  // Thứ tự theo công việc của người vận hành: việc cần xử lý và theo dõi → nội dung website (gồm cả sản phẩm, thiết bị, tệp cài đặt, đối tác)
  // → cấu trúc website (menu, chuyển hướng, cửa sổ hiện trên trang) → cài đặt website (thông tin, tên miền, liên kết) → hệ thống.
  // Theo dõi hiệu quả (thống kê truy cập, Google Search Console, kiểm tra trước xuất bản) nằm chung một chỗ; cài đặt không lẫn với cấu trúc.
  { id: "work", label: "Công việc", icon: LayoutDashboard, items: [
    { href: "/admin", label: "Bảng điều khiển", icon: Home },
    { href: "/admin/leads", label: "Khách hàng tiềm năng", icon: UsersRound, permission: "leads.view" },
    { href: "/admin/analytics", label: "Thống kê truy cập", icon: BarChart3, permission: "dashboard.view" },
    { href: "/admin/search-console", label: "Google Search Console", icon: SearchCheck, permission: "settings.view" },
    { href: "/admin/seo/publish-check", label: "Kiểm tra trước xuất bản", icon: ClipboardCheck, permission: "settings.view" },
  ] },
  {
    id: "content",
    label: "Nội dung website",
    icon: FileText,
    items: [
      { href: "/admin/homepage", label: "Trang chủ", icon: LayoutTemplate, permission: "pages.view" },
      { href: "/admin/pages", label: "Trang website", icon: PanelsTopLeft, matchesChildRoutes: true, permission: "pages.view" },
      { href: "/admin/news", label: "Bài viết & Tin tức", icon: Newspaper, matchesChildRoutes: true, permission: "posts.view", subPages: [{ href: "/admin/taxonomy", label: "Chuyên mục & Thẻ" }, { href: "/admin/authors", label: "Tác giả" }], fallback: { href: "/admin/taxonomy", label: "Chuyên mục & Thẻ", permission: "taxonomy.view" } },
      { href: "/admin/guides", label: "Hướng dẫn sử dụng", icon: BookOpen, matchesChildRoutes: true, permission: "posts.view" },
      { href: "/admin/products", label: "Sản phẩm & Giải pháp", icon: Package, matchesChildRoutes: true, permission: "offerings.view", subPages: [{ href: "/admin/solutions" }] },
      { href: "/admin/equipment", label: "Thiết bị", icon: Laptop, matchesChildRoutes: true, permission: "equipment.view" },
      { href: "/admin/resources", label: "Tệp cài đặt", icon: Download, matchesChildRoutes: true, permission: "support_downloads.view" },
      { href: "/admin/partners", label: "Đối tác & Đánh giá", icon: Star, permission: "supporting.view" },
      { href: "/admin/media", label: "Thư viện hình ảnh & tệp", icon: Image, permission: "media.view" },
    ],
  },
  {
    id: "structure",
    label: "Cấu trúc website",
    icon: FolderTree,
    items: [
      { href: "/admin/menu", label: "Menu & Điều hướng", icon: Menu, permission: "navigation.view" },
      { href: "/admin/redirects", label: "Chuyển hướng URL", icon: ArrowRightLeft, permission: "redirects.view" },
      { href: "/admin/consult-popup", label: "Biểu mẫu tư vấn", icon: MessageSquareText, permission: "settings.view" },
      { href: "/admin/promotion-popup", label: "Quảng cáo", icon: Megaphone, permission: "settings.view" },
    ],
  },
  {
    id: "settings",
    label: "Cài đặt website",
    icon: Settings2,
    items: [
      { href: "/admin/company-profile", label: "Thông tin doanh nghiệp", icon: Building2, permission: "settings.view" },
      { href: "/admin/seo", label: "Tên miền & SEO", icon: Globe, permission: "settings.view" },
      { href: "/admin/external-links", label: "Liên kết & Mạng xã hội", icon: LinkIcon, permission: "settings.view" },
      { href: "/admin/translations", label: "Đa ngôn ngữ", icon: Languages, permission: "settings.view" },
    ],
  },
  {
    id: "system",
    label: "Hệ thống",
    icon: ShieldCheck,
    items: [
      // Vận hành (xem tình trạng rồi đến sao lưu), truy cập và kiểm soát (người dùng, nhật ký), cuối cùng là khóa kết nối chỉ Super Admin dùng.
      { href: "/admin/system", label: "Tình trạng hệ thống", icon: Activity, permission: "system.view" },
      { href: "/admin/backup", label: "Sao lưu & phục hồi", icon: DatabaseBackup, permission: "system.view" },
      { href: "/admin/users", label: "Người dùng & vai trò", icon: Users, permission: ["users.view", "roles.view"] },
      { href: "/admin/audit-log", label: "Nhật ký hoạt động", icon: History, permission: "audit.view" },
      { href: "/admin/integrations", label: "Kết nối & khóa API", icon: KeyRound, superAdminOnly: true },
      { href: "/admin/integrations/gmail", label: "Gmail báo liên hệ", icon: Mail, matchesChildRoutes: true, superAdminOnly: true },
    ],
  },
]);

export function matchesPath(pathname: string, href: string, childRoutes: boolean) {
  return pathname === href || (childRoutes && pathname.startsWith(`${href}/`));
}

export function isActive(pathname: string, item: NavigationItem) {
  return matchesPath(pathname, item.href, item.matchesChildRoutes === true) || (item.subPages ?? []).some((page) => matchesPath(pathname, page.href, item.matchesChildRoutes === true));
}

export function canAccessNavigation(administrator: CmsActor, item: NavigationItem) {
  if (item.superAdminOnly) return isSuperAdmin(administrator);
  if (!item.permission) return true;
  return Array.isArray(item.permission) ? hasAnyCmsPermission(administrator, item.permission) : hasCmsPermission(administrator, item.permission);
}

export function visibleNavigationItems(administrator: CmsActor, items: NavigationItem[]): NavigationItem[] {
  return items.flatMap((item) => {
    if (canAccessNavigation(administrator, item)) return [item];
    const fallback = item.fallback;
    return fallback && hasCmsPermission(administrator, fallback.permission) ? [{ href: fallback.href, label: fallback.label, icon: item.icon, permission: fallback.permission }] : [];
  });
}

/**
 * Người này có mở được trang `href` không (theo đúng quyền hiển thị mục đó trên thanh bên)? Dùng để ẩn lối tắt dẫn tới trang bị chặn
 * thay vì để người dùng bấm rồi nhận "Không có quyền". Đường dẫn không thuộc mục nào thì coi là mở được (không ẩn nhầm).
 */
export function canOpenAdminPath(administrator: CmsActor, href: string) {
  const path = href.split(/[?#]/)[0];
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (item.href === path) return canAccessNavigation(administrator, item);
      if (item.fallback?.href === path) return canAccessNavigation(administrator, item) || hasCmsPermission(administrator, item.fallback.permission);
      if (item.subPages?.some((page) => page.href === path)) return canAccessNavigation(administrator, item);
    }
  }
  return true;
}
