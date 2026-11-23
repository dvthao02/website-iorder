"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type MouseEvent } from "react";
import { z } from "zod";
import { ChevronDown, FileSpreadsheet } from "lucide-react";

import type { CmsModuleKey } from "@iorder/shared/server/auth/permissions";
import { importPlanSchema, importResultSchema, type TransferDatasetId } from "@iorder/shared/server/data-transfer/data-transfer.contract";
import type { ImportPlan, ImportRow } from "@iorder/shared/server/data-transfer/transfer";
import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminFileIcon, fileKindOf } from "@/components/admin/ui/admin-file-icon";
import { AdminNotice, AdminStatusBadge, useAdminToast, type AdminFeedbackTone } from "@/components/admin/ui/admin-feedback";
import { AdminPopover } from "@/components/admin/ui/admin-popover";
import { AdminHelpTip } from "@/components/admin/ui/admin-help-tip";
import { AdminSidePanel } from "@/components/admin/ui/admin-side-panel";
import { useAdminPermissions } from "@/components/admin/ui/admin-permissions";
import { AdminSelect } from "./ui/admin-select";

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
        <a className="admin-transfer-menu__item" download href={exportHref("xlsx")} onClick={(event) => choose(event)} title={`Toàn bộ ${noun}; cũng là file mẫu để nhập lại`}><AdminFileIcon action="export" kind="excel" size="sm" /><span><strong>Excel (.xlsx)</strong></span></a>
        <a className="admin-transfer-menu__item" download href={exportHref("csv")} onClick={(event) => choose(event)} title="Mở được bằng mọi phần mềm bảng tính"><AdminFileIcon action="export" kind="csv" size="sm" /><span><strong>CSV</strong></span></a>
        {word ? <a className="admin-transfer-menu__item" download href={exportHref("word")} onClick={(event) => choose(event)} title="Mỗi bài một file .docx, giữ định dạng và ảnh"><AdminFileIcon action="export" kind="word" size="sm" /><span><strong>Word (.zip)</strong></span></a> : null}
        {canImport || (word && can("posts.create")) ? <span className="admin-transfer-menu__group">Nhập file</span> : null}
        {canImport ? <button className="admin-transfer-menu__item" onClick={(event) => choose(event, "sheet")} title="Xem trước thay đổi rồi mới áp dụng" type="button"><AdminFileIcon action="import" kind="excel" size="sm" /><span><strong>Từ Excel/CSV…</strong></span></button> : null}
        {word && can("posts.create") ? <button className="admin-transfer-menu__item" onClick={(event) => choose(event, "word")} title="Nhiều file .docx thành bài nháp" type="button"><AdminFileIcon action="import" kind="word" size="sm" /><span><strong>Từ Word…</strong></span></button> : null}
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
  const [sheets, setSheets] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState("");
  const [confirming, setConfirming] = useState(false);
  const changes = plan ? plan.counts.create + plan.counts.update : 0;
  const blocked = !plan || plan.fileErrors.length > 0 || plan.counts.error > 0 || changes === 0;

  async function send(mode: "sheets" | "preview" | "apply") {
    if (!file || busy) return;
    const body = new FormData();
    body.set("file", file);
    body.set("mode", mode);
    if (sheet && mode !== "sheets") body.set("sheet", sheet);
    if (mode === "apply" && plan) body.set("expected", JSON.stringify(Object.fromEntries(plan.rows.filter((row) => row.action === "create" || row.action === "update").map((row) => [row.slug, row.version]))));
    if (mode === "apply" && plan?.newGroups) body.set("groups", JSON.stringify(plan.newGroups));
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/admin/data-transfer/${dataset}`, { method: "POST", body });
      const payload = await readAdminJson(response);
      if (!response.ok && response.status !== 207) throw adminApiError(payload, mode === "preview" ? "Không đọc được file." : "Không áp dụng được thay đổi.");
      if (mode === "sheets") {
        const parsed = z.object({ sheets: z.array(z.string().min(1).max(31)) }).safeParse(payload);
        if (!parsed.success) throw new Error("Không đọc được danh sách sheet. Vui lòng thử lại.");
        setSheets(parsed.data.sheets);
        setSheet(parsed.data.sheets.length === 1 ? parsed.data.sheets[0] : "");
        return;
      }
      if (mode === "preview") {
        const parsed = importPlanSchema.safeParse((payload as { plan?: unknown })?.plan);
        if (!parsed.success) throw new Error("Phản hồi xem trước không hợp lệ. Vui lòng thử lại.");
        setPlan(parsed.data);
        return;
      }
      const result = importResultSchema.safeParse((payload as { result?: unknown })?.result);
      if (!result.success) throw new Error("Phản hồi nhập dữ liệu không hợp lệ. Vui lòng tải lại trang để kiểm tra.");
      const summary = `Đã thêm ${result.data.created}, cập nhật ${result.data.updated} ${label.toLocaleLowerCase("vi")}.${result.data.createdGroups?.length ? ` Đã tạo nhóm: ${result.data.createdGroups.join(", ")}.` : ""}`;
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
      if (mode === "apply") { setPlan(null); setConfirming(false); }
    } finally {
      setBusy(false);
    }
  }

  function choose(event: FormEvent<HTMLInputElement>) {
    setFile(event.currentTarget.files?.[0] ?? null);
    setPlan(null); setSheets(null); setSheet(""); setConfirming(false); setError("");
  }

  const rows = plan ? plan.rows.filter((row) => showUnchanged || row.action !== "unchanged") : [];
  const match = matchColumns[dataset] ?? { column: "Đường dẫn", example: "đường dẫn và giá" };
  return <AdminSidePanel isOpen label={`Nhập ${label.toLocaleLowerCase("vi")} từ file`} onClose={busy ? () => undefined : onClose} footer={<>
    <AdminButton disabled={busy} onClick={onClose} variant="secondary">Đóng</AdminButton>
    {confirming ? <><AdminButton disabled={busy} onClick={() => setConfirming(false)} variant="secondary">Quay lại</AdminButton><AdminButton disabled={busy || blocked} onClick={() => void send("apply")}>{busy ? "Đang áp dụng…" : "Xác nhận nhập"}</AdminButton></>
      : plan ? <AdminButton disabled={busy || blocked} onClick={() => setConfirming(true)}>Tiếp tục xác nhận</AdminButton>
      : sheets === null ? <AdminButton disabled={busy || !file} onClick={() => void send("sheets")}>{busy ? "Đang đọc file…" : "Tiếp tục"}</AdminButton>
      : <AdminButton disabled={busy || !file || (sheets.length > 0 && !sheet)} onClick={() => void send("preview")}>{busy ? "Đang kiểm tra…" : "Kiểm tra dữ liệu"}</AdminButton>}
  </>}>
    <div className="admin-import">
      <header><div className="admin-label-row"><h2>Nhập {label.toLocaleLowerCase("vi")} từ file</h2><AdminHelpTip label="Hướng dẫn nhập file">Mỗi dòng một mục, khớp theo cột {match.column}: trùng thì cập nhật, mới thì thêm; không xóa mục vắng mặt. {match.note ?? ""} Chọn file tối đa 2 MB, chọn sheet Excel, kiểm tra rồi xác nhận; mỗi mục thay đổi có phiên bản để khôi phục.</AdminHelpTip></div></header>
      <div className="admin-label-row"><span>Tải file mẫu: <a download href={exportHref("xlsx")}>Excel</a> hoặc <a download href={exportHref("csv")}>CSV</a>.</span><AdminHelpTip label="Giải thích cách sửa file">Giữ dòng tiêu đề. Chỉ cập nhật các cột còn trong file, ví dụ {match.example}. Ô trống ở cột số, Có/Không, trạng thái giữ nguyên; ô trống ở cột chữ hoặc danh sách xóa nội dung. Không muốn đổi thì xóa cột khỏi file.</AdminHelpTip>{dataset === "equipment" ? <AdminHelpTip label="Cách ghi thông số kỹ thuật">Trong cột Thông số kỹ thuật, ghi mỗi nhóm trên một dòng dạng [Tên nhóm], tiếp theo mỗi thông số một dòng dạng Tên: Giá trị. Xuống dòng trong ô bằng Alt+Enter. Ô trống xóa thông số; xóa cột để giữ nguyên. Với ký tự đặc biệt, giữ dấu \ trong file xuất.</AdminHelpTip> : null}</div>
      <label className="admin-import__file"><AdminFileIcon action="import" kind={file ? fileKindOf(file.name) : "excel"} /><span>{file ? file.name : "Chọn file .xlsx hoặc .csv"}</span><input accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={choose} type="file" /></label>
      {sheets?.length ? <label className="admin-field">Sheet cần nhập<AdminSelect disabled={busy} value={sheet} onChange={(event) => { setSheet(event.target.value); setPlan(null); setConfirming(false); }}><option value="">Chọn sheet</option>{sheets.map((name) => <option key={name} value={name}>{name}</option>)}</AdminSelect></label> : null}
      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {confirming && plan ? <AdminNotice tone="info">Xác nhận nhập {file?.name}{sheet ? ` · sheet ${sheet}` : ""}: thêm {plan.counts.create}, cập nhật {plan.counts.update}. Dữ liệu sẽ được kiểm tra lại trước khi lưu.</AdminNotice> : null}
      {plan ? <section aria-label="Kết quả xem trước" className="admin-import__preview">
        <div className="admin-import__counts">
          {(["create", "update", "unchanged", "error"] as const).map((action) => <AdminStatusBadge key={action} tone={plan.counts[action] ? actionLabels[action].tone : "neutral"}>{actionLabels[action].label}: {plan.counts[action]}</AdminStatusBadge>)}
        </div>
        {plan.fileErrors.map((message) => <AdminNotice key={message} tone="error">{message}</AdminNotice>)}
        {plan.newGroups?.length ? <AdminNotice tone="info">Sẽ tạo {plan.newGroups.length} nhóm khi xác nhận: {plan.newGroups.map((group) => group.name).join(", ")}. {plan.newGroups.some((group) => !group.isEnabled) ? "Nhóm mới sẽ được ẩn trên website cho đến khi người có quyền xuất bản bật hiển thị." : "Nhóm mới sẽ hiển thị trên website."}</AdminNotice> : null}
        {plan.ignoredHeaders.length ? <AdminNotice tone="info">Bỏ qua cột không nhận ra: {plan.ignoredHeaders.join(", ")}.</AdminNotice> : null}
        {plan.counts.error ? <AdminNotice tone="warning">Sửa các dòng lỗi trong file rồi chọn lại file để xem trước; chỉ áp dụng được khi không còn lỗi.</AdminNotice> : changes === 0 && !plan.fileErrors.length ? <AdminNotice tone="info">File không có thay đổi nào so với dữ liệu hiện tại.</AdminNotice> : null}
        {plan.fileErrors.length || plan.counts.error ? <AdminButton disabled={busy} onClick={() => void send("preview")} variant="secondary">Kiểm tra lại</AdminButton> : null}
        {plan.counts.unchanged ? <label className="admin-import__toggle"><input checked={showUnchanged} onChange={(event) => setShowUnchanged(event.target.checked)} type="checkbox" />Hiện cả {plan.counts.unchanged} dòng không đổi</label> : null}
        <ul className="admin-import__rows">{rows.map((row) => <li className={`admin-import__row admin-import__row--${row.action}`} key={`${row.row}-${row.slug}`}>
          <div><strong>{row.label}</strong><small>Dòng {row.row}{row.slug ? ` · ${row.slug}` : ""}</small><AdminStatusBadge tone={actionLabels[row.action].tone}>{actionLabels[row.action].label}</AdminStatusBadge></div>
          {row.errors.length ? <ul className="admin-import__errors">{row.errors.map((message) => <li key={message}>{message}</li>)}</ul> : null}
          {row.changes.length && row.action !== "error" ? <ul className="admin-import__changes">{row.changes.map((change) => <li key={change.field} style={change.field === "specificationGroups" ? { whiteSpace: "pre-wrap" } : undefined}><span>{change.header}:</span> {row.action === "create" ? change.field === "specificationGroups" ? change.after : shown(change.after) : <><del>{change.field === "specificationGroups" ? change.before || "(trống)" : shown(change.before)}</del> → <ins>{change.field === "specificationGroups" ? change.after || "(trống)" : shown(change.after)}</ins></>}</li>)}</ul> : null}
        </li>)}</ul>
      </section> : null}
    </div>
  </AdminSidePanel>;
}
