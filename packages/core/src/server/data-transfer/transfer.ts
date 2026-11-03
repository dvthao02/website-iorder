import type { z } from "zod";

import { hasCmsPermission, type CmsActor, type CmsModuleKey, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { toSlug } from "../shared/slug";
import type { TabularCell } from "./tabular";

// Bộ máy xuất/nhập dùng chung cho mọi bảng (kiểu "import sản phẩm" của Shopify/WordPress):
// - Xuất: mỗi dòng một bản ghi, cột có tiêu đề tiếng Việt; file xuất ra cũng là file mẫu để nhập lại.
// - Nhập: khớp theo slug — trùng thì cập nhật, mới thì thêm; KHÔNG xóa bản ghi vắng mặt trong file.
//   Chỉ cột có trong file mới được đổi, nên file chỉ gồm "slug + giá" là cập nhật giá hàng loạt.
// - Luôn xem trước rồi mới áp dụng; áp dụng kiểm lại phiên bản đã xem để không ghi đè sửa đổi mới hơn.

// value undefined: ô trống ở cột không có nghĩa "xóa" (số, Có/Không, trạng thái) → giữ nguyên giá trị đang có.
export type Parsed<T> = { ok: true; value: T | undefined } | { ok: false; error: string };

export type TransferField<TItem, V = unknown> = {
  key: string;
  header: string;
  width?: number;
  /** Bắt buộc có giá trị khi tạo bản ghi mới. */
  requiredOnCreate?: boolean;
  get: (item: TItem) => V;
  /** Giá trị ô khi xuất; cũng dùng để so sánh trước/sau khi nhập. */
  format: (value: V) => TabularCell;
  parse: (raw: string) => Parsed<V>;
};

/** Gom field có kiểu giá trị khác nhau vào một mảng mà không mất kiểm tra kiểu khi khai báo. */
export function field<TItem, V>(spec: TransferField<TItem, V>): TransferField<TItem, unknown> {
  return spec as TransferField<TItem, unknown>;
}

export type TransferItem = { id: string; slug: string; version: number };

export type TransferDataset<TItem extends TransferItem, TContext> = {
  id: string;
  label: string;
  /** Tên file xuất, không dấu (thêm ngày + đuôi khi tải). */
  fileName: string;
  module: CmsModuleKey;
  /**
   * Field đầu tiên là khóa khớp dòng với `item.slug` (thường là slug; bảng không có slug dùng tên hoặc đường dẫn nguồn).
   * Field "name" (nếu có và không phải khóa) dùng để tự tạo slug cho dòng mới.
   */
  fields: TransferField<TItem, unknown>[];
  /** Chuẩn hóa khóa trước khi so (ví dụ không phân biệt hoa thường/khoảng trắng khi khớp theo tên). Mặc định so nguyên văn. */
  matchKey?: (key: string) => string;
  load: () => Promise<{ items: TItem[]; context: TContext }>;
  /**
   * Dựng giá trị đầy đủ cho service từ bản ghi đang có (hoặc mặc định khi tạo mới) + các cột có trong file.
   * Trả lỗi nghiệp vụ (ví dụ nhóm không tồn tại) và trạng thái hiện trên website trước/sau để kiểm quyền xuất bản.
   */
  build: (changes: Record<string, unknown>, existing: TItem | undefined, context: TContext) => { input?: unknown; errors: string[]; live: { before: boolean; after: boolean } };
  /** Schema cuối cùng của service, để báo lỗi theo tên cột trước khi ghi. */
  schema: z.ZodType;
  write: (input: unknown, existing: TItem | undefined, actorId: string) => Promise<unknown>;
};

export type ImportChange = { field: string; header: string; before: string; after: string };
export type ImportRow = {
  row: number;
  slug: string;
  label: string;
  action: "create" | "update" | "unchanged" | "error";
  /** Phiên bản lúc xem trước (cập nhật): áp dụng gửi lại để phát hiện người khác vừa sửa. */
  version: number | null;
  changes: ImportChange[];
  errors: string[];
};
export type ImportPlan = {
  dataset: string;
  total: number;
  counts: { create: number; update: number; unchanged: number; error: number };
  /** Lỗi cả file (thiếu cột bắt buộc, cột lạ…), chặn áp dụng. */
  fileErrors: string[];
  /** Cột trong file không khớp cột nào (bị bỏ qua), để người dùng biết. */
  ignoredHeaders: string[];
  rows: ImportRow[];
};

type PlannedRow<TItem> = ImportRow & { input?: unknown; existing?: TItem };

const normalizeHeader = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
const display = (value: TabularCell) => value === null || value === undefined ? "" : String(value);

function headerIndex<TItem>(fields: TransferField<TItem, unknown>[], headers: string[]) {
  const byHeader = new Map(fields.flatMap((spec) => [[normalizeHeader(spec.header), spec], [normalizeHeader(spec.key), spec]] as const));
  const columns = new Map<string, number>();
  const ignored: string[] = [];
  headers.forEach((header, index) => {
    if (!header.trim()) return;
    const spec = byHeader.get(normalizeHeader(header));
    if (spec && !columns.has(spec.key)) columns.set(spec.key, index);
    else ignored.push(header.trim());
  });
  return { columns, ignored };
}

// Lỗi trong schema union (ví dụ nội dung bài v1/v2) bị Zod gói thành "Invalid input": lấy thông báo gốc bên trong.
function innerMessage(issue: z.core.$ZodIssue): string {
  if (issue.code === "invalid_union") {
    const nested = issue.errors.flat().find((inner) => inner.code === "custom") ?? issue.errors.flat()[0];
    if (nested) return innerMessage(nested);
  }
  return issue.message;
}

function zodMessages<TItem>(error: z.ZodError, fields: TransferField<TItem, unknown>[]) {
  return error.issues.map((issue) => {
    const key = String(issue.path[0] ?? "");
    const header = fields.find((spec) => spec.key === key)?.header;
    return header ? `Cột "${header}": giá trị không hợp lệ (${innerMessage(issue)}).` : `Dữ liệu không hợp lệ: ${innerMessage(issue)}`;
  });
}

export async function planImport<TItem extends TransferItem, TContext>(dataset: TransferDataset<TItem, TContext>, table: string[][], actor: CmsActor): Promise<{ plan: ImportPlan; rows: PlannedRow<TItem>[] }> {
  const [headerRow = [], ...body] = table;
  const { columns, ignored } = headerIndex(dataset.fields, headerRow);
  const slugField = dataset.fields[0];
  const fileErrors: string[] = [];
  if (!columns.has(slugField.key) && !columns.has("name")) fileErrors.push(`Thiếu cột "${slugField.header}" để biết dòng nào là bản ghi nào.`);
  if (columns.size <= 1) fileErrors.push("File không có cột dữ liệu nào khớp. Hãy dùng file xuất từ CMS làm mẫu.");
  const { items, context } = await dataset.load();
  const keyOf = dataset.matchKey ?? ((key: string) => key);
  const bySlug = new Map(items.map((item) => [keyOf(item.slug), item]));
  const seen = new Map<string, number>();
  const can = (permission: string) => hasCmsPermission(actor, permission as CmsPermissionCode);
  const rows: PlannedRow<TItem>[] = [];

  body.forEach((cells, index) => {
    if (cells.every((cell) => !cell?.trim())) return;
    const rowNumber = index + 2;
    const errors: string[] = [];
    const values: Record<string, unknown> = {};
    for (const spec of dataset.fields) {
      const column = columns.get(spec.key);
      if (column === undefined) continue;
      const parsed = spec.parse((cells[column] ?? "").trim());
      // undefined = ô trống ở cột "giữ nguyên khi trống" (số, Có/Không, trạng thái): không đổi giá trị đang có.
      if (parsed.ok) { if (parsed.value !== undefined) values[spec.key] = parsed.value; }
      else errors.push(`Cột "${spec.header}": ${parsed.error}`);
    }
    const nameField = dataset.fields.find((spec) => spec.key === "name");
    const name = typeof values.name === "string" ? values.name : "";
    let slug = typeof values[slugField.key] === "string" ? values[slugField.key] as string : "";
    if (!slug && name) slug = toSlug(name);
    const existing = slug ? bySlug.get(keyOf(slug)) : undefined;
    const label = name || (existing && nameField ? display(nameField.format(nameField.get(existing))) : "") || slug || `Dòng ${rowNumber}`;
    if (!slug) errors.push(`Thiếu "${slugField.header}" (hoặc tên để tự tạo).`);
    else if (seen.has(keyOf(slug))) errors.push(`Trùng "${slugField.header}" với dòng ${seen.get(keyOf(slug))}; mỗi bản ghi chỉ một dòng.`);
    else seen.set(keyOf(slug), rowNumber);
    values[slugField.key] = slug;

    if (!existing) {
      for (const spec of dataset.fields) {
        if (spec.requiredOnCreate && (values[spec.key] === undefined || values[spec.key] === null || values[spec.key] === "")) errors.push(`Bản ghi mới cần cột "${spec.header}".`);
      }
    }
    const changes: ImportChange[] = [];
    for (const spec of dataset.fields) {
      if (!(spec.key in values) || (spec === slugField && existing)) continue;
      const after = display(spec.format(values[spec.key]));
      const before = existing ? display(spec.format(spec.get(existing))) : "";
      if (before !== after) changes.push({ field: spec.key, header: spec.header, before, after });
    }

    let input: unknown;
    if (!errors.length && (!existing || changes.length)) {
      const built = dataset.build(values, existing, context);
      errors.push(...built.errors);
      if (!built.errors.length) {
        const parsed = dataset.schema.safeParse(built.input);
        if (parsed.success) input = parsed.data;
        else errors.push(...zodMessages(parsed.error, dataset.fields));
      }
      const needed = existing ? "update" : "create";
      if (!can(`${dataset.module}.${needed}`)) errors.push(existing ? "Bạn không có quyền sửa mục này." : "Bạn không có quyền tạo mục mới.");
      else if ((built.live.before || built.live.after) && !can(`${dataset.module}.publish`)) errors.push("Mục đang/sẽ hiện trên website: cần quyền xuất bản.");
    }
    const action = errors.length ? "error" : !existing ? "create" : changes.length ? "update" : "unchanged";
    rows.push({ row: rowNumber, slug, label, action, version: existing?.version ?? null, changes, errors, input: action === "create" || action === "update" ? input : undefined, existing });
  });

  if (!rows.length && !fileErrors.length) fileErrors.push("File không có dòng dữ liệu nào.");
  const counts = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const row of rows) counts[row.action]++;
  const plan: ImportPlan = {
    dataset: dataset.id, total: rows.length, counts, fileErrors, ignoredHeaders: ignored,
    rows: rows.map(({ row, slug, label, action, version, changes, errors }) => ({ row, slug, label, action, version, changes, errors })),
  };
  return { plan, rows };
}

