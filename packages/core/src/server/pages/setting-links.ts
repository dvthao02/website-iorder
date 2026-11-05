import type { ExternalLinks } from "../settings/external-links.contract";

// Đường dẫn "theo Cài đặt": nút trong nội dung (khối trang, bảng giá) lưu mã `setting:<khóa>` thay cho địa chỉ cứng,
// website đổi sang địa chỉ hiện tại trong Cài đặt > Liên kết ngoài. Đổi địa chỉ đăng ký dùng thử chỉ cần sửa một chỗ.
export const settingLinkOptions = [
  { key: "trial", label: "Đăng ký dùng thử" },
  { key: "appLogin", label: "Đăng nhập ứng dụng" },
] as const satisfies ReadonlyArray<{ key: keyof ExternalLinks; label: string }>;
export type SettingLinkKey = (typeof settingLinkOptions)[number]["key"];

const prefix = "setting:";
// Cài đặt chưa có địa chỉ thì nút dẫn về trang Liên hệ để khách vẫn có lối đi tiếp.
export const settingLinkFallback = "/lien-he";

export const settingLinkHref = (key: SettingLinkKey) => `${prefix}${key}`;
export function settingLinkKey(href: string | null | undefined): SettingLinkKey | null {
  if (!href?.startsWith(prefix)) return null;
  const key = href.slice(prefix.length);
  return settingLinkOptions.some(option => option.key === key) ? key as SettingLinkKey : null;
}

export function resolveSettingHref(href: string, links: ExternalLinks | null | undefined): string {
  if (!href.startsWith(prefix)) return href;
  const key = settingLinkKey(href);
  return (key ? links?.[key] : null) ?? settingLinkFallback;
}

// Đổi mọi trường `href` dạng `setting:` trong dữ liệu khối (kể cả lồng trong mảng/đối tượng); phần còn lại giữ nguyên.
export function resolveSettingLinks<T>(value: T, links: ExternalLinks | null | undefined): T {
  if (Array.isArray(value)) return value.map(item => resolveSettingLinks(item, links)) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, key === "href" && typeof entry === "string" ? resolveSettingHref(entry, links) : resolveSettingLinks(entry, links)])) as T;
}
