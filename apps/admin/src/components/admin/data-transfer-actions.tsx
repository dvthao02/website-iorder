"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type MouseEvent } from "react";
import { ChevronDown, FileSpreadsheet } from "lucide-react";

import type { CmsModuleKey } from "@iorder/shared/server/auth/permissions";
import { importPlanSchema, importResultSchema, type TransferDatasetId } from "@iorder/shared/server/data-transfer/data-transfer.contract";
import type { ImportPlan, ImportRow } from "@iorder/shared/server/data-transfer/transfer";
import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminFileIcon, fileKindOf } from "@/components/admin/ui/admin-file-icon";
import { AdminNotice, AdminStatusBadge, useAdminToast, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";
import { AdminPopover } from "@/components/admin/ui/admin-popover";
import { AdminSidePanel } from "@/components/admin/ui/admin-side-panel";
import { useAdminPermissions } from "@/components/admin/ui/admin-permissions";

// Khung nhập Word kéo theo bộ soạn thảo Tiptap (~500 KB): chỉ tải khi người dùng mở, không nạp cùng màn danh sách.
const WordImportPanel = dynamic(() => import("@/components/admin/word-import-panel").then((loaded) => loaded.WordImportPanel), { ssr: false });

const actionLabels: Record<ImportRow["action"], { label: string; tone: AdminFeedbackTone }> = {
  create: { label: "Thêm mới", tone: "success" },
  update: { label: "Cập nhật", tone: "info" },
  unchanged: { label: "Không đổi", tone: "neutral" },
  error: { label: "Lỗi", tone: "error" },
};
const numberFormatter = new Intl.NumberFormat("vi-VN");
const shown = (value: string) => !value ? "(trống)" : /^\d{4,}$/.test(value) ? numberFormatter.format(Number(value)) : value.length > 120 ? `${value.slice(0, 120)}…` : value;

/**
 * Một nút "Nhập / Xuất" mỗi màn danh sách (như "Import/Export" của Shopify): xuất Excel/CSV (cũng là file mẫu),
 * nhập lại có xem trước từng dòng thêm/cập nhật/lỗi. Bài viết/Hướng dẫn có thêm xuất/nhập Word.
 * Khớp theo đường dẫn (slug), hoặc tên/đường dẫn cũ với bảng không có slug; không xóa mục nào vắng mặt trong file.
 */
export function DataTransferActions({ dataset, label, module, word }: { dataset: TransferDatasetId; label: string; module: CmsModuleKey; word?: "posts" | "guides" }) {
  const { can, canAny } = useAdminPermissions();
  const [panel, setPanel] = useState<"sheet" | "word" | null>(null);
  const exportHref = (format: "xlsx" | "csv" | "word") => `/api/v1/admin/data-transfer/${dataset}?format=${format}`;
  const canImport = canAny([`${module}.create`, `${module}.update`] as Parameters<typeof canAny>[0]);
  const noun = label.toLocaleLowerCase("vi");
  if (!can(`${module}.view` as Parameters<typeof can>[0])) return null;
  // Đóng menu <details> khi chọn một mục.
  const choose = (event: MouseEvent<HTMLElement>, next?: "sheet" | "word") => { event.currentTarget.closest("details")?.removeAttribute("open"); if (next) setPanel(next); };
  return <>
    <AdminPopover className="admin-create-menu" label={`Nhập hoặc xuất ${noun}`} trigger={<span className="admin-button admin-button--export admin-file-tone--excel"><FileSpreadsheet aria-hidden="true" size={16} />Nhập / Xuất<ChevronDown aria-hidden="true" size={14} /></span>}>
      <div className="admin-header-popover admin-header-popover--menu admin-transfer-menu">
        <span className="admin-transfer-menu__group">Xuất file</span>
        <a className="admin-transfer-menu__item" download href={exportHref("xlsx")} onClick={(event) => choose(event)}><AdminFileIcon action="export" kind="excel" size="sm" /><span><strong>Excel (.xlsx)</strong><small>Toàn bộ {noun}; cũng là file mẫu để nhập lại</small></span></a>
        <a className="admin-transfer-menu__item" download href={exportHref("csv")} onClick={(event) => choose(event)}><AdminFileIcon action="export" kind="csv" size="sm" /><span><strong>CSV</strong><small>Mở được bằng mọi phần mềm bảng tính</small></span></a>
        {word ? <a className="admin-transfer-menu__item" download href={exportHref("word")} onClick={(event) => choose(event)}><AdminFileIcon action="export" kind="word" size="sm" /><span><strong>Word (.zip)</strong><small>Mỗi bài một file .docx, giữ định dạng và ảnh</small></span></a> : null}
        {canImport || (word && can("posts.create")) ? <span className="admin-transfer-menu__group">Nhập file</span> : null}
        {canImport ? <button className="admin-transfer-menu__item" onClick={(event) => choose(event, "sheet")} type="button"><AdminFileIcon action="import" kind="excel" size="sm" /><span><strong>Từ Excel/CSV…</strong><small>Xem trước thay đổi rồi mới áp dụng</small></span></button> : null}
        {word && can("posts.create") ? <button className="admin-transfer-menu__item" onClick={(event) => choose(event, "word")} type="button"><AdminFileIcon action="import" kind="word" size="sm" /><span><strong>Từ Word…</strong><small>Nhiều file .docx thành bài nháp</small></span></button> : null}
      </div>
    </AdminPopover>
    {panel === "sheet" ? <ImportPanel dataset={dataset} exportHref={exportHref} label={label} onClose={() => setPanel(null)} /> : null}
    {panel === "word" && word ? <WordImportPanel kind={word} onClose={() => setPanel(null)} /> : null}
  </>;
}

// Cột dùng để khớp dòng với mục đang có. Bảng không có slug khớp theo tên hoặc đường dẫn cũ.
const matchColumns: Partial<Record<TransferDatasetId, { column: string; example: string; note?: string }>> = {
  partners: { column: "Tên", example: "tên và thứ tự", note: "Đổi tên trong file sẽ thành mục mới; muốn đổi tên hãy sửa trong màn này." },
  testimonials: { column: "Người đánh giá", example: "người đánh giá và thứ tự", note: "Đổi tên người đánh giá trong file sẽ thành mục mới; muốn đổi tên hãy sửa trong màn này." },
  redirects: { column: "Đường dẫn cũ", example: "đường dẫn cũ và cột Đang bật", note: "Vòng lặp chuyển hướng được báo ngay khi xem trước." },
};

function ImportPanel({ dataset, exportHref, label, onClose }: { dataset: TransferDatasetId; exportHref: (format: "xlsx" | "csv" | "word") => string; label: string; onClose: () => void }) {
  const router = useRouter();
  const { show } = useAdminToast();
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showUnchanged, setShowUnchanged] = useState(false);
  const changes = plan ? plan.counts.create + plan.counts.update : 0;
  const blocked = !plan || plan.fileErrors.length > 0 || plan.counts.error > 0 || changes === 0;

  async function send(mode: "preview" | "apply") {
    if (!file || busy) return;
    const body = new FormData();
    body.set("file", file);
    body.set("mode", mode);
    if (mode === "apply" && plan) body.set("expected", JSON.stringify(Object.fromEntries(plan.rows.filter((row) => row.action === "create" || row.action === "update").map((row) => [row.slug, row.version]))));
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/admin/data-transfer/${dataset}`, { method: "POST", body });
      const payload = await readAdminJson(response);
      if (!response.ok && response.status !== 207) throw adminApiError(payload, mode === "preview" ? "Không đọc được file." : "Không áp dụng được thay đổi.");
      if (mode === "preview") {
        const parsed = importPlanSchema.safeParse((payload as { plan?: unknown })?.plan);
        if (!parsed.success) throw new Error("Phản hồi xem trước không hợp lệ. Vui lòng thử lại.");
        setPlan(parsed.data);
        return;
      }
      const result = importResultSchema.safeParse((payload as { result?: unknown })?.result);
      if (!result.success) throw new Error("Phản hồi nhập dữ liệu không hợp lệ. Vui lòng tải lại trang để kiểm tra.");
      const summary = `Đã thêm ${result.data.created}, cập nhật ${result.data.updated} ${label.toLocaleLowerCase("vi")}.`;
      router.refresh();
      if (result.data.failed) {
        // Các dòng trước đã ghi (có phiên bản để khôi phục); dừng ở dòng lỗi.
        setPlan(null);
        setError(`${summary} Dừng ở dòng ${result.data.failed.row} (${result.data.failed.slug}): ${result.data.failed.message}`);
        return;
      }
      show(summary, "success");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xử lý được file lúc này.");
      // Phiên bản đổi hoặc file còn lỗi: phải xem trước lại.
      if (mode === "apply") setPlan(null);
    } finally {
      setBusy(false);
    }
  }

  function choose(event: FormEvent<HTMLInputElement>) {
    setFile(event.currentTarget.files?.[0] ?? null);
    setPlan(null); setError("");
  }

  const rows = plan ? plan.rows.filter((row) => showUnchanged || row.action !== "unchanged") : [];
  const match = matchColumns[dataset] ?? { column: "Đường dẫn", example: "đường dẫn và giá" };
  return <AdminSidePanel isOpen label={`Nhập ${label.toLocaleLowerCase("vi")} từ file`} onClose={busy ? () => undefined : onClose} footer={<>
    <AdminButton disabled={busy} onClick={onClose} variant="secondary">Đóng</AdminButton>
    {plan ? <AdminButton disabled={busy || blocked} onClick={() => void send("apply")}>{busy ? "Đang áp dụng…" : `Áp dụng ${changes} thay đổi`}</AdminButton>
      : <AdminButton disabled={busy || !file} onClick={() => void send("preview")}>{busy ? "Đang đọc file…" : "Xem trước"}</AdminButton>}
  </>}>
    <div className="admin-import">
      <header><h2>Nhập {label.toLocaleLowerCase("vi")} từ file</h2><p>Mỗi dòng một mục, khớp theo cột <strong>{match.column}</strong>: trùng thì cập nhật, mới thì thêm. Không mục nào bị xóa.{match.note ? ` ${match.note}` : ""}</p></header>
      <ol className="admin-import__steps">
        <li>Tải <a download href={exportHref("xlsx")}>file Excel hiện tại</a> (hoặc <a download href={exportHref("csv")}>CSV</a>) làm mẫu.</li>
        <li>Sửa trong Excel, giữ dòng tiêu đề. Chỉ các cột còn trong file được cập nhật — ví dụ chỉ giữ cột {match.example} để sửa hàng loạt. Ô trống ở cột số, Có/Không, trạng thái là giữ nguyên; <strong>ô trống ở cột chữ hoặc danh sách là xóa nội dung đó</strong> — không muốn đổi thì xóa hẳn cột khỏi file.</li>
        <li>Chọn file (.xlsx hoặc .csv, tối đa 2 MB), xem trước rồi áp dụng. Mỗi mục thay đổi đều có phiên bản để khôi phục.</li>
      </ol>
      <label className="admin-import__file"><AdminFileIcon action="import" kind={file ? fileKindOf(file.name) : "excel"} /><span>{file ? file.name : "Chọn file .xlsx hoặc .csv"}</span><input accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={choose} type="file" /></label>
      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {plan ? <section aria-label="Kết quả xem trước" className="admin-import__preview">
        <div className="admin-import__counts">
          {(["create", "update", "unchanged", "error"] as const).map((action) => <AdminStatusBadge key={action} tone={plan.counts[action] ? actionLabels[action].tone : "neutral"}>{actionLabels[action].label}: {plan.counts[action]}</AdminStatusBadge>)}
        </div>
        {plan.fileErrors.map((message) => <AdminNotice key={message} tone="error">{message}</AdminNotice>)}
        {plan.ignoredHeaders.length ? <AdminNotice tone="info">Bỏ qua cột không nhận ra: {plan.ignoredHeaders.join(", ")}.</AdminNotice> : null}
        {plan.counts.error ? <AdminNotice tone="warning">Sửa các dòng lỗi trong file rồi chọn lại file để xem trước; chỉ áp dụng được khi không còn lỗi.</AdminNotice> : changes === 0 && !plan.fileErrors.length ? <AdminNotice tone="info">File không có thay đổi nào so với dữ liệu hiện tại.</AdminNotice> : null}
        {plan.counts.unchanged ? <label className="admin-import__toggle"><input checked={showUnchanged} onChange={(event) => setShowUnchanged(event.target.checked)} type="checkbox" />Hiện cả {plan.counts.unchanged} dòng không đổi</label> : null}
        <ul className="admin-import__rows">{rows.map((row) => <li className={`admin-import__row admin-import__row--${row.action}`} key={`${row.row}-${row.slug}`}>
          <div><strong>{row.label}</strong><small>Dòng {row.row}{row.slug ? ` · ${row.slug}` : ""}</small><AdminStatusBadge tone={actionLabels[row.action].tone}>{actionLabels[row.action].label}</AdminStatusBadge></div>
          {row.errors.length ? <ul className="admin-import__errors">{row.errors.map((message) => <li key={message}>{message}</li>)}</ul> : null}
          {row.changes.length && row.action !== "error" ? <ul className="admin-import__changes">{row.changes.map((change) => <li key={change.field}><span>{change.header}:</span> {row.action === "create" ? shown(change.after) : <><del>{shown(change.before)}</del> → <ins>{shown(change.after)}</ins></>}</li>)}</ul> : null}
        </li>)}</ul>
      </section> : null}
    </div>
  </AdminSidePanel>;
}
