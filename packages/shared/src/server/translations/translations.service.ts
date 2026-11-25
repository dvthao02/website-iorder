import { buildXlsx } from "../shared/xlsx";
import { buildCsv, readTable, TabularFileError } from "../data-transfer/tabular";
import { defaultLocale, findTranslationLocale, isTranslationLocale, sortLocaleCodes, translationLocales, type SiteLocale, type TranslationLocale } from "./locales";
import type { TranslationImportPlan, TranslationOverview } from "./translations.contract";
import { exportFileName, exportRows, translatedSources, type ExportOptions } from "./translations.export";
import { translationGroups } from "./translations.groups";
import { createSuggester } from "./translations.suggest";
import { getTranslationLocaleSetting, saveTranslationLocaleSetting } from "./translations.locale-setting";
import { listLocalesWithTranslations, listTranslations, saveTranslations, type StoredTranslation } from "./translations.repository";
import { collectSourceUnits, type SourceUnit } from "./translations.source";
import { mapTranslatable, sourceKey } from "./translatable";
import { isUiMessageKey, messagePlaceholders, storedUiKey, uiKeyPrefix, uiMessageKeys, uiMessages, uiStoredKeyPattern } from "./ui-messages";

// ---------- Thay bản dịch khi trả nội dung công khai ----------

// Bảng tra được giữ trong bộ nhớ vài giây: mỗi lượt website tải nội dung không phải truy vấn lại hàng nghìn dòng. Nhập bản dịch xóa cache ngay.
const cacheMs = 15_000;
const lookupCache = new Map<string, { at: number; rows: Map<string, StoredTranslation> }>();
let localesCache: { at: number; locales: SiteLocale[] } | undefined;

export function invalidateTranslationCache() {
  lookupCache.clear();
  localesCache = undefined;
}

async function getRows(locale: TranslationLocale) {
  const cached = lookupCache.get(locale);
  if (cached && Date.now() - cached.at < cacheMs) return cached.rows;
  const rows = new Map((await listTranslations(locale)).map((row) => [row.sourceKey, row]));
  lookupCache.set(locale, { at: Date.now(), rows });
  return rows;
}

/**
 * Thay các câu tiếng Việt trong nội dung công khai bằng bản dịch của `locale`. Câu chưa có bản dịch giữ tiếng Việt; ngôn ngữ gốc hoặc lạ
 * thì trả nguyên nội dung. Không sửa `body` gốc.
 */
export async function localizeContent<T>(body: T, locale: string | null | undefined): Promise<T> {
  if (!isTranslationLocale(locale)) return body;
  const rows = await getRows(locale);
  if (!rows.size) return body;
  return mapTranslatable(body, (core) => rows.get(sourceKey(core))?.value);
}

/**
 * Bản dịch chữ cố định trong giao diện website: chỉ các khóa đã dịch, và chỉ khi câu tiếng Việt trong code vẫn là câu lúc dịch
 * (sửa câu gốc thì bản dịch cũ ngừng áp dụng). Ngôn ngữ gốc trả rỗng: website dùng tiếng Việt trong code.
 */
export async function getUiMessages(locale: string | null | undefined): Promise<Record<string, string>> {
  if (!isTranslationLocale(locale)) return {};
  const rows = await getRows(locale);
  const messages: Record<string, string> = {};
  for (const key of uiMessageKeys) {
    const row = rows.get(storedUiKey(key));
    if (row && row.sourceText === uiMessages[key] && row.value) messages[key] = row.value;
  }
  return messages;
}

/** Ngôn ngữ website đang có: tiếng Việt và mọi ngôn ngữ đã nhập ít nhất một bản dịch (nút đổi ngôn ngữ chỉ hiện khi có từ hai ngôn ngữ). */
export async function getSiteLocales(): Promise<SiteLocale[]> {
  if (localesCache && Date.now() - localesCache.at < cacheMs) return localesCache.locales;
  const withTranslations = new Set(await listLocalesWithTranslations());
  const locales: SiteLocale[] = [defaultLocale, ...translationLocales.map((locale) => locale.code).filter((code) => withTranslations.has(code))];
  localesCache = { at: Date.now(), locales };
  return locales;
}

// Bản dịch đang có hiệu lực của một câu: chỉ khi câu gốc lưu cùng bản dịch vẫn đúng là câu hiện tại.
const currentValue = (stored: StoredTranslation | undefined, unit: SourceUnit) => stored && stored.sourceText === unit.text ? stored.value : undefined;
const isUiKey = (key: string) => key.startsWith(uiKeyPrefix);

// ---------- Tổng quan ----------

