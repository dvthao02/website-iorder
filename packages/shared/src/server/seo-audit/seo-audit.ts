// Kiểm tra SEO toàn website theo kiểu Yoast/Rank Math/Screaming Frog: so tiêu đề và mô tả mà Google
// thực sự nhận được giữa mọi nội dung đang hiện, để bắt lỗi mà trợ lý SEO từng trang không thấy (trùng lặp),
// cùng các cấu hình khiến Google bỏ trang (noindex, canonical trỏ đi nơi khác).
import { seoChecks, seoTitleLimit, type PostLikeContent } from "../shared/seo";

export type SeoAuditKind = "page" | "post" | "offering" | "equipment";

/** Một URL đang hiện trên website, với tiêu đề/mô tả đã áp quy tắc dự phòng giống publish-web. */
/** Nội dung thân bài để chấm các mục cần đọc bài (số từ, ảnh trong bài, đề mục, từ khóa). Chỉ dùng khi tính toán, không đưa ra kết quả. */
export type SeoAuditBody = { content: PostLikeContent | null };

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
  /** Ảnh bìa có mô tả thay thế (alt) chưa; null khi không có ảnh bìa để xét. */
  imageHasAlt: boolean | null;
  /** Nội dung đang bật "không cho Google lập chỉ mục" nên không bao giờ hiện trên Google. */
  noindex: boolean;
  /** Canonical do người vận hành nhập; null: website tự dùng chính địa chỉ trang. */
  canonicalUrl: string | null;
  /** Từ khóa chính người biên tập chọn trong trợ lý SEO; null: chưa chọn. */
  focusKeyword: string | null;
  /** Có thì chấm thêm thân bài (hiện chỉ bài viết); không có thì bỏ qua các mục cần đọc bài. */
  body?: SeoAuditBody;
};

export type SeoIssueCode = "noindex" | "canonical_mismatch" | "keyword_conflict" | "missing_description" | "duplicate_title" | "duplicate_description" | "title_long" | "description_long" | "description_short" | "missing_image" | "missing_image_alt" | "content_short" | "body_image_alt" | "no_headings" | "keyword_weak";
export type SeoIssue = { code: SeoIssueCode; message: string };
/** Điểm SEO của một nội dung: số mục đạt trên tổng số mục áp dụng cho loại nội dung đó. */
export type SeoScore = { passed: number; total: number };
export type SeoAuditRow = Omit<SeoAuditEntry, "body"> & { issues: SeoIssue[]; score: SeoScore };
/** `rows`: nội dung có vấn đề; `healthy`: nội dung không có vấn đề nào (`issues` rỗng), vẫn hiện kèm điểm để biết trang nào đã tốt. */
export type SeoAuditResult = { checked: number; rows: SeoAuditRow[]; healthy: SeoAuditRow[] };

export const seoDescriptionMin = 70;
export const seoDescriptionMax = 160;

// Lỗi làm trang biến mất khỏi Google xếp đầu; lỗi trùng/thiếu ảnh hưởng thứ hạng nhiều hơn lỗi độ dài.
const issueOrder: SeoIssueCode[] = ["noindex", "canonical_mismatch", "duplicate_title", "duplicate_description", "keyword_conflict", "missing_description", "title_long", "description_long", "description_short", "missing_image", "missing_image_alt", "content_short", "no_headings", "body_image_alt", "keyword_weak"];

// Mục của trợ lý SEO từng trang không suy ra được từ dữ liệu kiểm toàn site: tóm tắt riêng (đã tính vào mô tả) và ảnh bìa của loại nội dung không có ảnh bìa.
function scoreChecks(entry: SeoAuditEntry) {
  const slug = entry.path.split("/").filter(Boolean).pop() ?? "";
  const skip = new Set(["excerpt", ...entry.hasImage === null ? ["cover"] : [], ...entry.kind === "page" ? ["slug"] : [], ...entry.body ? [] : ["length", "images_alt", "headings"]]);
  return seoChecks({ title: entry.title, seoTitle: "", seoDescription: entry.description ?? "", excerpt: "", slug, hasCover: entry.hasImage ?? true, content: entry.body?.content ?? undefined, focusKeyword: entry.focusKeyword })
    .filter((check) => !skip.has(check.id));
}

// Chỉ bài có thân bài mới có lỗi thân bài; tin nhắn lấy từ chính mục kiểm tra của trợ lý SEO để người dùng gặp cùng lời hướng dẫn ở hai nơi.
function bodyIssues(checks: ReturnType<typeof seoChecks>): SeoIssue[] {
  const issues: SeoIssue[] = [];
  for (const [id, code] of [["length", "content_short"], ["headings", "no_headings"], ["images_alt", "body_image_alt"]] as const) {
    const check = checks.find((item) => item.id === id && !item.ok);
    if (check) issues.push({ code, message: check.message });
  }
  const keyword = checks.find((item) => item.id.startsWith("kw_") && !item.ok);
  if (keyword) issues.push({ code: "keyword_weak", message: keyword.message });
  return issues;
}

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

function trimPath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

