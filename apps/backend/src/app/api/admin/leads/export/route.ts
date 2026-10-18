import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { exportLeadsCsv } from "@iorder/core/server/leads/leads.service";

export const runtime = "nodejs";

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Tải CSV khách hàng tiềm năng theo bộ lọc trạng thái/từ khóa (quyền leads.view, kiểm tra ở proxy).
export async function GET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const params = new URL(request.url).searchParams;
  try {
    const { csv } = await exportLeadsCsv({ status: params.get("status") ?? "all", query: params.get("query") || undefined }, administrator.userId);
    const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    return new NextResponse(csv, { headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="khach-hang-tiem-nang-${day}.csv"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    if (error instanceof z.ZodError) return fail("INVALID_INPUT", "Bộ lọc xuất dữ liệu không hợp lệ.", 400);
    console.error("Xuất CSV khách hàng tiềm năng thất bại.");
    return fail("INTERNAL_ERROR", "Không thể xuất danh sách lúc này. Vui lòng thử lại.", 500);
  }
}
