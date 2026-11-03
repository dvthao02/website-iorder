import { NextResponse } from "next/server";
import { z } from "zod";

import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { denyUnless } from "@/lib/admin-access";
import { withRequestContext } from "@/lib/request-context";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import type { CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { importExpectedSchema, transferDatasetModules, transferDatasetSchema, transferFormatSchema, type TransferDatasetId } from "@iorder/core/server/data-transfer/data-transfer.contract";
import { applyImportFile, exportDataset, previewImport } from "@iorder/core/server/data-transfer/data-transfer.service";
import { TabularFileError } from "@iorder/core/server/data-transfer/tabular";
import { exportPostsWord } from "@iorder/core/server/data-transfer/word.service";
import { ImportBlockedError } from "@iorder/core/server/data-transfer/transfer";
import { logger } from "@iorder/core/server/shared/logger";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ dataset: string }> };

// Đường dẫn website cần làm mới sau khi nhập.
const publicPaths: Record<TransferDatasetId, string[]> = {
  equipment: ["/thiet-bi"], "equipment-groups": ["/thiet-bi"],
  "offerings-software": ["/phan-mem"], "offerings-solution": ["/giai-phap"], "offerings-service": ["/dich-vu"],
  posts: ["/tin-tuc"], guides: ["/ho-tro/huong-dan"], categories: ["/tin-tuc"], tags: ["/tin-tuc"],
  // Đối tác/đánh giá hiện ở nhiều trang; chuyển hướng được website lưu cache theo từng đường dẫn: làm mới toàn bộ.
  partners: ["/"], testimonials: ["/"], redirects: ["/"],
};

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Xuất cả bảng ra .xlsx hoặc .csv (file này cũng là mẫu để sửa rồi nhập lại).
async function handleGET(request: Request, { params }: RouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const dataset = transferDatasetSchema.safeParse((await params).dataset);
  const format = transferFormatSchema.safeParse(new URL(request.url).searchParams.get("format") ?? "xlsx");
  if (!dataset.success) return fail("NOT_FOUND", "Không có bảng dữ liệu này.", 404);
  if (!format.success) return fail("INVALID_INPUT", "Định dạng xuất chỉ nhận xlsx, csv hoặc word.", 400);
  const denied = denyUnless(administrator, `${transferDatasetModules[dataset.data]}.view` as CmsPermissionCode);
  if (denied) return denied;
  try {
    if (format.data === "word") {
      // Bài viết/Hướng dẫn: gói .zip mỗi bài một file .docx.
      const kind = dataset.data === "posts" || dataset.data === "guides" ? dataset.data : null;
      if (!kind) return fail("INVALID_INPUT", "Chỉ bài viết và hướng dẫn xuất được file Word.", 400);
      const file = await exportPostsWord(kind);
      return new NextResponse(new Uint8Array(file.body), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${file.fileName}"`, "cache-control": "no-store" } });
    }
    const file = await exportDataset(dataset.data, format.data);
    return new NextResponse(typeof file.body === "string" ? file.body : new Uint8Array(file.body), { headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${file.fileName}"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    logger.error("Xuất dữ liệu ra file thất bại.", { request, error, dataset: dataset.data });
    return fail("INTERNAL_ERROR", "Không thể xuất dữ liệu lúc này. Vui lòng thử lại.", 500);
  }
}

// multipart: file (.xlsx/.csv), mode = preview | apply, expected (JSON slug → phiên bản lúc xem trước, chỉ khi apply).
async function handlePOST(request: Request, { params }: RouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const dataset = transferDatasetSchema.safeParse((await params).dataset);
  if (!dataset.success) return fail("NOT_FOUND", "Không có bảng dữ liệu này.", 404);
  const owner = transferDatasetModules[dataset.data];
  // Từng dòng còn được kiểm quyền tạo/sửa/xuất bản riêng trong kế hoạch nhập.
  const denied = denyUnless(administrator, [`${owner}.create`, `${owner}.update`] as CmsPermissionCode[]);
  if (denied) return denied;

  let form: FormData;
  try { form = await request.formData(); } catch { return fail("INVALID_INPUT", "Vui lòng chọn file .xlsx hoặc .csv để nhập.", 400); }
  const upload = form.get("file");
  const mode = form.get("mode") === "apply" ? "apply" : "preview";
  if (!(upload instanceof File)) return fail("INVALID_INPUT", "Vui lòng chọn file .xlsx hoặc .csv để nhập.", 400);
  const file = { name: upload.name, bytes: Buffer.from(await upload.arrayBuffer()) };

  try {
    if (mode === "preview") return NextResponse.json({ plan: await previewImport(dataset.data, file, administrator) });
    const expected = importExpectedSchema.parse(JSON.parse(String(form.get("expected") ?? "{}")));
    const result = await applyImportFile(dataset.data, file, expected, administrator);
    if (result.created || result.updated) for (const path of publicPaths[dataset.data]) revalidatePath(path, "layout");
    return NextResponse.json({ result }, { status: result.failed ? 207 : 200 });
  } catch (error) {
    if (error instanceof TabularFileError) return fail("INVALID_FILE", error.message, 400);
    if (error instanceof ImportBlockedError) return fail(error.status === 409 ? "VERSION_CONFLICT" : "IMPORT_BLOCKED", error.message, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Dữ liệu xem trước không hợp lệ; hãy xem trước lại.", 400);
    logger.error("Nhập dữ liệu từ file thất bại.", { request, error, dataset: dataset.data, mode });
    return fail("INTERNAL_ERROR", "Không thể nhập dữ liệu lúc này. Vui lòng thử lại.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