export class ImportBlockedError extends Error {
  constructor(message: string, readonly status: 400 | 409) {
    super(message);
    this.name = "ImportBlockedError";
  }
}

export type ImportResult = { created: number; updated: number; unchanged: number; failed: { row: number; slug: string; message: string } | null };

/**
 * Áp dụng đúng kế hoạch đã xem trước: lập lại kế hoạch trên dữ liệu hiện tại, từ chối nếu còn lỗi hoặc
 * phiên bản khác lúc xem (có người vừa sửa), rồi ghi từng dòng qua service (mỗi dòng có phiên bản + nhật ký riêng).
 * Dừng ở dòng lỗi đầu tiên; các dòng trước đó đã ghi và khôi phục được bằng lịch sử phiên bản.
 */
export async function applyImport<TItem extends TransferItem, TContext>(dataset: TransferDataset<TItem, TContext>, table: string[][], expected: Record<string, number | null>, actor: CmsActor & { userId: string }): Promise<ImportResult> {
  const { plan, rows } = await planImport(dataset, table, actor);
  if (plan.fileErrors.length || plan.counts.error) throw new ImportBlockedError("File còn lỗi; hãy sửa và xem trước lại.", 400);
  const changed = rows.filter((row) => row.action === "create" || row.action === "update");
  for (const row of changed) {
    if (!(row.slug in expected) || expected[row.slug] !== row.version) throw new ImportBlockedError(`"${row.label}" vừa được thay đổi (thêm/sửa) sau khi bạn xem trước. Hãy xem trước lại.`, 409);
  }
  const result: ImportResult = { created: 0, updated: 0, unchanged: plan.counts.unchanged, failed: null };
  for (const row of changed) {
    try {
      await dataset.write(row.input, row.existing, actor.userId);
      if (row.action === "create") result.created++; else result.updated++;
    } catch (error) {
      result.failed = { row: row.row, slug: row.slug, message: error instanceof Error && error.message.length < 300 ? error.message : "Không ghi được dòng này." };
      break;
    }
  }
  return result;
}

