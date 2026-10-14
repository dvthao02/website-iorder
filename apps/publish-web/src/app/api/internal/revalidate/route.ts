import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { publicContentCacheTag, verifyPublicCacheInvalidation } from "@iorder/core/server/publishing/cache-invalidation";

export const runtime = "nodejs";

const maxBodyLength = 1024;
const maximumClockSkewMilliseconds = 5 * 60 * 1000;
const payloadSchema = z.object({ tags: z.array(z.literal(publicContentCacheTag)).length(1) }).strict();

function failure(message: string, status: number) {
  return NextResponse.json({ error: { code: "CACHE_REVALIDATION_DENIED", message } }, { status });
}

export async function POST(request: Request) {
  const secret = process.env.PUBLISH_WEB_REVALIDATE_SECRET?.trim();
  if (!secret) return failure("Dịch vụ chưa cấu hình khóa làm mới cache.", 503);

  const timestamp = request.headers.get("x-iorder-cache-timestamp") ?? "";
  const signature = request.headers.get("x-iorder-cache-signature") ?? "";
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(Date.now() - timestampNumber) > maximumClockSkewMilliseconds) {
    return failure("Yêu cầu làm mới cache đã hết hạn.", 401);
  }

  const body = await request.text();
  if (body.length > maxBodyLength) return failure("Yêu cầu làm mới cache quá lớn.", 400);
  if (!verifyPublicCacheInvalidation(secret, timestamp, body, signature)) return failure("Chữ ký làm mới cache không hợp lệ.", 401);

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return failure("Yêu cầu làm mới cache không phải JSON hợp lệ.", 400);
  }
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return failure("Tag làm mới cache không hợp lệ.", 400);

  revalidateTag(publicContentCacheTag, { expire: 0 });
  return NextResponse.json({ revalidated: true, tags: parsed.data.tags });
}
