import Link from "next/link";

import type { SeoAuditResult, SeoAuditRow, SeoIssueCode, SeoScore } from "@iorder/shared/server/seo-audit/seo-audit";
import { AdminStatusBadge } from "@/components/admin/ui/admin-feedback";

export const issueLabels: Record<SeoIssueCode, string> = {
  noindex: "Ẩn khỏi Google",
  canonical_mismatch: "Địa chỉ chính thức sai",
  keyword_conflict: "Tranh từ khóa",
  duplicate_title: "Trùng tiêu đề",
  duplicate_description: "Trùng mô tả",
  missing_description: "Thiếu mô tả",
  title_long: "Tiêu đề dài",
  description_long: "Mô tả dài",
  description_short: "Mô tả ngắn",
  missing_image: "Thiếu ảnh bìa",
  missing_image_alt: "Ảnh bìa thiếu mô tả",
  content_short: "Bài ngắn",
  no_headings: "Thiếu đề mục",
  body_image_alt: "Ảnh trong bài thiếu mô tả",
  keyword_weak: "Từ khóa chưa đủ",
};

// Lỗi khiến trang không lên Google hoặc mất lợi thế thứ hạng: nhắc bằng màu cảnh báo; còn lại là gợi ý hoàn thiện.
const warningCodes = new Set<SeoIssueCode>(["noindex", "canonical_mismatch", "keyword_conflict", "duplicate_title", "duplicate_description", "missing_description"]);

const kindLabels: Record<string, string> = { page: "Trang", post: "Bài viết", guide: "Hướng dẫn", software: "Sản phẩm", solution: "Giải pháp", equipment: "Thiết bị" };

function kindLabel(row: SeoAuditRow) {
  if (row.kind === "post") return kindLabels[row.type === "guide" ? "guide" : "post"];
  if (row.kind === "offering") return kindLabels[row.type ?? ""] ?? "Sản phẩm";
  return kindLabels[row.kind];
}

// Mở thẳng màn sửa có ô "Google & chia sẻ mạng xã hội" của nội dung đó.
export function editorHref(row: SeoAuditRow) {
  if (row.kind === "page") return row.path === "/" ? "/admin/homepage" : `/admin/pages/${row.id}`;
  if (row.kind === "post") return `${row.type === "guide" ? "/admin/guides" : "/admin/news"}/${row.id}`;
  if (row.kind === "offering") return `${row.type === "solution" ? "/admin/solutions" : "/admin/products"}/${row.id}`;
  return `/admin/equipment/${row.id}`;
}

function ScoreBadge({ score }: { score: SeoScore }) {
  const share = score.total ? score.passed / score.total : 1;
  return <AdminStatusBadge tone={share >= 0.85 ? "success" : share >= 0.6 ? "neutral" : "warning"}>{score.passed}/{score.total}</AdminStatusBadge>;
}

export function SeoAuditPanel({ audit }: { audit: SeoAuditResult }) {
  const counts = new Map<SeoIssueCode, number>();
  for (const row of audit.rows) for (const issue of row.issues) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);

  return <section aria-labelledby="seo-audit-title" className="admin-settings-page__section">
    <header>
      <h2 id="seo-audit-title">Kiểm tra SEO nội dung</h2>
      <p>So tiêu đề và mô tả Google nhận được giữa {audit.checked} trang đang hiển thị, đồng thời dò các cấu hình khiến Google bỏ trang (đang ẩn khỏi Google, địa chỉ chính thức trỏ sang nơi khác). Trùng lặp làm Google khó chọn trang nào để hiện; mỗi trang nên có tiêu đề và mô tả riêng.</p>
    </header>
    {audit.rows.length ? <>
      <div className="admin-seo-audit__summary">{[...counts].map(([code, total]) => <AdminStatusBadge key={code} tone={warningCodes.has(code) ? "warning" : "neutral"}>{issueLabels[code]}: {total}</AdminStatusBadge>)}</div>
      <div className="admin-check-list admin-seo-audit">{audit.rows.map((row) => <Link href={editorHref(row)} key={`${row.kind}-${row.id}`}>
        <span className="admin-status" />
        <span>
          <strong>{row.label} <em>{kindLabel(row)} · {row.path}</em> <ScoreBadge score={row.score} /></strong>
          <ul>{row.issues.map((issue) => <li key={issue.code}><b>{issueLabels[issue.code]}:</b> {issue.message}</li>)}</ul>
        </span>
        <AdminStatusBadge tone="warning">Sửa SEO</AdminStatusBadge>
      </Link>)}</div>
    </> : <p className="admin-help">Không phát hiện vấn đề: mọi trang đang hiển thị đều có tiêu đề và mô tả riêng, độ dài hợp lý.</p>}
    {audit.healthy.length ? <details className="admin-seo-audit__healthy">
      <summary>{audit.healthy.length} nội dung đã tốt (điểm thấp xếp trước)</summary>
      <div className="admin-check-list admin-seo-audit">{audit.healthy.map((row) => <Link href={editorHref(row)} key={`${row.kind}-${row.id}`}>
        <span className="admin-status admin-status--ready" />
        <span><strong>{row.label} <em>{kindLabel(row)} · {row.path}</em> <ScoreBadge score={row.score} /></strong></span>
      </Link>)}</div>
    </details> : null}
    <p className="admin-help">Điểm x/y là số mục SEO đạt (tiêu đề, mô tả, đường dẫn, ảnh bìa, từ khóa; với bài viết còn có độ dài, đề mục, mô tả ảnh trong bài). Trang, sản phẩm, giải pháp và thiết bị chưa chấm nội dung thân trang.</p>
  </section>;
}