export function exportRows<TItem extends TransferItem>(fields: TransferField<TItem, unknown>[], items: TItem[]) {
  return { headers: fields.map((spec) => spec.header), widths: fields.map((spec) => spec.width), rows: items.map((item) => fields.map((spec) => spec.format(spec.get(item)))) };
}

// ---------- Bộ đọc ô dùng chung ----------

export const text = (max: number, options: { required?: boolean } = {}) => (raw: string): Parsed<string | null> => {
  if (!raw) return options.required ? { ok: false, error: "không được để trống." } : { ok: true, value: null };
  return raw.length > max ? { ok: false, error: `dài ${raw.length} ký tự, tối đa ${max}.` } : { ok: true, value: raw };
};

/** Danh sách trong một ô: mỗi dòng một mục (Alt+Enter trong Excel); dòng trống bị bỏ. Ô trống = danh sách rỗng. */
export const lines = (options: { maxItems: number; maxLength: number }) => (raw: string): Parsed<string[]> => {
  const items = raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (items.length > options.maxItems) return { ok: false, error: `có ${items.length} mục, tối đa ${options.maxItems}.` };
  const tooLong = items.find((item) => item.length > options.maxLength);
  return tooLong ? { ok: false, error: `mục "${tooLong.slice(0, 40)}…" dài quá ${options.maxLength} ký tự.` } : { ok: true, value: items };
};

