import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { publicOfferingTypeSchema } from "@iorder/core/server/offerings/offering-content.contract";
import { createAdminOffering, getAdminOfferingsPage, getAdminOfferingSummariesPage } from "@iorder/core/server/offerings/offerings.service";
import { adminListQuerySchema } from "@iorder/core/server/shared/admin-list.contract";
import { denyPublishUnless, requestedStatusOf } from "@/lib/admin-access";
import { logger } from "@iorder/core/server/shared/logger";

export const runtime = "nodejs";

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

function kiemTraLoaiDaKhoa(request: Request, body: unknown) {
  const typeDaKhoa = new URL(request.url).searchParams.get("type");
  if (!typeDaKhoa) return undefined;
  const expectedType = publicOfferingTypeSchema.safeParse(typeDaKhoa);
  const receivedType = typeof body === "object" && body !== null && "type" in body ? body.type : undefined;
  if (!expectedType.success || receivedType !== expectedType.data) return "Loại nội dung không khớp với màn quản trị đang sử dụng.";
  return undefined;
}

export async function GET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  const query = new URL(request.url).searchParams;
  const pagination = adminListQuerySchema.safeParse({ page: query.get("page") ?? undefined, pageSize: query.get("pageSize") ?? undefined, query: query.get("query") ?? undefined });
  const status = z.enum(["draft", "review", "scheduled", "published", "archived"]).optional().safeParse(query.get("status") || undefined);
  const type = publicOfferingTypeSchema.optional().safeParse(query.get("type") || undefined);
  if (!pagination.success || !status.success || !type.success) return phanHoiLoi("INVALID_INPUT", "Bộ lọc danh sách nội dung catalog không hợp lệ.", 400);
  try {
    const list = query.get("view") === "summary" ? getAdminOfferingSummariesPage : getAdminOfferingsPage;
    return NextResponse.json({ result: await list({ ...pagination.data, status: status.data, type: type.data }) });
  } catch {
    return phanHoiLoi("INTERNAL_ERROR", "Không thể tải danh sách sản phẩm, giải pháp hoặc dịch vụ lúc này. Vui lòng thử lại.", 500);
  }
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
    const denied = denyPublishUnless(administrator, "offerings.publish", { requestedStatus: requestedStatusOf(body) });
    if (denied) return denied;
    const offering = await createAdminOffering(body, administrator.userId);
    lamMoiNoiDungCatalog(offering.type, offering.slug);
    return NextResponse.json({ offering }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return phanHoiLoi("INVALID_INPUT", "Vui lòng kiểm tra lại các trường bắt buộc của Offering.", 400);
    }

    if (hasDatabaseErrorCode(error, "23505")) {
      return phanHoiLoi("DUPLICATE_SLUG", "Slug đã tồn tại trong nhóm nội dung này.", 409);
    }

    logger.error("Tạo Offering trong CMS thất bại.", { request, error });
    return phanHoiLoi("INTERNAL_ERROR", "Không thể tạo Offering lúc này. Vui lòng thử lại.", 500);
  }
}
