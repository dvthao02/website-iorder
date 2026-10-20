import { cookies, draftMode } from "next/headers";
import { NextResponse } from "next/server";

import { previewCookieName } from "@/lib/backend";

// Thoát xem trước: tắt Draft Mode, xóa token, quay lại trang đang xem (chỉ đường dẫn nội bộ).
export async function POST(request: Request) {
  (await draftMode()).disable();
  (await cookies()).delete(previewCookieName);
  const target = (await request.formData().catch(() => null))?.get("path");
  const path = typeof target === "string" && target.startsWith("/") && !target.startsWith("//") ? target : "/";
  return NextResponse.redirect(new URL(path, request.url), 303);
}
