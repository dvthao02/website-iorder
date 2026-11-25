"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { translationImportPlanSchema, translationImportResultSchema, type TranslationImportPlan, type TranslationOverview } from "@iorder/shared/server/translations/translations.contract";
import { adminApiError, readAdminJson } from "../../lib/admin-api";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminFileIcon, fileKindOf } from "./ui/admin-file-icon";
import { AdminNotice, AdminStatusBadge, useAdminToast, type AdminFeedbackTone } from "./ui/admin-feedback";
import { useAdminPermissions } from "./ui/admin-permissions";

type Locale = TranslationOverview["locales"][number];

const numberFormatter = new Intl.NumberFormat("vi-VN");
const shown = (value: string) => !value ? "(trống)" : value.length > 140 ? `${value.slice(0, 140)}…` : value;
const countLabels: Array<{ key: keyof TranslationImportPlan["counts"]; label: string; tone: AdminFeedbackTone }> = [
  { key: "create", label: "Thêm mới", tone: "success" },
  { key: "update", label: "Cập nhật", tone: "info" },
  { key: "kept", label: "Giữ bản đã có", tone: "neutral" },
  { key: "unchanged", label: "Không đổi", tone: "neutral" },
  { key: "empty", label: "Ô dịch trống", tone: "neutral" },
  { key: "stale", label: "Câu gốc đã đổi", tone: "warning" },
  { key: "invalid", label: "Dòng không hợp lệ", tone: "warning" },
];
const statusLabels = { create: { label: "Thêm mới", tone: "success" }, update: { label: "Cập nhật", tone: "info" }, kept: { label: "Giữ bản đã có", tone: "neutral" } } as const;

/**
 * Màn "Đa ngôn ngữ": mỗi ngôn ngữ một thẻ. Xuất file mẫu (Excel/CSV: khóa, câu tiếng Việt, ô điền bản dịch, nơi dùng), dịch rồi nhập lại có xem trước.
 * Nhập chỉ thêm các câu chưa có bản dịch; bản dịch đã có giữ nguyên trừ khi người dùng bật "cập nhật cả bản dịch đã có".
 */
export function TranslationsManager({ overview }: { overview: TranslationOverview | null }) {
  const router = useRouter();
  return <TranslationsView onRefresh={() => router.refresh()} overview={overview} />;
}

/** Phần hiển thị của màn "Đa ngôn ngữ" (tách khỏi router để kiểm thử được); `onRefresh` tải lại số liệu sau khi nhập. */
export function TranslationsView({ onRefresh, overview }: { onRefresh: () => void; overview: TranslationOverview | null }) {
  if (!overview) return <AdminNotice tone="error">Không tải được tổng quan bản dịch. Hãy tải lại trang hoặc thử lại sau.</AdminNotice>;
  return <div className="grid gap-4">
    <AdminNotice tone="info">Đường dẫn và slug giữ nguyên. Khách chọn ngôn ngữ bằng nút ở đầu website (chỉ hiện khi đã có bản dịch); chưa chọn thì xem tiếng Việt. Cả nội dung CMS (trang, bài viết, phần mềm, giải pháp, thiết bị, menu, thông tin doanh nghiệp) lẫn chữ cố định trong giao diện website (nút, nhãn, biểu mẫu: các dòng có khóa dạng ui.…, đứng đầu file) đều dịch ở đây.</AdminNotice>
    {overview.locales.map((locale) => <LocaleCard key={locale.code} locale={locale} onRefresh={onRefresh} total={overview.total} uiTotal={overview.uiTotal} />)}
  </div>;
}

