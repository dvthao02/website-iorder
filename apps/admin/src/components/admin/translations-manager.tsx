"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { translationImportPlanSchema, translationImportResultSchema, type TranslationExportScope, type TranslationImportPlan, type TranslationOverview } from "@iorder/shared/server/translations/translations.contract";
import { adminApiError, readAdminJson, requestAdminJson } from "../../lib/admin-api";
import { saveResponseAsFile } from "../../lib/download-file";
import { AdminButton } from "./ui/admin-button";
import { AdminFileIcon, fileKindOf } from "./ui/admin-file-icon";
import { AdminNotice, AdminStatusBadge, useAdminToast, type AdminFeedbackTone } from "./ui/admin-feedback";
import { AdminHelpTip } from "./ui/admin-help-tip";
import { useAdminPermissions } from "./ui/admin-permissions";
import { AdminSelect } from "./ui/admin-select";
import { AdminSwitch } from "./ui/admin-switch";

type Locale = TranslationOverview["locales"][number];
type AvailableLocale = TranslationOverview["available"][number];

const numberFormatter = new Intl.NumberFormat("vi-VN");
const percentFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
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
 * Màn "Đa ngôn ngữ", dàn gọn: hàng đầu có lời nhắn ngắn và ô thêm ngôn ngữ từ danh mục (gỡ được ngôn ngữ chưa có bản dịch nào), dưới là mỗi ngôn ngữ một
 * bảng gập (chỉ một bảng mở một lúc; mặc định mở bảng đầu, ngôn ngữ vừa thêm thì mở luôn). Dòng tóm tắt của bảng gập đã đủ tên, tiến độ và số câu còn thiếu.
 * Mở ra có hai cột: xuất file để dịch (chọn xuất tất cả hay chỉ các câu chưa dịch, rồi Excel hoặc CSV; vùng cần dịch và gợi ý nằm gọn trong phần tùy chọn)
 * và nhập lại file đã dịch có xem trước. Nhập chỉ thêm các câu chưa có bản dịch; bản dịch đã có giữ nguyên trừ khi người dùng bật "cập nhật cả bản dịch đã có".
 */
export function TranslationsManager({ overview }: { overview: TranslationOverview | null }) {
  const router = useRouter();
  return <TranslationsView onRefresh={() => router.refresh()} overview={overview} />;
}

/**
 * Bảng ngôn ngữ nào đang mở sau một sự kiện mở/đóng: bảng vừa mở là bảng duy nhất mở; đóng đúng bảng đang mở thì không bảng nào mở; sự kiện đóng của một bảng
 * đã bị gập vì bảng khác vừa mở (trình duyệt bắn sự kiện cả khi mã đổi thuộc tính `open`) thì bỏ qua, không làm gập bảng mới.
 */
export function nextOpenLocale(current: string | null, code: string, open: boolean) {
  return open ? code : current === code ? null : current;
}

/** Bảng đang mở trên màn hình: bảng đã chọn mở mà vừa bị gỡ khỏi danh sách thì chuyển sang bảng đầu; người dùng tự đóng hết (null) thì giữ nguyên. */
export function visibleOpenLocale(current: string | null, codes: readonly string[]) {
  return current !== null && !codes.includes(current) ? codes[0] ?? null : current;
}

/** Tên ngôn ngữ giữa câu thông báo: chỉ hạ chữ đầu ("Tiếng Nhật" → "tiếng Nhật"), giữ nguyên tên riêng phía sau. */
export function inSentence(label: string) {
  return label.charAt(0).toLocaleLowerCase("vi") + label.slice(1);
}

/** Phần hiển thị của màn "Đa ngôn ngữ" (tách khỏi router để kiểm thử được); `onRefresh` tải lại số liệu sau khi nhập. */
export function TranslationsView({ onRefresh, overview }: { onRefresh: () => void; overview: TranslationOverview | null }) {
  if (!overview) return <AdminNotice tone="error">Không tải được tổng quan bản dịch. Hãy tải lại trang hoặc thử lại sau.</AdminNotice>;
  return <TranslationsContent onRefresh={onRefresh} overview={overview} />;
}

