import type { NavigationItems, NavigationTarget } from "@iorder/shared/server/navigation/navigation.contract";

// Nơi sửa nội dung mà mục menu trỏ tới (các trang có sẵn không còn mục riêng trên sidebar, nên mở từ đây).
// Liên kết trực tiếp dùng id; đường dẫn tự nhập thì dò theo URL trong các nội dung đã xuất bản,
// rồi tới mẫu đường dẫn của từng module (nội dung chưa xuất bản: mở danh sách đã lọc).
const offeringEditorBase: Record<string, string> = { "Phần mềm": "/admin/products", "Giải pháp": "/admin/solutions", "Dịch vụ": "/admin/services" };
const catalogTypeByPath: Record<string, string> = { "phan-mem": "software", "giai-phap": "solution", "dich-vu": "service" };
export function contentEditHref(item: Pick<NavigationItems[number], "linkType" | "contentId" | "url">, targets: NavigationTarget[]): string | undefined {
  const path = item.url.split("#")[0].split("?")[0].replace(/(.)\/$/, "$1");
  const target = item.linkType !== "custom" ? targets.find((entry) => entry.id === item.contentId && entry.linkType === item.linkType) : targets.find((entry) => entry.url === path);
  if (target) {
    if (target.linkType === "page") return path === "/" ? "/admin/homepage" : `/admin/pages/${target.id}`;
    if (target.linkType === "post") return target.typeLabel === "Hướng dẫn" ? `/admin/guides/${target.id}` : `/admin/news/${target.id}`;
    if (target.linkType === "offering") return `${offeringEditorBase[target.typeLabel] ?? "/admin/products"}/${target.id}`;
    return `/admin/equipment/${target.id}`;
  }
  if (path === "/") return "/admin/homepage";
  const [, section, slug] = path.split("/");
  if (!slug || path.split("/").length > 3) return undefined;
  if (catalogTypeByPath[section]) return `/admin/products?type=${catalogTypeByPath[section]}&query=${encodeURIComponent(slug)}`;
  if (section === "thiet-bi") return `/admin/equipment?query=${encodeURIComponent(slug)}`;
  if (section === "tin-tuc") return `/admin/news?query=${encodeURIComponent(slug)}`;
  return undefined;
}
