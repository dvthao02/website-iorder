import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { leadUpdateResponseSchema, leadUpdateSchema } from "@iorder/shared/server/leads/leads.contract";
import { LeadAssigneeError } from "@iorder/shared/server/leads/leads.repository";
import { changeLead, getLead, removeLead } from "@iorder/shared/server/leads/leads.service";
import { withRequestContext } from "@/lib/request-context";

type RouteContext = { params: Promise<{ id: string }> };

const unauthorized = () => NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
const notFound = (message: string) => NextResponse.json({ error: { code: "NOT_FOUND", message } }, { status: 404 });

// Một liên hệ cho khung chi tiết: mở từ thông báo, kể cả khi liên hệ không nằm ở trang danh sách đang xem.
async function handleGET(_request: Request, context: RouteContext) {
  const user = await getRequestAdministrator();
  if (!user) return unauthorized();
  const id = z.string().uuid().safeParse((await context.params).id);
  if (!id.success) return notFound("Không tìm thấy liên hệ.");
  try {
    const lead = await getLead(id.data);
    return lead ? NextResponse.json({ lead }) : notFound("Không tìm thấy liên hệ.");
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải liên hệ lúc này." } }, { status: 500 });
  }
}

async function handlePATCH(request: Request, context: RouteContext) {
  const user = await getRequestAdministrator();
  if (!user) return unauthorized();
  try {
    const { id } = await context.params;
    const body = leadUpdateSchema.parse(await request.json());
    const lead = await changeLead(z.string().uuid().parse(id), body, user.userId);
    if (!lead) return notFound("Không tìm thấy liên hệ cần cập nhật.");
    const response = leadUpdateResponseSchema.safeParse({
      id: lead.id, status: lead.status, handledAt: lead.handledAt?.toISOString() ?? null, internalNote: lead.internalNote, assignedToId: lead.assignedTo, name: lead.name, phone: lead.phone, email: lead.email,
    });
    if (!response.success) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể xác nhận kết quả cập nhật liên hệ. Vui lòng tải lại danh sách." } }, { status: 500 });
    return NextResponse.json({ lead: response.data });
  } catch (error) {
    if (error instanceof LeadAssigneeError) return NextResponse.json({ error: { code: "INVALID_ASSIGNEE", message: error.message } }, { status: 422 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Dữ liệu cập nhật liên hệ không hợp lệ (ghi chú tối đa 2.000 ký tự)." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể cập nhật liên hệ lúc này." } }, { status: 500 });
  }
}

// Xóa mềm liên hệ rác (quyền leads.delete kiểm tra ở proxy): ẩn khỏi CMS, giữ dòng cho giới hạn chống spam.
async function handleDELETE(_request: Request, context: RouteContext) {
  const user = await getRequestAdministrator();
  if (!user) return unauthorized();
  try {
    const { id } = await context.params;
    const removed = await removeLead(z.string().uuid().parse(id), user.userId);
    return removed ? NextResponse.json({ deleted: { id: removed.id } }) : notFound("Không tìm thấy liên hệ cần xóa.");
  } catch (error) {
    if (error instanceof z.ZodError) return notFound("Không tìm thấy liên hệ cần xóa.");
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể xóa liên hệ lúc này." } }, { status: 500 });
  }
}

export const GET = withRequestContext(handleGET);
export const PATCH = withRequestContext(handlePATCH);
export const DELETE = withRequestContext(handleDELETE);
