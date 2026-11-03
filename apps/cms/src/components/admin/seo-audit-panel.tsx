import Link from "next/link";

import type { SeoAuditResult, SeoAuditRow, SeoIssueCode } from "@iorder/core/server/seo-audit/seo-audit";
import { AdminStatusBadge } from "@/components/admin/ui/admin-feedback";

const issueLabels: Record<SeoIssueCode, string> = {
  duplicate_title: "Trùng tiêu đề",
  duplicate_description: "Trùng mô tả",
  missing_description: "Thiếu mô tả",
  title_long: "Tiêu đề dài",
  description_long: "Mô tả dài",
  description_short: "Mô tả ngắn",
  missing_image: "Thiếu ảnh bìa",
};

const kindLabels: Record<string, string> = { page: "Trang", post: "Bài viết", guide: "Hướng dẫn", software: "Sản phẩm", solution: "Giải pháp", service: "Dịch vụ", equipment: "Thiết bị" };

function kindLabel(row: SeoAuditRow) {
  if (row.kind === "post") return kindLabels[row.type === "guide" ? "guide" : "post"];
  if (row.kind === "offering") return kindLabels[row.type ?? ""] ?? "Sản phẩm";
  return kindLabels[row.kind];
}

// Mở thẳng màn sửa có ô "Google & chia sẻ mạng xã hội" của nội dung đó.
function editorHref(row: SeoAuditRow) {
  if (row.kind === "page") return row.path === "/" ? "/admin/homepage" : `/admin/pages/${row.id}`;
  if (row.kind === "post") return `${row.type === "guide" ? "/admin/guides" : "/admin/news"}/${row.id}`;
  if (row.kind === "offering") return `${row.type === "solution" ? "/admin/solutions" : row.type === "service" ? "/admin/services" : "/admin/products"}/${row.id}`;
  return `/admin/equipment/${row.id}`;
}

export function SeoAuditPanel({ audit }: { audit: SeoAuditResult }) {
  const counts = new Map<SeoIssueCode, number>();
  for (const row of audit.rows) for (const issue of row.issues) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);

  return <section aria-labelledby="seo-audit-title" className="admin-settings-page__section">
    <header>
      <h2 id="seo-audit-title">Kiểm tra SEO nội dung</h2>
      <p>So tiêu đề và mô tả Google nhận được giữa {audit.checked} trang đang hiển thị. Trùng lặp làm Google khó chọn trang nào để hiện; mỗi trang nên có tiêu đề và mô tả riêng.</p>
    </header>
    {audit.rows.length ? <>
      <div className="admin-seo-audit__summary">{[...counts].map(([code, total]) => <AdminStatusBadge key={code} tone={code.startsWith("duplicate") || code === "missing_description" ? "warning" : "neutral"}>{issueLabels[code]}: {total}</AdminStatusBadge>)}</div>
      <div className="admin-check-list admin-seo-audit">{audit.rows.map((row) => <Link href={editorHref(row)} key={`${row.kind}-${row.id}`}>
        <span className="admin-status" />
        <span>
          <strong>{row.label} <em>{kindLabel(row)} · {row.path}</em></strong>
          <ul>{row.issues.map((issue) => <li key={issue.code}><b>{issueLabels[issue.code]}:</b> {issue.message}</li>)}</ul>
        </span>
        <AdminStatusBadge tone="warning">Sửa SEO</AdminStatusBadge>
      </Link>)}</div>
    </> : <p className="admin-help">Không phát hiện vấn đề: mọi trang đang hiển thị đều có tiêu đề và mô tả riêng, độ dài hợp lý.</p>}
  </section>;
}