export const slugCell = (raw: string): Parsed<string> => {
  if (!raw) return { ok: true, value: "" };
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw) && raw.length <= 180 ? { ok: true, value: raw } : { ok: false, error: `"${raw}" chỉ được gồm chữ thường không dấu, số và gạch nối (ví dụ may-in-80mm).` };
};

/** Số nguyên: nhận "8900000", "8.900.000", "8,900,000", "8 900 000 ₫", "8.9E6". */
export const integer = (options: { min: number; max: number; unit?: string }) => (raw: string): Parsed<number> => {
  if (!raw) return { ok: true, value: undefined };
  const cleaned = raw.replace(/[\s ₫]|vn[dđ]|đ$/gi, "");
  const value = /^\d{1,3}([.,]\d{3})+$/.test(cleaned) ? Number(cleaned.replace(/[.,]/g, "")) : Number(cleaned);
  if (!cleaned || !Number.isFinite(value) || !Number.isInteger(value)) return { ok: false, error: `"${raw}" không phải số nguyên${options.unit ? ` (${options.unit})` : ""}.` };
  if (value < options.min || value > options.max) return { ok: false, error: `phải từ ${options.min} đến ${options.max}.` };
  return { ok: true, value };
};

export const yesNo = (raw: string): Parsed<boolean> => {
  const value = raw.normalize("NFC").toLocaleLowerCase("vi");
  if (!value) return { ok: true, value: undefined };
  if (["có", "co", "x", "1", "true", "yes", "bật", "hiện"].includes(value)) return { ok: true, value: true };
  if (["không", "khong", "0", "false", "no", "tắt", "ẩn"].includes(value)) return { ok: true, value: false };
  return { ok: false, error: `"${raw}" — ghi "Có" hoặc "Không".` };
};

export const contentStatuses = { draft: "Bản nháp", review: "Chờ duyệt", scheduled: "Hẹn giờ", published: "Đã xuất bản", archived: "Lưu trữ" } as const;
export type ContentStatus = keyof typeof contentStatuses;

export const statusCell = (raw: string): Parsed<ContentStatus> => {
  const value = raw.normalize("NFC").trim().toLocaleLowerCase("vi");
  if (!value) return { ok: true, value: undefined };
  const match = (Object.entries(contentStatuses) as [ContentStatus, string][]).find(([code, label]) => value === code || value === label.toLocaleLowerCase("vi"))
    ?? (value === "đang hiển thị" || value === "xuất bản" ? ["published", ""] as [ContentStatus, string] : undefined);
  return match ? { ok: true, value: match[0] } : { ok: false, error: `"${raw}" — dùng một trong: ${Object.values(contentStatuses).join(", ")}.` };
};
