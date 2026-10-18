import { NextResponse } from "next/server";
import { getEnabledRedirect } from "@iorder/core/server/redirects/redirects.service";

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path");
  if (!path || !path.startsWith("/")) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Đường dẫn chuyển hướng không hợp lệ." } }, { status: 400 });
  try {
    const redirect = await getEnabledRedirect(path);
    // Website chỉ cần đích và mã chuyển hướng; không trả id, version hay thời gian nội bộ.
    return NextResponse.json({ redirect: redirect ? { destinationPath: redirect.destinationPath, statusCode: redirect.statusCode } : null });
  } catch (error) {
    console.error("Tra cứu chuyển hướng public thất bại.", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tra cứu chuyển hướng lúc này." } }, { status: 500 });
  }
}
