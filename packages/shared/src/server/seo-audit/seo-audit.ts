// Kiểm tra SEO toàn website theo kiểu Yoast/Rank Math/Screaming Frog: so tiêu đề và mô tả mà Google
// thực sự nhận được giữa mọi nội dung đang hiện, để bắt lỗi mà trợ lý SEO từng trang không thấy (trùng lặp).
import { seoTitleLimit } from "../shared/seo";

export type SeoAuditKind = "page" | "post" | "offering" | "equipment";

/** Một URL đang hiện trên website, với tiêu đề/mô tả đã áp quy tắc dự phòng giống publish-web. */
export type SeoAuditEntry = {
  kind: SeoAuditKind;
  id: string;
  /** Loại con: loại bài viết, loại offering; null với trang và thiết bị. */
  type: string | null;
  label: string;
  path: string;
  title: string;
  /** null: website không có mô tả riêng, dùng mô tả mặc định của cả website. */
  description: string | null;
  /** null: loại nội dung không có ảnh bìa riêng (trang dùng ảnh chia sẻ mặc định). */
  hasImage: boolean | null;
};

export type SeoIssueCode = "missing_description" | "duplicate_title" | "duplicate_description" | "title_long" | "description_long" | "description_short" | "missing_image";
export type SeoIssue = { code: SeoIssueCode; message: string };
export type SeoAuditRow = SeoAuditEntry & { issues: SeoIssue[] };
export type SeoAuditResult = { checked: number; rows: SeoAuditRow[] };

export const seoDescriptionMin = 70;
export const seoDescriptionMax = 160;

// Lỗi trùng/thiếu ảnh hưởng thứ hạng nhiều hơn lỗi độ dài, nên xếp trước.
const issueOrder: SeoIssueCode[] = ["duplicate_title", "duplicate_description", "missing_description", "title_long", "description_long", "description_short", "missing_image"];

function normalize(text: string) {
  return text.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
}

function groupBy(entries: readonly SeoAuditEntry[], key: (entry: SeoAuditEntry) => string | null) {
  const groups = new Map<string, SeoAuditEntry[]>();
  for (const entry of entries) {
    const value = key(entry);
    if (!value) continue;
    groups.set(value, [...groups.get(value) ?? [], entry]);
  }
  return groups;
}

function othersOf(group: SeoAuditEntry[] | undefined, entry: SeoAuditEntry) {
  return (group ?? []).filter((other) => other !== entry).map((other) => `${other.label} (${other.path})`);
}

export function auditSeo(entries: readonly SeoAuditEntry[]): SeoAuditResult {
  const titles = groupBy(entries, (entry) => normalize(entry.title));
  const descriptions = groupBy(entries, (entry) => entry.description ? normalize(entry.description) : null);
  const rows = entries.map((entry): SeoAuditRow => {
    const issues: SeoIssue[] = [];
    const sameTitle = othersOf(titles.get(normalize(entry.title)), entry);
    if (sameTitle.length) issues.push({ code: "duplicate_title", message: `Trùng tiêu đề với ${sameTitle.join(", ")}. Google khó phân biệt các trang này.` });
    const description = entry.description?.trim() ?? "";
    if (!description) {
      issues.push({ code: "missing_description", message: "Chưa có mô tả: Google nhận mô tả mặc định của website, giống mọi trang khác chưa có mô tả." });
    } else {
      const sameDescription = othersOf(descriptions.get(normalize(description)), entry);
      if (sameDescription.length) issues.push({ code: "duplicate_description", message: `Trùng mô tả với ${sameDescription.join(", ")}.` });
      if (description.length > seoDescriptionMax) issues.push({ code: "description_long", message: `Mô tả dài ${description.length} ký tự, Google sẽ cắt; nên tối đa ${seoDescriptionMax}.` });
      else if (description.length < seoDescriptionMin) issues.push({ code: "description_short", message: `Mô tả ngắn (${description.length} ký tự); nên ${seoDescriptionMin}–${seoDescriptionMax}.` });
    }
    if (entry.title.length > seoTitleLimit) issues.push({ code: "title_long", message: `Tiêu đề trên Google dài ${entry.title.length} ký tự, sẽ bị cắt; nên tối đa ${seoTitleLimit}.` });
    if (entry.hasImage === false) issues.push({ code: "missing_image", message: "Chưa có ảnh bìa: chia sẻ Facebook/Zalo dùng ảnh mặc định của website." });
    issues.sort((a, b) => issueOrder.indexOf(a.code) - issueOrder.indexOf(b.code));
    return { ...entry, issues };
  });
  const severity = (row: SeoAuditRow) => row.issues.length ? issueOrder.indexOf(row.issues[0].code) : issueOrder.length;
  return {
    checked: entries.length,
    rows: rows.filter((row) => row.issues.length).sort((a, b) => severity(a) - severity(b) || b.issues.length - a.issues.length || a.path.localeCompare(b.path)),
  };
}
