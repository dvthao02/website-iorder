import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { leadStatusUpdateSchema } from "@iorder/core/server/leads/leads.contract";
import { changeLeadStatus } from "@iorder/core/server/leads/leads.service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const { id } = await context.params;
    const body = leadStatusUpdateSchema.parse(await request.json());
    const lead = await changeLeadStatus(z.string().uuid().parse(id), body.status, user.userId);
    if (!lead) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy liên hệ cần cập nhật." } }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Trạng thái liên hệ không hợp lệ." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể cập nhật liên hệ lúc này." } }, { status: 500 });
  }
}