// Canonical khác địa chỉ của chính trang là lời nói với Google "bản chính nằm chỗ khác": Google thường bỏ trang này khỏi kết quả.
// Cần địa chỉ website để so sánh; chưa cấu hình thì không đoán.
function canonicalIssue(entry: SeoAuditEntry, siteUrl: string | null | undefined): SeoIssue | null {
  const raw = entry.canonicalUrl?.trim();
  if (!raw || !siteUrl) return null;
  let target: URL;
  let own: URL;
  try {
    target = new URL(raw, siteUrl);
    own = new URL(entry.path, siteUrl);
  } catch {
    return { code: "canonical_mismatch", message: `Địa chỉ chính thức (canonical) "${raw}" không hợp lệ; Google sẽ bỏ qua và tự chọn bản chính.` };
  }
  if (target.origin !== own.origin) return { code: "canonical_mismatch", message: `Địa chỉ chính thức (canonical) trỏ sang ${target.origin}, khác tên miền của website (${own.origin}). Google coi bản chính là trang đó và có thể bỏ trang này khỏi kết quả.` };
  if (trimPath(target.pathname) !== trimPath(own.pathname)) return { code: "canonical_mismatch", message: `Địa chỉ chính thức (canonical) trỏ sang ${trimPath(target.pathname)}, không phải trang này (${entry.path}). Google có thể bỏ trang này khỏi kết quả; để trống nếu muốn dùng địa chỉ của chính trang.` };
  return null;
}

export function auditSeo(entries: readonly SeoAuditEntry[], options: { siteUrl?: string | null } = {}): SeoAuditResult {
  // Trang noindex không cạnh tranh trên Google nên không tính vào so sánh trùng lặp.
  const indexable = entries.filter((entry) => !entry.noindex);
  const titles = groupBy(indexable, (entry) => normalize(entry.title));
  const descriptions = groupBy(indexable, (entry) => entry.description ? normalize(entry.description) : null);
  const keywords = groupBy(indexable, (entry) => entry.focusKeyword ? normalize(entry.focusKeyword) : null);
  // `entry` giữ nguyên đối tượng gốc vì so sánh trùng lặp dựa trên đối tượng; thân bài chỉ để tính toán nên bị bỏ khỏi kết quả ở `withoutBody`.
  const withoutBody = (entry: SeoAuditEntry) => { const copy: Partial<SeoAuditEntry> = { ...entry }; delete copy.body; return copy as Omit<SeoAuditEntry, "body">; };
  const all = entries.map((entry): SeoAuditRow => {
    const body = entry.body;
    const checks = scoreChecks(entry);
    const score: SeoScore = { passed: checks.filter((check) => check.ok).length, total: checks.length };
    const issues: SeoIssue[] = [];
    if (entry.noindex) {
      issues.push({ code: "noindex", message: "Đang ẩn khỏi Google (noindex): trang hiện trên website nhưng không bao giờ xuất hiện trên Google. Đổi lại ở mục SEO nâng cao nếu không chủ ý." });
      return { ...withoutBody(entry), issues, score };
    }
    const canonical = canonicalIssue(entry, options.siteUrl);
    if (canonical) issues.push(canonical);
    const sameTitle = othersOf(titles.get(normalize(entry.title)), entry);
    if (sameTitle.length) issues.push({ code: "duplicate_title", message: `Trùng tiêu đề với ${sameTitle.join(", ")}. Google khó phân biệt các trang này.` });
    const sameKeyword = entry.focusKeyword ? othersOf(keywords.get(normalize(entry.focusKeyword)), entry) : [];
    if (sameKeyword.length) issues.push({ code: "keyword_conflict", message: `Cùng nhắm cụm từ “${entry.focusKeyword}” với ${sameKeyword.join(", ")}. Hai trang cùng muốn lên top một cụm từ sẽ cạnh tranh nhau; nên gộp lại hoặc đổi cụm từ chính của một trang.` });
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
    if (entry.imageHasAlt === false) issues.push({ code: "missing_image_alt", message: "Ảnh bìa chưa có mô tả ảnh (alt): Google Hình ảnh và người dùng đọc màn hình không biết ảnh nói gì. Thêm trong Thư viện hình ảnh." });
    if (body) issues.push(...bodyIssues(checks));
    issues.sort((a, b) => issueOrder.indexOf(a.code) - issueOrder.indexOf(b.code));
    return { ...withoutBody(entry), issues, score };
  });
  const severity = (row: SeoAuditRow) => row.issues.length ? issueOrder.indexOf(row.issues[0].code) : issueOrder.length;
  return {
    checked: entries.length,
    // Trang tốt xếp từ điểm thấp đến cao rồi theo đường dẫn; trang noindex đã có lỗi riêng nên không nằm ở đây.
    healthy: all.filter((row) => !row.issues.length).sort((a, b) => a.score.passed / Math.max(a.score.total, 1) - b.score.passed / Math.max(b.score.total, 1) || a.path.localeCompare(b.path)),
    rows: all.filter((row) => row.issues.length).sort((a, b) => severity(a) - severity(b) || b.issues.length - a.issues.length || a.path.localeCompare(b.path)),
  };
}
