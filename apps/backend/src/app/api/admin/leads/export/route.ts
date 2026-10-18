import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { exportLeads } from "@iorder/core/server/leads/leads.service";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Tải CSV/Excel khách hàng tiềm năng theo bộ lọc trạng thái/từ khóa/khoảng ngày (quyền leads.view, kiểm tra ở proxy).
async function handleGET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const params = new URL(request.url).searchParams;
  try {
    const file = await exportLeads({ format: params.get("format") || undefined, status: params.get("status") ?? "all", query: params.get("query") || undefined, from: params.get("from") || undefined, to: params.get("to") || undefined, sort: params.get("sort") || undefined, dir: params.get("dir") || undefined }, administrator.userId);
    const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    return new NextResponse(typeof file.body === "string" ? file.body : new Uint8Array(file.body), { headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="khach-hang-tiem-nang-${day}.${file.extension}"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    if (error instanceof z.ZodError) return fail("INVALID_INPUT", "Bộ lọc xuất dữ liệu không hợp lệ.", 400);
    logger.error("Xuất dữ liệu khách hàng tiềm năng thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không thể xuất danh sách lúc này. Vui lòng thử lại.", 500);
  }
}

export const GET = withRequestContext(handleGET);
