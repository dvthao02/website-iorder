import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { NextResponse } from "next/server";
import { adminDetailResponse } from "../../../../../lib/admin-detail-response";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { contentDeleteRequestSchema, contentStateRequestSchema, contentUpdateRequestSchema, ContentVersionConflictError } from "@iorder/core/server/shared/content-version";
import { publicOfferingTypeSchema } from "@iorder/core/server/offerings/offering-content.contract";
import { changeAdminOfferingState, deleteArchivedAdminOffering, getAdminOfferingById, updateAdminOffering } from "@iorder/core/server/offerings/offerings.service";
import { denyPublishUnless, requestedStatusOf } from "@/lib/admin-access";

export const runtime = "nodejs";

type OfferingRouteProps = { params: Promise<{ id: string }> };

function phanHoiLoi(ma: string, thongBao: string, trangThai: number) {
  return NextResponse.json({ error: { code: ma, message: thongBao } }, { status: trangThai });
}

const danhMucTheoLoai = { software: "phan-mem", solution: "giai-phap", service: "dich-vu" } as const;

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

export async function GET(_: Request, { params }: OfferingRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return phanHoiLoi("INVALID_INPUT", "Nội dung cần xem không hợp lệ.", 400);
  return adminDetailResponse("offering", () => getAdminOfferingById(id), { missing: "Không tìm thấy nội dung.", failed: "Không thể tải nội dung lúc này. Vui lòng thử lại." });
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
    const stateRequest = body && typeof body === "object" && "action" in body ? contentStateRequestSchema.parse(body) : undefined;
    const loaiDaKhoa = layLoaiDaKhoa(request);
    if (loaiDaKhoa === null) return phanHoiLoi("INVALID_INPUT", "Loại nội dung quản trị không hợp lệ.", 400);
    if (loaiDaKhoa) {
      const offeringHienTai = await getAdminOfferingById(id);
      const loaiGuiLen = typeof body === "object" && body !== null && "type" in body ? body.type : undefined;
      if (!offeringHienTai) return phanHoiLoi("NOT_FOUND", "Không tìm thấy nội dung cần cập nhật.", 404);
      if (offeringHienTai.type !== loaiDaKhoa || (!stateRequest && loaiGuiLen !== loaiDaKhoa)) return phanHoiLoi("CONTENT_TYPE_MISMATCH", "Loại nội dung không khớp với màn quản trị đang sử dụng.", 400);
    }
    if (stateRequest) {
      const denied = denyPublishUnless(administrator, "offerings.publish", { stateAction: stateRequest.action });
      if (denied) return denied;
      const offering = await changeAdminOfferingState(id, stateRequest.action, administrator.userId, stateRequest.expectedVersion);
      if (!offering) return phanHoiLoi("NOT_FOUND", "Không tìm thấy nội dung cần cập nhật.", 404);
      lamMoiNoiDungCatalog(offering.type, offering.slug);
      return NextResponse.json({ offering });
    }
    const { expectedVersion, ...values } = contentUpdateRequestSchema.parse(body);
    const denied = denyPublishUnless(administrator, "offerings.publish", { requestedStatus: requestedStatusOf(values), currentStatus: (await getAdminOfferingById(id))?.status });
    if (denied) return denied;
    const offering = await updateAdminOffering(id, values, administrator.userId, undefined, expectedVersion);
    if (!offering) {
      return phanHoiLoi("NOT_FOUND", "Không tìm thấy Offering cần cập nhật.", 404);
    }

    lamMoiNoiDungCatalog(offering.type, offering.slug);
    return NextResponse.json({ offering });
  } catch (error: unknown) {
    if (error instanceof ContentVersionConflictError) return phanHoiLoi("VERSION_CONFLICT", error.message, 409);
    if (error instanceof z.ZodError) {
      return phanHoiLoi("INVALID_INPUT", "Vui lòng kiểm tra lại các trường bắt buộc của Offering.", 400);
    }

    if (hasDatabaseErrorCode(error, "23505")) {
      return phanHoiLoi("DUPLICATE_SLUG", "Slug đã tồn tại trong nhóm nội dung này.", 409);
    }

    console.error("Cập nhật Offering trong CMS thất bại.");
    return phanHoiLoi("INTERNAL_ERROR", "Không thể cập nhật Offering lúc này. Vui lòng thử lại.", 500);
  }
}

export async function DELETE(request: Request, { params }: OfferingRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return phanHoiLoi("INVALID_INPUT", "Offering cần xóa không hợp lệ.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return phanHoiLoi("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
  }
  try {
    const { expectedVersion } = contentDeleteRequestSchema.parse(body);
    const deleted = await deleteArchivedAdminOffering(id, administrator.userId, expectedVersion);
    if (!deleted) {
      return phanHoiLoi("NOT_FOUND", "Chỉ có thể xóa nội dung đang lưu trữ.", 404);
    }

    lamMoiNoiDungCatalog(deleted.type, deleted.slug);
    return NextResponse.json({ deletedId: deleted.id });
  } catch (error: unknown) {
    if (error instanceof ContentVersionConflictError) return phanHoiLoi("VERSION_CONFLICT", error.message, 409);
    if (error instanceof z.ZodError) return phanHoiLoi("INVALID_INPUT", "Phiên bản nội dung cần xóa không hợp lệ. Vui lòng tải lại danh sách.", 400);
    return phanHoiLoi("INTERNAL_ERROR", "Không thể xóa nội dung lúc này. Vui lòng thử lại.", 500);
  }
}
