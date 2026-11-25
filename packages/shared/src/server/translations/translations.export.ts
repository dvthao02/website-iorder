import type { TranslationExportScope } from "./translations.contract";
import { translationGroupIds, translationGroupLabel, type TranslationGroupId } from "./translations.groups";
import type { StoredTranslation } from "./translations.repository";
import type { SourceUnit } from "./translations.source";
import { createSuggester } from "./translations.suggest";

export type StoredForExport = Pick<StoredTranslation, "sourceText" | "value">;

/** Bản dịch đang có hiệu lực của một câu: chỉ khi câu gốc lưu cùng bản dịch vẫn đúng là câu hiện tại (câu gốc đã sửa thì coi như chưa dịch). */
export const currentTranslation = (row: StoredForExport | undefined, unit: Pick<SourceUnit, "text">) => row && row.sourceText === unit.text ? row.value : "";

/** Mọi câu đã có bản dịch còn hiệu lực (cả chữ giao diện và nội dung CMS), làm nguồn gợi ý cho các câu giống nó. */
export function translatedSources(units: Iterable<SourceUnit>, stored: ReadonlyMap<string, StoredForExport>) {
  const sources: Array<{ text: string; value: string }> = [];
  for (const unit of units) {
    const value = currentTranslation(stored.get(unit.key), unit);
    if (value) sources.push({ text: unit.text, value });
  }
  return sources;
}

export type ExportOptions = {
  scope: TranslationExportScope;
  /** Chỉ xuất câu có dùng ở một trong các vùng này; bỏ trống hoặc đủ mọi vùng là không lọc. */
  groups?: readonly TranslationGroupId[];
  /** Điền sẵn gợi ý vào ô dịch của câu chưa dịch (kèm ghi chú nguồn gợi ý) để người dịch duyệt. */
  suggest?: boolean;
};

/**
 * Các dòng của file xuất: [khóa, câu tiếng Việt, bản dịch hiện có hoặc gợi ý (rỗng nếu chưa có), nơi dùng, số nơi dùng, vùng, ghi chú gợi ý].
 * `missing` chỉ giữ các câu chưa có bản dịch còn hiệu lực; `all` giữ mọi câu. Gợi ý chỉ điền cho câu chưa dịch và luôn kèm ghi chú nói rõ lấy từ câu nào.
 */
export function exportRows(units: Iterable<SourceUnit>, stored: ReadonlyMap<string, StoredForExport>, options: ExportOptions) {
  const list = [...units];
  const wanted = options.groups && options.groups.length && options.groups.length < translationGroupIds.length ? new Set<string>(options.groups) : undefined;
  const suggestFor = options.suggest ? createSuggester(translatedSources(list, stored)) : undefined;
  const rows: Array<string | number>[] = [];
  let suggested = 0;
  for (const unit of list) {
    if (wanted && !unit.groups.some((group) => wanted.has(group))) continue;
    const current = currentTranslation(stored.get(unit.key), unit);
    if (options.scope === "missing" && current !== "") continue;
    let value = current;
    let note = "";
    const suggestion = !current && suggestFor ? suggestFor(unit.text) : undefined;
    if (suggestion) { value = suggestion.value; note = `Gợi ý từ câu “${suggestion.from}”. Kiểm tra rồi giữ hoặc sửa.`; suggested += 1; }
    const places = unit.places.join("  |  ") + (unit.uses > unit.places.length ? "  | …" : "");
    rows.push([unit.key, unit.text, value, places, unit.uses, unit.groups.map(translationGroupLabel).join(", "), note]);
  }
  return { rows, suggested };
}

/** Tên file tải về: file chỉ có câu chưa dịch có thêm "chua-dich", file theo vùng có thêm mã vùng (hoặc số vùng nếu nhiều) để không nhầm với file đầy đủ. */
export function exportFileName(localeCode: string, options: Pick<ExportOptions, "scope" | "groups">, day: string, format: "xlsx" | "csv") {
  const groups = options.groups && options.groups.length && options.groups.length < translationGroupIds.length ? options.groups : [];
  const area = groups.length === 0 ? "" : groups.length <= 3 ? `-${groups.join("-")}` : `-${groups.length}-vung`;
  return `ban-dich-${localeCode}${options.scope === "missing" ? "-chua-dich" : ""}${area}-${day}.${format}`;
}
