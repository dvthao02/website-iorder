import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { getConsultFormWithVersion, updateConsultForm } from "@iorder/shared/server/settings/consult-popup.service";
import { ContentVersionConflictError, versionedWriteRequestSchema } from "@iorder/shared/server/shared/content-version";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { withRequestContext } from "@/lib/request-context";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

async function handleGET() {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  return NextResponse.json(await getConsultFormWithVersion());
}

async function handlePUT(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    const { values, expectedVersion } = versionedWriteRequestSchema.parse(await request.json());
    const result = await updateConsultForm(values, user.userId, expectedVersion);
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra nội dung biểu mẫu tư vấn trước khi lưu.", 400);
    return fail("INTERNAL_ERROR", "Không thể lưu biểu mẫu tư vấn lúc này.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const PUT = withRequestContext(handlePUT);
