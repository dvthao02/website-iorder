import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { cmsUserRequestSchema } from "@iorder/core/server/users/users.contract";
import { getCmsUsers, saveCmsUser } from "@iorder/core/server/users/users.service";

export async function GET() {
  const actor = await getRequestAdministrator();
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  if (actor.role !== "admin") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Chỉ quản trị viên mới được quản lý tài khoản." } }, { status: 403 });
  return NextResponse.json({ users: await getCmsUsers() });
}
export async function POST(request: Request) { const actor = await getRequestAdministrator(); if (!actor) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 }); if (actor.role !== "admin") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Chỉ quản trị viên mới được quản lý tài khoản." } }, { status: 403 }); try { const body = cmsUserRequestSchema.parse(await request.json()); const id = await saveCmsUser(body.id, body.values, actor.userId); if (!id) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy tài khoản cần cập nhật." } }, { status: 404 }); return NextResponse.json({ id }); } catch (error) { if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Kiểm tra tên đăng nhập, vai trò, trạng thái và mật khẩu trước khi lưu." } }, { status: 400 }); if (typeof error === "object" && error && "code" in error && error.code === "23505") return NextResponse.json({ error: { code: "DUPLICATE_USER", message: "Tên đăng nhập hoặc email đã được sử dụng." } }, { status: 409 }); return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu tài khoản lúc này." } }, { status: 500 }); } }