/**
 * Ngôn ngữ đang dùng: các ngôn ngữ người vận hành đã thêm cùng mọi ngôn ngữ đã có bản dịch (dù bản dịch nhập bằng cách nào, ngôn ngữ đó
 * không bao giờ biến mất khỏi CMS và vẫn hiện cho khách). Theo thứ tự danh mục.
 */
async function getEnabledLocales() {
  const [setting, withTranslations] = await Promise.all([getTranslationLocaleSetting(), listLocalesWithTranslations()]);
  return { locales: translationLocales.filter((locale) => setting.codes.includes(locale.code) || withTranslations.includes(locale.code)), version: setting.version };
}

export async function getTranslationOverview(): Promise<TranslationOverview> {
  const [units, enabled] = await Promise.all([collectSourceUnits(), getEnabledLocales()]);
  const uiTotal = [...units.keys()].filter(isUiKey).length;
  const groups = translationGroups
    .map((group) => ({ id: group.id, label: group.label, total: [...units.values()].filter((unit) => unit.groups.includes(group.id)).length }))
    .filter((group) => group.total > 0);
  const locales = await Promise.all(enabled.locales.map(async (locale) => {
    const stored = await listTranslations(locale.code);
    const byKey = new Map(stored.map((row) => [row.sourceKey, row]));
    const current = stored.filter((row) => { const unit = units.get(row.sourceKey); return unit && unit.text === row.sourceText; });
    const translated = current.length;
    const missingUnits = [...units.values()].filter((unit) => currentValue(byKey.get(unit.key), unit) === undefined);
    const missingByGroup = Object.fromEntries(groups.map((group) => [group.id, missingUnits.filter((unit) => unit.groups.includes(group.id)).length]));
    const suggest = createSuggester(translatedSources(units.values(), byKey));
    return {
      code: locale.code, name: locale.name, label: locale.label, translated, uiTranslated: current.filter((row) => isUiKey(row.sourceKey)).length,
      missing: units.size - translated, unused: stored.length - translated, missingByGroup, suggestible: missingUnits.filter((unit) => suggest(unit.text)).length,
    };
  }));
  const available = translationLocales.filter((locale) => !enabled.locales.some((item) => item.code === locale.code)).map(({ code, name, label }) => ({ code, name, label }));
  return { version: enabled.version, available, total: units.size, uiTotal, groups, locales };
}

/** Thêm hoặc gỡ ngôn ngữ thất bại vì ngôn ngữ muốn gỡ đã có bản dịch (gỡ sẽ làm khách mất bản dịch đã nhập). */
export class TranslationLocaleInUseError extends Error {
  constructor(public readonly labels: string[]) {
    super(`Không gỡ được ${labels.join(", ")} vì đã có bản dịch. Chỉ gỡ được ngôn ngữ chưa có bản dịch nào.`);
    this.name = "TranslationLocaleInUseError";
  }
}

/**
 * Đặt danh sách ngôn ngữ đã thêm (CMS gửi lại cả danh sách và version đã đọc; sai version thì 409). Ngôn ngữ đã có bản dịch không gỡ được.
 * Thêm ngôn ngữ chưa làm website đổi gì: nút chọn ngôn ngữ chỉ hiện khi ngôn ngữ đó có ít nhất một bản dịch.
 */
export async function updateTranslationLocales(codes: readonly TranslationLocale[], userId: string, expectedVersion: number) {
  const next = sortLocaleCodes(codes);
  const [current, withTranslations] = await Promise.all([getTranslationLocaleSetting(), listLocalesWithTranslations()]);
  const inUse = current.codes.filter((code) => !next.includes(code) && withTranslations.includes(code));
  if (inUse.length) throw new TranslationLocaleInUseError(inUse.map((code) => findTranslationLocale(code)?.label ?? code));
  const saved = await saveTranslationLocaleSetting(next, userId, expectedVersion);
  invalidateTranslationCache();
  return saved;
}

// ---------- Xuất file ----------

const exportSheetName = "Bản dịch";
const exportColumns = (locale: { code: string; name: string }) => [
  { header: "Khóa (không sửa)", width: 28 },
  { header: "Tiếng Việt (gốc)", width: 60 },
  { header: `${locale.code} · ${locale.name} (điền bản dịch)`, width: 60 },
  { header: "Dùng ở", width: 50 },
  { header: "Số nơi dùng", width: 12 },
  { header: "Vùng", width: 34 },
  { header: "Ghi chú (không nhập)", width: 44 },
];

