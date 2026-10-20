import { cookies, draftMode } from "next/headers";
import { NextResponse } from "next/server";

import { previewCookieName } from "@/lib/backend";

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:3002").replace(/\/$/, "");

function invalid(message: string, status: number) {
  return new NextResponse(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Xem trước</title><p style="font:16px system-ui;padding:32px">${message}</p>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

// CMS mở liên kết này trong tab mới: Backend kiểm token, website bật Draft Mode và chuyển tới đúng trang.
// Đường dẫn đích lấy từ Backend (theo dữ liệu hiện tại), không lấy từ URL, để không thành công cụ chuyển hướng tùy ý.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return invalid("Thiếu mã xem trước. Hãy bấm lại nút “Xem trước” trong CMS.", 400);
  let preview: { path: string; exp: number } | undefined;
  try {
    const response = await fetch(`${backendUrl}/api/public/preview?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (response.ok) preview = (await response.json() as { preview: { path: string; exp: number } }).preview;
  } catch {
    return invalid("Không kết nối được máy chủ nội dung. Vui lòng thử lại.", 502);
  }
  if (!preview || !preview.path.startsWith("/") || preview.path.startsWith("//")) return invalid("Liên kết xem trước không hợp lệ hoặc đã hết hạn (1 giờ). Hãy bấm lại nút “Xem trước” trong CMS.", 404);

  (await draftMode()).enable();
  (await cookies()).set(previewCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(60, preview.exp - Math.floor(Date.now() / 1000)),
  });
  return NextResponse.redirect(new URL(preview.path, request.url), 307);
}
