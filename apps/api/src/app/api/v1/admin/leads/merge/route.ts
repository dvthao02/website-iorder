import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { leadMergeResponseSchema } from "@iorder/shared/server/leads/leads.contract";
import { LeadMergeError } from "@iorder/shared/server/leads/leads.repository";
import { mergeLeadGroup } from "@iorder/shared/server/leads/leads.service";
import { withRequestContext } from "@/lib/request-context";

// Gộp các liên hệ cùng số điện thoại thành một (quyền leads.delete, kiểm tra ở proxy): giữ liên hệ mới nhất, ghi nội dung liên hệ cũ vào ghi chú.
async function handlePOST(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const result = leadMergeResponseSchema.parse(await mergeLeadGroup(await request.json(), user.userId));
    return NextResponse.json({ merge: result });
  } catch (error) {
    if (error instanceof LeadMergeError) return NextResponse.json({ error: { code: error.reason === "not_found" ? "NOT_FOUND" : "LEAD_MERGE_DIFFERENT_PHONE", message: error.message } }, { status: error.reason === "not_found" ? 404 : 422 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Chọn từ 2 đến 20 liên hệ khác nhau để gộp." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể gộp liên hệ lúc này." } }, { status: 500 });
  }
}

export const POST = withRequestContext(handlePOST);
