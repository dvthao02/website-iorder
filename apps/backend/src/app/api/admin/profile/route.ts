import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getSiteProfile, updateSiteProfile } from "@iorder/core/server/settings/profile.service";

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  return NextResponse.json({ profile: await getSiteProfile() });
}

export async function PUT(request: Request) {
  const user = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  let input: unknown;
  try { input = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400); }
  try {
    const profile = await updateSiteProfile(input, user.userId);
    revalidatePath("/", "layout");
    return NextResponse.json({ profile });
  } catch (error) {
    return error instanceof z.ZodError ? fail("INVALID_INPUT", "Kiểm tra tên doanh nghiệp, email và ảnh logo trước khi lưu.", 400)
      : fail("INTERNAL_ERROR", "Không thể lưu thông tin doanh nghiệp.", 500);
  }
}
