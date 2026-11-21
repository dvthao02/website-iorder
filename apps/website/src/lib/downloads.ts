// Logic thuần của danh sách tệp cài đặt (không phụ thuộc React để kiểm thử được).

export type DownloadIcon = "archive" | "document" | "windows" | "mac" | "mobile" | "file";

const iconByExtension: Record<string, DownloadIcon> = {
  zip: "archive", rar: "archive", "7z": "archive", gz: "archive", tar: "archive",
  pdf: "document", doc: "document", docx: "document", xls: "document", xlsx: "document", ppt: "document", pptx: "document",
  exe: "windows", msi: "windows",
  dmg: "mac", pkg: "mac",
  apk: "mobile", ipa: "mobile",
};

/** Loại tệp đoán từ đuôi tệp trong đường dẫn (bỏ query). Link không có đuôi (ví dụ link tải của Google Drive) → tệp chung, không có nhãn. */
export function downloadKind(url: string): { icon: DownloadIcon; label: string | null } {
  let name = "";
  try { name = new URL(url, "https://example.invalid").pathname.split("/").filter(Boolean).at(-1) ?? ""; } catch { return { icon: "file", label: null }; }
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const icon = iconByExtension[extension];
  return icon ? { icon, label: extension.toUpperCase() } : { icon: "file", label: null };
}

/** Tên máy chủ của link ngoài, bỏ "www." (để người dùng biết tệp tải từ đâu). Link sai trả về null. */
export function downloadHost(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, "") || null; } catch { return null; }
}

export type DownloadGroup<T> = { label: string | null; items: T[] };

/**
 * Chia tệp theo "Nhóm" người vận hành đặt trong CMS (ví dụ "Driver trên Windows", "Driver trên macOS"). Nhóm xếp theo thứ tự xuất hiện đầu tiên
 * (tức theo thứ tự tệp trong danh sách), tên nhóm chỉ khác hoa/thường hoặc khoảng trắng được coi là một nhóm. Tệp chưa đặt nhóm vào nhóm "Khác" ở cuối.
 * Không tệp nào có nhóm thì không chia: một danh sách duy nhất, không tiêu đề.
 */
export function groupDownloads<T extends { groupName: string | null }>(items: readonly T[]): DownloadGroup<T>[] {
  const keyOf = (name: string) => name.toLocaleLowerCase("vi");
  const nameOf = (item: T) => item.groupName?.trim() || null;
  const order: string[] = [];
  const labels = new Map<string, string>();
  for (const item of items) {
    const name = nameOf(item);
    if (name && !labels.has(keyOf(name))) { labels.set(keyOf(name), name); order.push(keyOf(name)); }
  }
  if (!order.length) return [{ label: null, items: [...items] }];
  const groups: DownloadGroup<T>[] = order.map(key => ({ label: labels.get(key) ?? key, items: items.filter(item => { const name = nameOf(item); return name !== null && keyOf(name) === key; }) }));
  const rest = items.filter(item => !nameOf(item));
  return rest.length ? [...groups, { label: "Khác", items: rest }] : groups;
}

export type GroupIcon = "windows" | "apple" | "android" | "linux" | "folder";

/** Biểu tượng của nhóm đoán từ tên nhóm (Windows, macOS/iOS, Android, Linux); tên khác dùng biểu tượng thư mục. */
export function groupIcon(label: string): GroupIcon {
  if (/windows/i.test(label)) return "windows";
  if (/\bmac(os)?\b|\bios\b|apple|iphone|ipad/i.test(label)) return "apple";
  if (/android/i.test(label)) return "android";
  if (/linux|ubuntu|debian/i.test(label)) return "linux";
  return "folder";
}