/**
 * File mẫu để dịch: mỗi dòng là một câu tiếng Việt đang dùng trên website (khóa, câu gốc, ô điền bản dịch, nơi dùng); chữ cố định của giao diện
 * đứng đầu với khóa là tên (ui.header.openMenu), rồi tới nội dung CMS với khóa là mã băm. Bản dịch đã có được điền sẵn.
 * Xuất lại sau khi nội dung đổi thì câu mới hoặc câu vừa sửa hiện với ô dịch trống.
 * `options.scope`: "all" xuất mọi câu; "missing" chỉ các câu chưa có bản dịch (file nhẹ, đủ để dịch tiếp phần còn thiếu). `options.groups`: chỉ xuất các vùng đã chọn
 * (mặc định mọi vùng). `options.suggest`: điền sẵn gợi ý cho câu chưa dịch. Không có dòng nào khớp thì báo lỗi thay vì trả file rỗng.
 * Kết quả có thêm `suggested`: số ô dịch được điền sẵn bằng gợi ý.
 */
export async function exportTranslationFile(localeCode: TranslationLocale, format: "xlsx" | "csv", options: Partial<ExportOptions> = {}) {
  const resolved: ExportOptions = { scope: options.scope ?? "all", groups: options.groups, suggest: options.suggest ?? false };
  const locale = findTranslationLocale(localeCode);
  if (!locale) throw new TabularFileError("Ngôn ngữ không hợp lệ.");
  const [units, stored] = await Promise.all([collectSourceUnits(), listTranslations(localeCode)]);
  const { rows, suggested } = exportRows(units.values(), new Map(stored.map((row) => [row.sourceKey, row])), resolved);
  if (rows.length === 0) throw new TabularFileError(resolved.scope === "missing" ? "Không còn câu nào chưa dịch ở các vùng đã chọn. Hãy xuất tất cả nếu muốn rà soát bản dịch đã có." : "Các vùng đã chọn chưa có câu nào cần dịch.");
  const columns = exportColumns(locale);
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  const fileName = exportFileName(localeCode, resolved, day, format);
  return format === "xlsx"
    ? { body: buildXlsx(exportSheetName, columns, rows), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName, rows: rows.length, suggested }
    : { body: buildCsv(columns.map((column) => column.header), rows), contentType: "text/csv; charset=utf-8", fileName, rows: rows.length, suggested };
}

// ---------- Nhập file ----------

/** File bản dịch có thể lớn hơn file nhập dữ liệu thường (hàng nghìn câu); vẫn chặn file bất thường. */
export const translationImportLimits = { maxBytes: 8 * 1024 * 1024, maxRows: 20_000 } as const;
const maxValueLength = 8000;
const sampleLimit = 30;
const problemLimit = 30;
// Bản dịch dài gấp đôi câu gốc (cộng 40 ký tự) trở lên thường làm vỡ giao diện (nút, nhãn): chỉ cảnh báo, vẫn nhập.
const longRatio = 2;
const longSlack = 40;

type PlannedRow = { key: string; text: string; value: string; status: "create" | "update" };

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").toLowerCase().trim();
}

function findColumns(header: string[], locale: { code: string; name: string }) {
  const normalized = header.map(normalizeHeader);
  const keyColumn = normalized.findIndex((name) => name.startsWith("khoa") || name === "key");
  const valueColumn = normalized.findIndex((name) => name === locale.code || name.startsWith(`${locale.code} `) || name.startsWith(`${locale.code}·`) || name.includes(locale.name.toLowerCase()));
  return { keyColumn: keyColumn >= 0 ? keyColumn : 0, valueColumn: valueColumn >= 0 ? valueColumn : 2 };
}

