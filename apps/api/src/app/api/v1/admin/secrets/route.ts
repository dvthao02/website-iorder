import { NextResponse } from "next/server";
import { z } from "zod";

import { isSuperAdmin } from "@iorder/shared/server/auth/permissions";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { clearSecret, createMasterKey, getSecretsOverview, InvalidPasswordError, isMissingTableError, MasterKeyExistsError, SecretsError, SecretValidationError, setSecret, setSecrets, TooManyAttemptsError } from "@iorder/shared/server/secrets/secrets";
import { clearSecretRequestSchema, createMasterKeyRequestSchema, setSecretRequestSchema, setSecretsRequestSchema } from "@iorder/shared/server/secrets/secrets.contract";
import { ContentVersionConflictError } from "@iorder/shared/server/shared/content-version";
import { logger } from "@iorder/shared/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kết nối & khóa API (Cài đặt → Kết nối & khóa API). CHỈ Super Admin: đường dẫn này không map permission nào nên proxy chỉ cho Super Admin
// (admin-permission.ts), ở đây kiểm lại. Quy tắc:
// - Không có endpoint nào trả giá trị khóa; GET chỉ trả "đã đặt/chưa đặt", nguồn và gợi ý không bí mật.
// - PUT (đặt/thay), DELETE (xóa khỏi CMS) và POST {action:"create-master-key"} (tạo khóa chủ khi máy chủ chưa có) đều phải kèm mật khẩu của chính
//   người đang đăng nhập; sai nhiều lần thì bị chặn tạm.
// - Nhật ký hoạt động chỉ ghi "ai đặt/xóa khóa nào", không ghi giá trị. Phản hồi luôn no-store.
const noStore = { "cache-control": "no-store" };
const fail = (code: string, message: string, status: number, headers: Record<string, string> = {}, key?: string) => NextResponse.json({ error: { code, message, ...(key ? { key } : {}) } }, { status, headers: { ...noStore, ...headers } });

async function authorize() {
  const user = await getRequestAdministrator();
  if (!user) return { response: fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401) };
  if (!isSuperAdmin(user)) return { response: fail("FORBIDDEN", "Chỉ Super Admin được quản lý khóa API.", 403) };
  return { user };
}

function mapError(error: unknown, request: Request) {
  if (error instanceof InvalidPasswordError) return fail("INVALID_PASSWORD", error.message, 403);
  if (error instanceof TooManyAttemptsError) return fail("TOO_MANY_ATTEMPTS", error.message, 429, { "retry-after": String(Math.ceil(error.retryAfterSeconds)) });
  if (error instanceof SecretValidationError) return fail("INVALID_SECRET", error.message, 400, {}, error.key);
  if (error instanceof MasterKeyExistsError) return fail("MASTER_KEY_EXISTS", error.message, 409);
  if (error instanceof SecretsError) return fail("SECRETS_UNAVAILABLE", error.message, 503);
  if (error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
  if (error instanceof z.ZodError) return fail("INVALID_INPUT", error.issues[0]?.message ?? "Yêu cầu không hợp lệ.", 400);
  if (error instanceof SyntaxError) return fail("INVALID_INPUT", "Yêu cầu không hợp lệ.", 400);
  if (isMissingTableError(error)) {
    logger.error("Kho khóa: database chưa có bảng secure_settings (chưa chạy migration 0025).", { request, error });
    return fail("MIGRATION_PENDING", "Cơ sở dữ liệu chưa có bảng lưu khóa API (migration 0025). Chạy pnpm db:migrate (máy chủ: chạy lại dịch vụ migrate) rồi tải lại trang.", 503);
  }
  logger.error("Kho khóa: lỗi không xác định.", { request, error });
  return fail("INTERNAL_ERROR", "Không xử lý được yêu cầu lúc này. Vui lòng thử lại.", 500);
}

async function handleGET(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  try {
    return NextResponse.json({ overview: await getSecretsOverview() }, { headers: noStore });
  } catch (error) {
    return mapError(error, request);
  }
}

async function handlePUT(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  try {
    const raw = await request.json() as unknown;
    // Thẻ công cụ có nhiều biến: lưu cả nhóm một lần, một lần xác nhận mật khẩu ({ items, password }).
    if (raw && typeof raw === "object" && "items" in raw) {
      const batch = setSecretsRequestSchema.parse(raw);
      return NextResponse.json({ statuses: await setSecrets({ userId: auth.user.userId, items: batch.items, password: batch.password }) }, { headers: noStore });
    }
    const body = setSecretRequestSchema.parse(raw);
    const status = await setSecret({ userId: auth.user.userId, key: body.key, value: body.value, password: body.password, expectedVersion: body.expectedVersion });
    return NextResponse.json({ status }, { headers: noStore });
  } catch (error) {
    return mapError(error, request);
  }
}

async function handlePOST(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  try {
    const body = createMasterKeyRequestSchema.parse(await request.json());
    return NextResponse.json({ overview: await createMasterKey({ userId: auth.user.userId, password: body.password }) }, { headers: noStore });
  } catch (error) {
    return mapError(error, request);
  }
}

async function handleDELETE(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  try {
    const body = clearSecretRequestSchema.parse(await request.json());
    return NextResponse.json({ status: await clearSecret({ userId: auth.user.userId, key: body.key, password: body.password }) }, { headers: noStore });
  } catch (error) {
    return mapError(error, request);
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
export const PUT = withRequestContext(handlePUT);
export const DELETE = withRequestContext(handleDELETE);
