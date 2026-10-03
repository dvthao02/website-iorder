import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { publicOfferingTypeSchema } from "@iorder/core/server/offerings/offering-content.contract";
import { deleteArchivedAdminOffering, getAdminOfferingById, updateAdminOffering } from "@iorder/core/server/offerings/offerings.service";

export const runtime = "nodejs";

type OfferingRouteProps = { params: Promise<{ id: string }> };

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

function layLoaiDaKhoa(request: Request) {
  const typeDaKhoa = new URL(request.url).searchParams.get("type");
  if (!typeDaKhoa) return undefined;
  const parsed = publicOfferingTypeSchema.safeParse(typeDaKhoa);
  return parsed.success ? parsed.data : null;
}

export async function PATCH(request: Request, { params }: OfferingRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return phanHoiLoi("INVALID_INPUT", "Offering cần cập nhật không hợp lệ.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return phanHoiLoi("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
  }

  try {
    const loaiDaKhoa = layLoaiDaKhoa(request);
    if (loaiDaKhoa === null) return phanHoiLoi("INVALID_INPUT", "Loại nội dung quản trị không hợp lệ.", 400);
    if (loaiDaKhoa) {
      const offeringHienTai = await getAdminOfferingById(id);
      const loaiGuiLen = typeof body === "object" && body !== null && "type" in body ? body.type : undefined;
      if (!offeringHienTai) return phanHoiLoi("NOT_FOUND", "Không tìm thấy nội dung cần cập nhật.", 404);
      if (offeringHienTai.type !== loaiDaKhoa || loaiGuiLen !== loaiDaKhoa) return phanHoiLoi("CONTENT_TYPE_MISMATCH", "Loại nội dung không khớp với màn quản trị đang sử dụng.", 400);
    }
    const offering = await updateAdminOffering(id, body, administrator.userId);
    if (!offering) {
      return phanHoiLoi("NOT_FOUND", "Không tìm thấy Offering cần cập nhật.", 404);
    }

    lamMoiNoiDungCatalog(offering.type, offering.slug);
    return NextResponse.json({ offering });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return phanHoiLoi("INVALID_INPUT", "Vui lòng kiểm tra lại các trường bắt buộc của Offering.", 400);
    }

    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return phanHoiLoi("DUPLICATE_SLUG", "Slug đã tồn tại trong nhóm nội dung này.", 409);
    }

    console.error("Cập nhật Offering trong CMS thất bại.", error);
    return phanHoiLoi("INTERNAL_ERROR", "Không thể cập nhật Offering lúc này. Vui lòng thử lại.", 500);
  }
}

export async function DELETE(_: Request, { params }: OfferingRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return phanHoiLoi("INVALID_INPUT", "Offering cần xóa không hợp lệ.", 400);
  }

  const deleted = await deleteArchivedAdminOffering(id, administrator.userId);
  if (!deleted) {
    return phanHoiLoi("NOT_FOUND", "Chỉ có thể xóa nội dung đang lưu trữ.", 404);
  }

  lamMoiNoiDungCatalog(deleted.type, deleted.slug);
  return NextResponse.json({ deletedId: deleted.id });
}