// Excel/CSV thêm dấu ' trước ô bắt đầu bằng = + - @ để không bị hiểu là công thức: bỏ lại khi đọc.
function cleanCell(raw: string | undefined) {
  const text = (raw ?? "").trim();
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

// Khóa nội dung là mã băm thập lục phân (không phân biệt hoa thường khi người dịch sửa trong Excel); khóa chữ cố định giữ nguyên chữ hoa/thường.
function normalizeKey(raw: string) {
  return /^[0-9a-f]{16}$/i.test(raw) ? raw.toLowerCase() : raw;
}

/** Chữ cố định có biến {ten}: bản dịch phải giữ đúng các biến đó, thiếu hoặc thừa sẽ làm hỏng câu. */
function placeholderProblem(source: string, value: string) {
  const expected = messagePlaceholders(source).sort();
  const actual = messagePlaceholders(value).sort();
  if (expected.join(",") === actual.join(",")) return null;
  return `Bản dịch phải giữ đúng các biến ${expected.length ? expected.map((name) => `{${name}}`).join(", ") : "(không có biến)"} của câu gốc.`;
}

async function planImport(localeCode: TranslationLocale, file: { name: string; bytes: Buffer; sheetName?: string }, overwrite: boolean) {
  const locale = findTranslationLocale(localeCode);
  if (!locale) throw new TabularFileError("Ngôn ngữ không hợp lệ.");
  const table = readTable(file, translationImportLimits);
  if (table.length < 2) throw new TabularFileError("File chưa có dòng dữ liệu nào. Hãy xuất file mẫu rồi điền bản dịch vào cột ngôn ngữ.");
  const { keyColumn, valueColumn } = findColumns(table[0], locale);
  if (table[0].length <= Math.max(keyColumn, valueColumn)) throw new TabularFileError("File thiếu cột bản dịch. Hãy dùng đúng file mẫu đã xuất (có các cột Khóa, Tiếng Việt và cột bản dịch của ngôn ngữ này).");

  const [units, stored] = await Promise.all([collectSourceUnits(), listTranslations(localeCode)]);
  const existing = new Map(stored.map((row) => [row.sourceKey, row]));
  const counts = { create: 0, update: 0, unchanged: 0, kept: 0, empty: 0, stale: 0, invalid: 0 };
  const samples: TranslationImportPlan["samples"] = [];
  const problems: TranslationImportPlan["problems"] = [];
  const planned: PlannedRow[] = [];
  const seen = new Set<string>();
  const addProblem = (key: string, source: string, message: string, skipped: boolean) => { if (problems.length < problemLimit) problems.push({ key, source, message, skipped }); };

  for (const row of table.slice(1)) {
    const key = normalizeKey(cleanCell(row[keyColumn]));
    const value = cleanCell(row[valueColumn]);
    if (!key && !value) continue; // dòng trống ở cuối bảng
    if (!(/^[0-9a-f]{16}$/.test(key) || uiStoredKeyPattern.test(key)) || value.length > maxValueLength) { counts.invalid += 1; continue; }
    if (!value) { counts.empty += 1; continue; }
    const unit = units.get(key);
    if (!unit) { counts.stale += 1; continue; }
    if (seen.has(key)) { counts.invalid += 1; continue; }
    seen.add(key);
    if (isUiKey(key) && !isUiMessageKey(key.slice(uiKeyPrefix.length))) { counts.stale += 1; continue; }
    // Chữ cố định có biến {ten}: thiếu/thừa biến thì bỏ qua dòng (nhập vào sẽ làm hỏng câu trên website).
    const placeholder = isUiKey(key) ? placeholderProblem(unit.text, value) : null;
    if (placeholder) { counts.invalid += 1; addProblem(key, unit.text, placeholder, true); continue; }
    if (value.length > unit.text.length * longRatio + longSlack) addProblem(key, unit.text, `Bản dịch dài ${value.length} ký tự, gấp hơn ${longRatio} lần câu gốc (${unit.text.length}); có thể làm vỡ giao diện.`, false);
    const before = currentValue(existing.get(key), unit);
    if (before === value) { counts.unchanged += 1; continue; }
    // Bản dịch cũ của một câu gốc đã được sửa không còn hiệu lực: coi như chưa có, ghi đè không cần bật tùy chọn.
    const hasOld = existing.has(key) && before !== undefined;
    const status = !hasOld ? "create" : overwrite ? "update" : "kept";
    counts[status] += 1;
    if (samples.length < sampleLimit) samples.push({ key, source: unit.text, before: before ?? "", after: value, status });
    if (status !== "kept") planned.push({ key, text: unit.text, value, status });
  }
  const plan: TranslationImportPlan = { locale: localeCode, total: table.length - 1, counts, samples, problems };
  return { plan, planned };
}

export async function previewTranslationImport(localeCode: TranslationLocale, file: { name: string; bytes: Buffer; sheetName?: string }, overwrite: boolean) {
  return (await planImport(localeCode, file, overwrite)).plan;
}

/** Áp dụng: chỉ thêm câu chưa có bản dịch (và sửa câu đã có khi `overwrite`); câu đã có bản dịch khác được giữ nguyên. */
export async function applyTranslationImport(localeCode: TranslationLocale, file: { name: string; bytes: Buffer; sheetName?: string }, overwrite: boolean, userId: string) {
  const { plan, planned } = await planImport(localeCode, file, overwrite);
  if (planned.length) {
    await saveTranslations({ locale: localeCode, rows: planned.map((row) => ({ sourceKey: row.key, sourceText: row.text, value: row.value })), userId, summary: { created: plan.counts.create, updated: plan.counts.update } });
    invalidateTranslationCache();
  }
  return { created: plan.counts.create, updated: plan.counts.update, unchanged: plan.counts.unchanged, kept: plan.counts.kept, empty: plan.counts.empty, stale: plan.counts.stale, invalid: plan.counts.invalid };
}