function LocaleCard({ locale, onRefresh, total, uiTotal }: { locale: Locale; onRefresh: () => void; total: number; uiTotal: number }) {
  const { show } = useAdminToast();
  const { can } = useAdminPermissions();
  const canImport = can("settings.update");
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [plan, setPlan] = useState<TranslationImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/v1/admin/translations/${locale.code}`;
  const percent = total ? Math.round((locale.translated / total) * 100) : 0;
  const changes = plan ? plan.counts.create + plan.counts.update : 0;

  async function send(mode: "preview" | "apply") {
    if (!file || busy) return;
    const body = new FormData();
    body.set("file", file);
    body.set("mode", mode);
    body.set("overwrite", overwrite ? "true" : "false");
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", body });
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, mode === "preview" ? "Không đọc được file." : "Không áp dụng được bản dịch.");
      if (mode === "preview") {
        const parsed = translationImportPlanSchema.safeParse((payload as { plan?: unknown })?.plan);
        if (!parsed.success) throw new Error("Phản hồi xem trước không hợp lệ. Vui lòng thử lại.");
        setPlan(parsed.data);
        return;
      }
      const result = translationImportResultSchema.safeParse((payload as { result?: unknown })?.result);
      if (!result.success) throw new Error("Phản hồi nhập bản dịch không hợp lệ. Vui lòng tải lại trang để kiểm tra.");
      show(`Đã thêm ${result.data.created}, cập nhật ${result.data.updated} bản dịch ${locale.label.toLocaleLowerCase("vi")}.`, "success");
      setPlan(null); setFile(null);
      onRefresh();
    } catch (cause) {
      // Lỗi hiện cả trong thẻ (để đọc lại khi thông báo nổi đã tắt) và dạng thông báo nổi, giống các màn lưu khác của CMS.
      const message = cause instanceof Error ? cause.message : "Không xử lý được file lúc này.";
      setError(message);
      show(message, "error");
      if (mode === "apply") setPlan(null);
    } finally {
      setBusy(false);
    }
  }

  function choose(event: FormEvent<HTMLInputElement>) {
    setFile(event.currentTarget.files?.[0] ?? null);
    setPlan(null); setError("");
  }

  return <AdminCard>
    <header><div><h2>{locale.name} <small>· {locale.label} (mã {locale.code})</small></h2><p>{numberFormatter.format(locale.translated)}/{numberFormatter.format(total)} câu đã dịch ({percent}%; giao diện {numberFormatter.format(locale.uiTranslated)}/{numberFormatter.format(uiTotal)}, nội dung {numberFormatter.format(locale.translated - locale.uiTranslated)}/{numberFormatter.format(total - uiTotal)}). {locale.missing ? `Còn ${numberFormatter.format(locale.missing)} câu hiện tiếng Việt.` : "Đã dịch đủ."}{locale.unused ? ` ${numberFormatter.format(locale.unused)} bản dịch không còn câu gốc tương ứng (câu gốc đã sửa hoặc xóa).` : ""}</p></div></header>
    <div className="admin-import">
      <div className="admin-label-row"><span>1. Tải file mẫu rồi điền bản dịch vào cột “{locale.code} · {locale.name}”. Mỗi dòng là một câu tiếng Việt đang dùng; không sửa cột Khóa và cột tiếng Việt.</span></div>
      <div className="flex flex-wrap gap-2">
        <a className="admin-button admin-button--export admin-file-tone--excel" download href={`${endpoint}?format=xlsx`}><AdminFileIcon action="export" kind="excel" size="sm" />Tải file mẫu Excel (.xlsx)</a>
        <a className="admin-button admin-button--export admin-file-tone--csv" download href={`${endpoint}?format=csv`}><AdminFileIcon action="export" kind="csv" size="sm" />Tải file mẫu CSV</a>
      </div>
      {canImport ? <>
        <div className="admin-label-row"><span>2. Nhập lại file đã dịch. Chỉ thêm các câu chưa có bản dịch; câu đã dịch giữ nguyên. Xuất lại bất cứ lúc nào để thấy câu mới hoặc câu vừa sửa.</span></div>
        <label className="admin-import__file"><AdminFileIcon action="import" kind={file ? fileKindOf(file.name) : "excel"} /><span>{file ? file.name : "Chọn file .xlsx hoặc .csv"}</span><input accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={choose} type="file" /></label>
        <label className="admin-import__toggle"><input checked={overwrite} disabled={busy} onChange={(event) => { setOverwrite(event.target.checked); setPlan(null); }} type="checkbox" />Cập nhật cả bản dịch đã có (mặc định chỉ thêm câu còn thiếu)</label>
        <div className="flex flex-wrap gap-2">
          <AdminButton disabled={busy || !file} onClick={() => void send("preview")} variant="secondary">{busy && !plan ? "Đang kiểm tra…" : "Kiểm tra file"}</AdminButton>
          {plan ? <AdminButton disabled={busy || changes === 0} onClick={() => void send("apply")}>{busy ? "Đang áp dụng…" : `Áp dụng ${numberFormatter.format(changes)} bản dịch`}</AdminButton> : null}
        </div>
      </> : <AdminNotice tone="info">Bạn chỉ xem và xuất được file; nhập bản dịch cần quyền sửa cài đặt website.</AdminNotice>}
      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {plan ? <section aria-label="Kết quả xem trước" className="admin-import__preview">
        <div className="admin-import__counts">{countLabels.filter((item) => item.key === "create" || item.key === "update" || plan.counts[item.key] > 0).map((item) => <AdminStatusBadge key={item.key} tone={plan.counts[item.key] ? item.tone : "neutral"}>{item.label}: {numberFormatter.format(plan.counts[item.key])}</AdminStatusBadge>)}</div>
        {changes === 0 ? <AdminNotice tone="info">{plan.counts.kept ? "Mọi câu trong file đã có bản dịch. Bật “Cập nhật cả bản dịch đã có” nếu muốn thay bằng nội dung trong file." : "File không có bản dịch mới để thêm."}</AdminNotice> : null}
        {plan.counts.stale ? <AdminNotice tone="warning">{numberFormatter.format(plan.counts.stale)} dòng bị bỏ qua vì câu tiếng Việt đã đổi hoặc không còn trên website từ lúc xuất file. Xuất file mới để dịch các câu đó.</AdminNotice> : null}
        {plan.problems.length ? <ul className="admin-import__rows" aria-label="Dòng cần xem lại">{plan.problems.map((problem) => <li className={`admin-import__row admin-import__row--${problem.skipped ? "error" : "unchanged"}`} key={`${problem.key}-${problem.skipped}`}>
          <div><strong>{shown(problem.source)}</strong><AdminStatusBadge tone={problem.skipped ? "error" : "warning"}>{problem.skipped ? "Bỏ qua" : "Cảnh báo"}</AdminStatusBadge></div>
          <ul className="admin-import__errors"><li>{problem.message}</li></ul>
        </li>)}</ul> : null}
        {plan.samples.length ? <ul className="admin-import__rows">{plan.samples.map((row) => <li className={`admin-import__row admin-import__row--${row.status}`} key={row.key}>
          <div><strong>{shown(row.source)}</strong><AdminStatusBadge tone={statusLabels[row.status].tone}>{statusLabels[row.status].label}</AdminStatusBadge></div>
          <ul className="admin-import__changes"><li><span>{row.before ? "Bản dịch hiện có" : "Bản dịch mới"}:</span> {row.before ? <>{shown(row.before)} → </> : null}{shown(row.after)}</li></ul>
        </li>)}</ul> : null}
        {plan.samples.length && changes > plan.samples.length ? <small className="admin-text-muted">Hiện {plan.samples.length} dòng đầu; tổng {numberFormatter.format(changes)} bản dịch sẽ được lưu.</small> : null}
      </section> : null}
    </div>
  </AdminCard>;
}
