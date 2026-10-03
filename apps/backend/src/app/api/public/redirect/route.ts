import { NextResponse } from "next/server";
import { getEnabledRedirect } from "@iorder/core/server/redirects/redirects.service";

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path");
  if (!path || !path.startsWith("/")) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Đường dẫn chuyển hướng không hợp lệ." } }, { status: 400 });
  return NextResponse.json({ redirect: await getEnabledRedirect(path) });
}
