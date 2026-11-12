import { z } from "zod";

import { assertNoRedirectCycle } from "../redirects/redirect-cycle";
import { redirectInputSchema, type RedirectInput } from "../redirects/redirects.contract";
import { getRedirects, writeRedirect } from "../redirects/redirects.service";
import { hasDatabaseErrorCode } from "../shared/database-error";
import { field, text, yesNo, type Parsed, type TransferDataset } from "./transfer";

type RedirectRow = Awaited<ReturnType<typeof getRedirects>>[number] & { slug: string };

const statusCodeCell = (raw: string): Parsed<RedirectInput["statusCode"]> => {
  if (!raw) return { ok: true, value: undefined };
  const code = raw.match(/\b(301|308)\b/)?.[1];
  return code ? { ok: true, value: Number(code) as RedirectInput["statusCode"] } : { ok: false, error: `"${raw}" — ghi 301 hoặc 308.` };
};

/**
 * Chuyển hướng URL: khớp dòng theo "Đường dẫn cũ" (mỗi đường dẫn chỉ một chuyển hướng). Không có quyền xuất bản riêng,
 * nên chỉ cần quyền tạo/sửa. Vòng lặp chuyển hướng được báo ngay lúc xem trước (so với dữ liệu đang có).
 */
export function redirectTransfer(): TransferDataset<RedirectRow, { rows: RedirectRow[] }> {
  return {
    id: "redirects",
    label: "Chuyển hướng URL",
    fileName: "chuyen-huong",
    module: "redirects",
    fields: [
      field({ key: "sourcePath", header: "Đường dẫn cũ", width: 40, get: (item) => item.sourcePath, format: (value) => value, parse: text(500, { required: true }) }),
      field({ key: "destinationPath", header: "Chuyển tới", width: 40, requiredOnCreate: true, get: (item) => item.destinationPath, format: (value) => value, parse: text(1_000, { required: true }) }),
      field({ key: "statusCode", header: "Mã (301/308)", width: 12, get: (item) => item.statusCode, format: (value) => value, parse: statusCodeCell }),
      field({ key: "isEnabled", header: "Đang bật", width: 10, get: (item) => item.isEnabled, format: (value: boolean) => value ? "Có" : "Không", parse: yesNo }),
    ],
    async load() {
      const rows = (await getRedirects()).map((item) => ({ ...item, slug: item.sourcePath }));
      return { items: rows, context: { rows } };
    },
    build(changes, existing, context) {
      const errors: string[] = [];
      const input: RedirectInput = existing
        ? { sourcePath: existing.sourcePath, destinationPath: existing.destinationPath, statusCode: existing.statusCode, isEnabled: existing.isEnabled }
        : { sourcePath: String(changes.sourcePath ?? ""), destinationPath: "", statusCode: 301, isEnabled: true };
      if (typeof changes.destinationPath === "string") input.destinationPath = changes.destinationPath;
      if (typeof changes.statusCode === "number") input.statusCode = changes.statusCode as RedirectInput["statusCode"];
      if (typeof changes.isEnabled === "boolean") input.isEnabled = changes.isEnabled;
      if (redirectInputSchema.safeParse(input).success) {
        try { assertNoRedirectCycle(context.rows, existing?.id ?? null, input); } catch (error) {
          if (error instanceof z.ZodError) errors.push(...error.issues.map((issue) => issue.message)); else throw error;
        }
      }
      return { input, errors, live: { before: false, after: false } };
    },
    schema: redirectInputSchema,
    async write(input, existing, actorId) {
      try {
        const id = await writeRedirect(existing?.id ?? null, input, actorId, existing?.version);
        if (!id) throw new Error("Không tìm thấy chuyển hướng (có thể vừa bị xóa).");
        return id;
      } catch (error) {
        if (hasDatabaseErrorCode(error, "23505")) throw new Error("Đường dẫn cũ này đã có chuyển hướng khác.");
        if (error instanceof z.ZodError) throw new Error(error.issues[0]?.message ?? "Chuyển hướng không hợp lệ.");
        throw error;
      }
    },
  };
}
