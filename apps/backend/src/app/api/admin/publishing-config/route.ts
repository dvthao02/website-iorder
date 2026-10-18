import { NextResponse } from "next/server";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getPublishingConfigWithVersion, updatePublishingConfig } from "@iorder/core/server/settings/publishing.service";
import { ContentVersionConflictError, versionedWriteRequestSchema } from "@iorder/core/server/shared/content-version";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  return NextResponse.json(await getPublishingConfigWithVersion());
}
export async function PUT(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    const { values, expectedVersion } = versionedWriteRequestSchema.parse(await request.json());
    const result = await updatePublishingConfig(values, user.userId, expectedVersion);
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra URL website, tiêu đề, mô tả và ảnh chia sẻ trước khi lưu.", 400);
    return fail("INTERNAL_ERROR", "Không thể lưu cấu hình xuất bản lúc này.", 500);
  }
}
