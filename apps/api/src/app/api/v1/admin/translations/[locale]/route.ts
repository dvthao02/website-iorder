import { NextResponse } from "next/server";
import { z } from "zod";

import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { withRequestContext } from "@/lib/request-context";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { TabularFileError } from "@iorder/shared/server/data-transfer/tabular";
import { logger } from "@iorder/shared/server/shared/logger";
import { isTranslationLocale } from "@iorder/shared/server/translations/locales";
import { translationExportScopeSchema } from "@iorder/shared/server/translations/translations.contract";
import { parseGroupSelection } from "@iorder/shared/server/translations/translations.groups";
import { applyTranslationImport, exportTranslationFile, previewTranslationImport, translationImportLimits } from "@iorder/shared/server/translations/translations.service";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ locale: string }> };

const formatSchema = z.enum(["xlsx", "csv"]);

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Xuất file mẫu để dịch (cũng là file nhập lại): ?format=xlsx|csv, ?scope=all|missing (mặc định all; missing chỉ các câu chưa dịch), ?groups=ui,pages (chỉ các vùng này; mặc định mọi vùng), ?suggest=1 (điền sẵn gợi ý cho câu chưa dịch). Quyền: settings.view (proxy kiểm).
async function handleGET(request: Request, { params }: RouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const { locale } = await params;
  if (!isTranslationLocale(locale)) return fail("NOT_FOUND", "Không có ngôn ngữ này.", 404);
  const query = new URL(request.url).searchParams;
  const format = formatSchema.safeParse(query.get("format") ?? "xlsx");
  if (!format.success) return fail("INVALID_INPUT", "Định dạng xuất chỉ nhận xlsx hoặc csv.", 400);
  const scope = translationExportScopeSchema.safeParse(query.get("scope") ?? "all");
  if (!scope.success) return fail("INVALID_INPUT", "Phạm vi xuất chỉ nhận all (tất cả) hoặc missing (chỉ câu chưa dịch).", 400);
  const groups = parseGroupSelection(query.get("groups"));
  if (!groups) return fail("INVALID_INPUT", "Vùng cần xuất không hợp lệ.", 400);
  try {
    const file = await exportTranslationFile(locale, format.data, { scope: scope.data, groups, suggest: query.get("suggest") === "1" });
    return new NextResponse(typeof file.body === "string" ? file.body : new Uint8Array(file.body), { headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${file.fileName}"`,
      // Số dòng trong file và số ô dịch điền sẵn bằng gợi ý, để CMS báo cho người dùng sau khi tải.
      "x-translation-rows": String(file.rows),
      "x-translation-suggested": String(file.suggested),
      "cache-control": "no-store",
    } });
  } catch (error) {
    if (error instanceof TabularFileError) return fail("INVALID_FILE", error.message, 400);
    logger.error("Xuất file bản dịch thất bại.", { request, error, locale });
    return fail("INTERNAL_ERROR", "Không thể xuất file bản dịch lúc này. Vui lòng thử lại.", 500);
  }
}

// multipart: file (.xlsx/.csv), mode = preview | apply, overwrite = "true" để cập nhật cả bản dịch đã có (mặc định chỉ thêm câu còn thiếu).
// Quyền: settings.update (proxy kiểm; nhập bản dịch là sửa nội dung công khai).
async function handlePOST(request: Request, { params }: RouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const { locale } = await params;
  if (!isTranslationLocale(locale)) return fail("NOT_FOUND", "Không có ngôn ngữ này.", 404);

  let form: FormData;
  try { form = await request.formData(); } catch { return fail("INVALID_INPUT", "Vui lòng chọn file .xlsx hoặc .csv để nhập.", 400); }
  const upload = form.get("file");
  if (!(upload instanceof File)) return fail("INVALID_INPUT", "Vui lòng chọn file .xlsx hoặc .csv để nhập.", 400);
  if (upload.size > translationImportLimits.maxBytes) return fail("INVALID_FILE", `File lớn hơn ${translationImportLimits.maxBytes / 1024 / 1024} MB; hãy chia nhỏ file.`, 400);
  const overwrite = form.get("overwrite") === "true";
  const mode = form.get("mode") === "apply" ? "apply" : "preview";
  const file = { name: upload.name, bytes: Buffer.from(await upload.arrayBuffer()) };

  try {
    if (mode === "preview") return NextResponse.json({ plan: await previewTranslationImport(locale, file, overwrite) });
    const result = await applyTranslationImport(locale, file, overwrite, administrator.userId);
    // Bản dịch đổi thì mọi trang công khai có chữ đổi theo: làm mới cache của website.
    if (result.created || result.updated) revalidatePath("/", "layout");
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof TabularFileError) return fail("INVALID_FILE", error.message, 400);
    logger.error("Nhập file bản dịch thất bại.", { request, error, locale, mode });
    return fail("INTERNAL_ERROR", "Không thể nhập file bản dịch lúc này. Vui lòng thử lại.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