function TranslationsContent({ onRefresh, overview }: { onRefresh: () => void; overview: TranslationOverview }) {
  const { show } = useAdminToast();
  const [saving, setSaving] = useState(false);

  // Gửi cả danh sách ngôn ngữ mong muốn kèm version đã đọc; người khác vừa đổi (409) thì báo và không ghi.
  async function saveLocales(codes: string[], success: string, hidden?: string[]) {
    if (saving) return false;
    setSaving(true);
    try {
      await requestAdminJson("/api/v1/admin/translations", "PUT", { locales: codes, ...(hidden ? { hidden } : {}), expectedVersion: overview.version }, "Không lưu được danh sách ngôn ngữ.");
      show(success, "success");
      onRefresh();
      return true;
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "Không lưu được danh sách ngôn ngữ lúc này.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const codes = overview.locales.map((locale) => locale.code);
  const hiddenCodes = overview.locales.filter((locale) => !locale.visible).map((locale) => locale.code);
  // Bật/tắt hiển thị cho khách: có hiệu lực ngay (website cập nhật trong khoảng 15 giây); bản dịch luôn được giữ.
  const setVisible = (locale: Locale, visible: boolean) => void saveLocales(codes, visible ? `Đã bật ${inSentence(locale.label)} cho khách.` : `Đã tắt ${inSentence(locale.label)}: khách không còn thấy ngôn ngữ này, bản dịch vẫn được giữ.`, visible ? hiddenCodes.filter((code) => code !== locale.code) : [...hiddenCodes, locale.code]);
  // Chỉ một bảng mở một lúc: mặc định bảng đầu; mở bảng khác thì bảng đang mở gập lại; ngôn ngữ vừa thêm mở luôn.
  const [openCode, setOpenCode] = useState<string | null>(overview.locales[0]?.code ?? null);
  const openNow = visibleOpenLocale(openCode, codes);
  const toggle = (code: string, open: boolean) => setOpenCode((current) => nextOpenLocale(visibleOpenLocale(current, codes), code, open));
  async function addLocale(locale: AvailableLocale) {
    const added = await saveLocales([...codes, locale.code], `Đã thêm ${inSentence(locale.label)}. Mở bảng của ngôn ngữ này để xuất file và bắt đầu dịch.`);
    if (added) setOpenCode(locale.code);
    return added;
  }
  return <div className="grid gap-3">
    <div className="admin-translation-top">
      <AdminNotice tone="info">Đường dẫn và slug giữ nguyên; câu chưa dịch vẫn hiện tiếng Việt. Khách chọn ngôn ngữ bằng nút ở đầu website khi ngôn ngữ đó đã có bản dịch.</AdminNotice>
      <AddLocale available={overview.available} busy={saving} onAdd={addLocale} />
    </div>
    {overview.locales.length === 0 ? <AdminNotice tone="info">Chưa thêm ngôn ngữ nào. Chọn một ngôn ngữ ở ô phía trên để bắt đầu dịch.</AdminNotice> : null}
    {overview.locales.map((locale) => <LocaleCard groups={overview.groups} key={locale.code} locale={locale} onRefresh={onRefresh} onRemove={() => void saveLocales(codes.filter((code) => code !== locale.code), `Đã gỡ ${inSentence(locale.label)}.`)} onToggle={(open) => toggle(locale.code, open)} onVisibleChange={(visible) => setVisible(locale, visible)} open={openNow === locale.code} removing={saving} total={overview.total} uiTotal={overview.uiTotal} />)}
  </div>;
}

/** Chọn thêm một ngôn ngữ từ danh mục (chỉ người có quyền sửa cài đặt thấy), gọn trên một hàng. Thêm xong chưa làm website đổi gì cho tới khi nhập bản dịch. */
function AddLocale({ available, busy, onAdd }: { available: AvailableLocale[]; busy: boolean; onAdd: (locale: AvailableLocale) => Promise<boolean> }) {
  const { can } = useAdminPermissions();
  const [code, setCode] = useState("");
  if (!can("settings.update")) return null;
  if (available.length === 0) return <small className="admin-text-muted">Đã thêm mọi ngôn ngữ trong danh mục.</small>;
  const chosen = available.find((locale) => locale.code === code);
  return <form className="admin-translation-add" onSubmit={(event) => { event.preventDefault(); if (chosen) void onAdd(chosen).then((added) => { if (added) setCode(""); }); }}>
    <label className="sr-only" htmlFor="translation-add-locale">Ngôn ngữ cần thêm</label>
    <AdminSelect disabled={busy} id="translation-add-locale" onChange={(event) => setCode(event.target.value)} value={code}>
      <option value="">Chọn ngôn ngữ để thêm…</option>
      {available.map((locale) => <option key={locale.code} value={locale.code}>{locale.name} · {locale.label} ({locale.code})</option>)}
    </AdminSelect>
    <AdminButton disabled={busy || !chosen} type="submit">{busy ? "Đang lưu…" : "Thêm ngôn ngữ"}</AdminButton>
  </form>;
}

function LocaleCard({ groups, locale, onRefresh, onRemove, onToggle, onVisibleChange, open, removing, total, uiTotal }: { groups: TranslationOverview["groups"]; locale: Locale; onRefresh: () => void; onRemove: () => void; onToggle: (open: boolean) => void; onVisibleChange: (visible: boolean) => void; open: boolean; removing: boolean; total: number; uiTotal: number }) {
  const { show } = useAdminToast();
  const { can } = useAdminPermissions();
  const canImport = can("settings.update");
  const [scopeChoice, setScopeChoice] = useState<TranslationExportScope>(locale.missing > 0 ? "missing" : "all");
  // Vùng đã bỏ chọn (mặc định không bỏ vùng nào = xuất mọi vùng) và có điền sẵn gợi ý hay không.
  const [skipped, setSkipped] = useState<string[]>([]);
  const [suggest, setSuggest] = useState(true);
  const [exporting, setExporting] = useState<"xlsx" | "csv" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [plan, setPlan] = useState<TranslationImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/v1/admin/translations/${locale.code}`;
  const complete = locale.missing === 0;
  // Ngôn ngữ chưa có bản dịch nào (kể cả bản dịch cũ không còn dùng) thì gỡ được mà không mất gì; đã có bản dịch thì giữ để không mất công dịch.
  const removable = locale.translated + locale.unused === 0;
  // Dịch đủ rồi (kể cả sau khi nhập xong) thì không còn gì để chọn "chỉ câu chưa dịch": tự về "tất cả".
  const scope: TranslationExportScope = complete ? "all" : scopeChoice;
  const ratio = total ? locale.translated / total : 0;
  const uiMissing = Math.max(0, uiTotal - locale.uiTranslated);
  const contentMissing = Math.max(0, locale.missing - uiMissing);
  const changes = plan ? plan.counts.create + plan.counts.update : 0;
  // Số câu của từng vùng theo phạm vi đang chọn (chưa dịch hoặc tất cả); vùng không còn câu nào để xuất thì khóa lại.
  const groupCount = (group: (typeof groups)[number]) => scope === "missing" ? locale.missingByGroup[group.id] ?? 0 : group.total;
  const available = groups.filter((group) => groupCount(group) > 0);
  const chosen = available.filter((group) => !skipped.includes(group.id));
  const allChosen = chosen.length === available.length;
  const withSuggestions = suggest && locale.suggestible > 0;
  const query = new URLSearchParams({ scope });
  if (!allChosen) query.set("groups", chosen.map((group) => group.id).join(","));
  if (withSuggestions) query.set("suggest", "1");

  async function download(format: "xlsx" | "csv") {
    if (exporting) return;
    setExporting(format); setError("");
    try {
      const response = await fetch(`${endpoint}?${new URLSearchParams({ format })}&${query}`);
      if (!response.ok) throw adminApiError(await readAdminJson(response), "Không tạo được file bản dịch.", response.status);
      const name = await saveResponseAsFile(response, `ban-dich-${locale.code}.${format}`);
      const rows = Number(response.headers.get("x-translation-rows"));
      const suggested = Number(response.headers.get("x-translation-suggested"));
      show(`Đã tạo file ${name}${rows ? ` (${numberFormatter.format(rows)} dòng${suggested ? `, ${numberFormatter.format(suggested)} ô dịch điền sẵn gợi ý` : ""})` : ""}.`, "success");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Không tạo được file bản dịch lúc này.";
      setError(message);
      show(message, "error");
    } finally {
      setExporting(null);
    }
  }

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
      show(`Đã thêm ${result.data.created}, cập nhật ${result.data.updated} bản dịch ${inSentence(locale.label)}.`, "success");
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

  const scopes: Array<{ value: TranslationExportScope; title: string; count: number; disabled?: boolean }> = [
    { value: "missing", title: "Chỉ câu chưa dịch", count: locale.missing, disabled: complete },
    { value: "all", title: "Tất cả", count: total },
  ];
  // Một dòng nói rõ lựa chọn đang áp dụng (thay cho mô tả dài dưới từng lựa chọn).
  const scopeHint = complete
    ? "Đã dịch đủ, không còn câu nào để xuất riêng; xuất tất cả để rà soát hoặc sửa bản dịch cũ."
    : scope === "missing"
      ? `${numberFormatter.format(uiMissing)} chữ giao diện và ${numberFormatter.format(contentMissing)} câu nội dung. File gọn nhất để dịch tiếp phần còn thiếu.`
      : "Mọi câu đang dùng trên website, kèm bản dịch đã điền sẵn. Dùng để rà soát hoặc sửa bản dịch cũ.";

  return <details className="admin-post-editor__panel admin-translation" onToggle={(event) => onToggle(event.currentTarget.open)} open={open}>
    <summary>
      <span>
        <strong>{locale.name} <small>· {locale.label} (mã {locale.code})</small></strong>
        <small>{numberFormatter.format(locale.translated)}/{numberFormatter.format(total)} câu đã dịch ({percentFormatter.format(ratio * 100)}%)</small>
      </span>
      <span aria-label={`Tiến độ dịch ${locale.label}`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(ratio * 100)} className="admin-translation__bar" role="progressbar"><span style={{ width: `${ratio * 100}%` }} /></span>
      {locale.visible ? null : <AdminStatusBadge tone="neutral">Đang tắt với khách</AdminStatusBadge>}
      <AdminStatusBadge tone={complete ? "success" : "warning"}>{complete ? "Đã dịch đủ" : `Còn ${numberFormatter.format(locale.missing)} câu hiện tiếng Việt`}</AdminStatusBadge>
    </summary>
    <div className="admin-post-editor__panel-body">
      <AdminSwitch checked={locale.visible} description={locale.visible ? (locale.translated > 0 ? `Khách thấy nút chọn ${locale.name} ở đầu website.` : "Nút chọn ngôn ngữ chỉ hiện khi đã có ít nhất một bản dịch.") : "Đang tắt: khách không thấy ngôn ngữ này. Bản dịch vẫn được giữ, bật lại là hiện ngay."} disabled={!canImport || removing} label="Hiện cho khách trên website" onChange={onVisibleChange} />
      <div className="admin-translation__facts">
        <dl className="admin-translation__stats">
          <div><dt>Giao diện website</dt><dd>{numberFormatter.format(locale.uiTranslated)}/{numberFormatter.format(uiTotal)}</dd></div>
          <div><dt>Nội dung CMS</dt><dd>{numberFormatter.format(locale.translated - locale.uiTranslated)}/{numberFormatter.format(total - uiTotal)}</dd></div>
          <div><dt>Chưa dịch</dt><dd>{numberFormatter.format(locale.missing)}</dd></div>
        </dl>
        {locale.unused ? <small className="admin-text-muted">{numberFormatter.format(locale.unused)} bản dịch không còn câu gốc tương ứng (câu gốc đã sửa hoặc xóa).</small> : null}
        {removable ? <AdminButton disabled={removing} hideWithoutPermission onClick={onRemove} permission="settings.update" size="sm" variant="ghost">Gỡ ngôn ngữ</AdminButton> : null}
      </div>

      <div className="admin-translation__columns">
        <section aria-label="Xuất file để dịch" className="admin-translation__section">
          <div className="admin-label-row">
            <h3>1. Xuất file để dịch</h3>
            <AdminHelpTip label="Giải thích: file xuất">Mỗi file gồm cả nội dung CMS và chữ cố định của giao diện website (đứng đầu file); mỗi dòng có khóa, câu tiếng Việt, ô điền bản dịch và nơi dùng. Các cột Dùng ở, Số nơi dùng, Vùng và Ghi chú chỉ để tham khảo (lọc hoặc sắp xếp theo “Số nơi dùng” để dịch câu lặp nhiều nhất trước).</AdminHelpTip>
          </div>
          <fieldset className="admin-translation__scopes" disabled={Boolean(exporting)}>
            <legend className="sr-only">Các dòng cần xuất</legend>
            {scopes.map((item) => <label className={`admin-translation__scope${scope === item.value ? " admin-translation__scope--active" : ""}`} key={item.value}>
              <input checked={scope === item.value} disabled={item.disabled} name={`translation-scope-${locale.code}`} onChange={() => setScopeChoice(item.value)} type="radio" value={item.value} />
              <span><strong>{item.title}</strong> <em>{numberFormatter.format(item.count)} câu</em></span>
            </label>)}
          </fieldset>
          <small className="admin-text-muted">{scopeHint}</small>
          <details className="admin-translation__groups">
            <summary>Vùng cần dịch <small>({numberFormatter.format(chosen.length)}/{numberFormatter.format(available.length)} vùng đã chọn)</small></summary>
            <fieldset className="admin-translation__group-list" disabled={Boolean(exporting)}>
              <legend className="sr-only">Chọn vùng cần xuất</legend>
              <div className="admin-translation__group-actions">
                <AdminButton onClick={() => setSkipped([])} size="sm" variant="ghost">Chọn tất cả</AdminButton>
                <AdminButton onClick={() => setSkipped(groups.map((group) => group.id))} size="sm" variant="ghost">Bỏ chọn tất cả</AdminButton>
              </div>
              {groups.map((group) => {
                const count = groupCount(group);
                return <label className="admin-translation__group" key={group.id}>
                  <input checked={count > 0 && !skipped.includes(group.id)} disabled={count === 0} onChange={(event) => setSkipped((list) => event.target.checked ? list.filter((id) => id !== group.id) : [...list, group.id])} type="checkbox" />
                  <span>{group.label}</span>
                  <em>{count === 0 ? "đã dịch đủ" : `${numberFormatter.format(count)} câu`}</em>
                </label>;
              })}
              <small className="admin-text-muted">Một câu dùng ở nhiều vùng được tính ở mỗi vùng, nên tổng các vùng có thể lớn hơn tổng số câu. Cột “Vùng” trong file cho biết từng câu thuộc vùng nào.</small>
            </fieldset>
          </details>
          {locale.suggestible > 0 ? <div className="admin-label-row">
            <label className="admin-import__toggle"><input checked={suggest} disabled={Boolean(exporting)} onChange={(event) => setSuggest(event.target.checked)} type="checkbox" />Điền sẵn gợi ý từ câu giống đã dịch ({numberFormatter.format(locale.suggestible)} câu)</label>
            <AdminHelpTip label="Giải thích: gợi ý dịch">Chỉ áp dụng cho câu chưa dịch có câu giống đã dịch: chỉ khác hoa/thường, dấu câu cuối hoặc trùng chữ giao diện. Kiểm tra cột Ghi chú trong file rồi mới nhập.</AdminHelpTip>
          </div> : null}
          <div className="flex flex-wrap gap-2">
            <button className="admin-button admin-button--export admin-file-tone--excel" disabled={Boolean(exporting) || chosen.length === 0} onClick={() => void download("xlsx")} type="button"><AdminFileIcon action="export" kind="excel" size="sm" />{exporting === "xlsx" ? "Đang tạo file…" : "Tải Excel (.xlsx)"}</button>
            <button className="admin-button admin-button--export admin-file-tone--csv" disabled={Boolean(exporting) || chosen.length === 0} onClick={() => void download("csv")} type="button"><AdminFileIcon action="export" kind="csv" size="sm" />{exporting === "csv" ? "Đang tạo file…" : "Tải CSV"}</button>
          </div>
          <small className="admin-text-muted">{chosen.length === 0 ? "Chọn ít nhất một vùng để tải file. " : ""}Điền bản dịch vào cột “{locale.code} · {locale.name}”; không sửa cột Khóa và cột tiếng Việt.</small>
        </section>

        <section aria-label="Nhập file đã dịch" className="admin-translation__section">
          <div className="admin-label-row">
            <h3>2. Nhập file đã dịch</h3>
            <AdminHelpTip label="Giải thích: nhập file">Xuất lại bất cứ lúc nào để thấy câu mới hoặc câu vừa sửa. Câu đã có bản dịch chỉ bị thay khi bật “Cập nhật cả bản dịch đã có”.</AdminHelpTip>
          </div>
          {canImport ? <>
            <small className="admin-text-muted">File đầy đủ hay file chỉ có câu chưa dịch đều nhập được; chỉ thêm các câu chưa có bản dịch, câu đã dịch giữ nguyên.</small>
            <label className="admin-import__file"><AdminFileIcon action="import" kind={file ? fileKindOf(file.name) : "excel"} /><span>{file ? file.name : "Chọn file .xlsx hoặc .csv"}</span><input accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={choose} type="file" /></label>
            <label className="admin-import__toggle"><input checked={overwrite} disabled={busy} onChange={(event) => { setOverwrite(event.target.checked); setPlan(null); }} type="checkbox" />Cập nhật cả bản dịch đã có (mặc định chỉ thêm câu còn thiếu)</label>
            <div className="flex flex-wrap gap-2">
              <AdminButton disabled={busy || !file} onClick={() => void send("preview")} variant="secondary">{busy && !plan ? "Đang kiểm tra…" : "Kiểm tra file"}</AdminButton>
              {plan ? <AdminButton disabled={busy || changes === 0} onClick={() => void send("apply")}>{busy ? "Đang áp dụng…" : `Áp dụng ${numberFormatter.format(changes)} bản dịch`}</AdminButton> : null}
            </div>
          </> : <AdminNotice tone="info">Bạn chỉ xem và xuất được file; nhập bản dịch cần quyền sửa cài đặt website.</AdminNotice>}
        </section>
      </div>

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
  </details>;
}
