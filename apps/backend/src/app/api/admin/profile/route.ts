import { NextResponse } from "next/server";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getSiteProfileWithVersion, updateSiteProfile } from "@iorder/core/server/settings/profile.service";
import { ContentVersionConflictError, versionedWriteRequestSchema } from "@iorder/core/server/shared/content-version";
import { withRequestContext } from "@/lib/request-context";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

async function handleGET() {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  return NextResponse.json(await getSiteProfileWithVersion());
}
async function handlePUT(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  let input: unknown;
  try { input = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400); }
  try {
    const { values, expectedVersion } = versionedWriteRequestSchema.parse(input);
    const result = await updateSiteProfile(values, user.userId, expectedVersion);
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    return error instanceof z.ZodError ? fail("INVALID_INPUT", "Kiểm tra tên doanh nghiệp, email và ảnh logo trước khi lưu.", 400)
      : fail("INTERNAL_ERROR", "Không thể lưu thông tin doanh nghiệp.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const PUT = withRequestContext(handlePUT);
