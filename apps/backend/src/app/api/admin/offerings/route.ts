import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { publicOfferingTypeSchema } from "@iorder/core/server/offerings/offering-content.contract";
import { createAdminOffering, getAdminOfferings } from "@iorder/core/server/offerings/offerings.service";

export const runtime = "nodejs";

function phanHoiLoi(ma: string, thongBao: string, trangThai: number) {
  return NextResponse.json({ error: { code: ma, message: thongBao } }, { status: trangThai });
}

const danhMucTheoLoai = { software: "phan-mem", solution: "giai-phap", service: "dich-vu", industry: "nganh-nghe" } as const;

function lamMoiNoiDungCatalog(type: keyof typeof danhMucTheoLoai, slug: string) {
  const danhMuc = danhMucTheoLoai[type];
  revalidatePath(`/${danhMuc}`);
  revalidatePath(`/${danhMuc}/${slug}`);
  revalidatePath(`/${danhMuc}/[slug]`, "page");
  revalidatePath("/sitemap.xml");
}

function kiemTraLoaiDaKhoa(request: Request, body: unknown) {
  const typeDaKhoa = new URL(request.url).searchParams.get("type");
  if (!typeDaKhoa) return undefined;
  const expectedType = publicOfferingTypeSchema.safeParse(typeDaKhoa);
  const receivedType = typeof body === "object" && body !== null && "type" in body ? body.type : undefined;
  if (!expectedType.success || receivedType !== expectedType.data) return "Loại nội dung không khớp với màn quản trị đang sử dụng.";
  return undefined;
}

export async function GET() {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  return NextResponse.json({ offerings: await getAdminOfferings() });
}

export async function POST(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return phanHoiLoi("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
  }

  try {
    const loiLoai = kiemTraLoaiDaKhoa(request, body);
    if (loiLoai) return phanHoiLoi("CONTENT_TYPE_MISMATCH", loiLoai, 400);
    const offering = await createAdminOffering(body, administrator.userId);
    lamMoiNoiDungCatalog(offering.type, offering.slug);
    return NextResponse.json({ offering }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return phanHoiLoi("INVALID_INPUT", "Vui lòng kiểm tra lại các trường bắt buộc của Offering.", 400);
    }

    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return phanHoiLoi("DUPLICATE_SLUG", "Slug đã tồn tại trong nhóm nội dung này.", 409);
    }

    console.error("Tạo Offering trong CMS thất bại.", error);
    return phanHoiLoi("INTERNAL_ERROR", "Không thể tạo Offering lúc này. Vui lòng thử lại.", 500);
  }
}
