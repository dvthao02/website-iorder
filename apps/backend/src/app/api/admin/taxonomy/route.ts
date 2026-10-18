import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { ContentVersionConflictError } from "@iorder/core/server/shared/content-version";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { taxonomyRequestSchema } from "@iorder/core/server/taxonomy/taxonomy.contract";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { deleteAdminTaxonomy, getTaxonomy, TaxonomyInUseError, writeTaxonomy } from "@iorder/core/server/taxonomy/taxonomy.service";
import { denyUnless } from "@/lib/admin-access";

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  return NextResponse.json({ taxonomy: await getTaxonomy() });
}

export async function POST(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const body = taxonomyRequestSchema.parse(await request.json());
    const denied = denyUnless(user, body.id ? "taxonomy.update" : "taxonomy.create");
    if (denied) return denied;
    const id = await writeTaxonomy(body.kind, body.id, body.values, user.userId, body.expectedVersion);
    if (!id) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy chuyên mục hoặc thẻ cần cập nhật." } }, { status: 404 });
    revalidatePath("/tin-tuc");
    revalidatePath("/tin-tuc/chuyen-muc/[slug]", "page");
    revalidatePath("/tin-tuc/the/[slug]", "page");
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof ContentVersionConflictError) return NextResponse.json({ error: { code: "VERSION_CONFLICT", message: error.message } }, { status: 409 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Kiểm tra tên, slug, chuyên mục cha và thứ tự hiển thị trước khi lưu." } }, { status: 400 });
    if (hasDatabaseErrorCode(error, "23505")) return NextResponse.json({ error: { code: "DUPLICATE_SLUG", message: "Slug đã được sử dụng." } }, { status: 409 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu phân loại bài viết lúc này." } }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const parsed = z.object({ kind: z.enum(["categories", "tags"]), id: z.string().uuid() }).safeParse({ kind: query.get("kind"), id: query.get("id") });
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Loại hoặc mã phân loại không hợp lệ." } }, { status: 400 });
  try {
    const deletedId = await deleteAdminTaxonomy(parsed.data.kind, parsed.data.id, user.userId);
    if (!deletedId) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy phân loại cần xóa." } }, { status: 404 });
    revalidatePath("/tin-tuc"); revalidatePath("/tin-tuc/chuyen-muc/[slug]", "page"); revalidatePath("/tin-tuc/the/[slug]", "page"); revalidatePath("/sitemap.xml");
    return NextResponse.json({ deletedId });
  } catch (error) {
    if (error instanceof TaxonomyInUseError) return NextResponse.json({ error: { code: "TAXONOMY_IN_USE", message: error.message } }, { status: 409 });
    console.error("Xóa phân loại bài viết trong CMS thất bại.");
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể xóa phân loại lúc này." } }, { status: 500 });
  }
}
