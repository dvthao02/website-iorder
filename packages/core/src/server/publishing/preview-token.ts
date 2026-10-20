import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Token xem trước bản nháp: chỉ Backend ký và kiểm tra, website chỉ chuyển tiếp nguyên văn.
// Mỗi token gắn với đúng một nội dung (loại + id) và hết hạn sau 1 giờ.
export type PreviewKind = "post" | "page" | "offering";
export type PreviewClaims = { kind: PreviewKind; id: string; exp: number };

export const previewTokenTtlSeconds = 60 * 60;
const kinds = new Set<PreviewKind>(["post", "page", "offering"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Môi trường dev chưa cấu hình secret: dùng khóa ngẫu nhiên theo tiến trình (token mất hiệu lực khi khởi động lại).
let developmentKey: Buffer | undefined;

function signingKey() {
  const base = process.env.PREVIEW_SECRET?.trim() || process.env.PUBLISH_WEB_REVALIDATE_SECRET?.trim();
  if (base) return createHmac("sha256", base).update("iorder-preview-v1").digest();
  if (process.env.NODE_ENV === "production") throw new Error("Chưa cấu hình PREVIEW_SECRET hoặc PUBLISH_WEB_REVALIDATE_SECRET cho xem trước bản nháp.");
  developmentKey ??= randomBytes(32);
  return developmentKey;
}

function sign(payload: string) {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function createPreviewToken(kind: PreviewKind, id: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ kind, id, exp: Math.floor(now / 1000) + previewTokenTtlSeconds })).toString("base64url");
  return `v1.${payload}.${sign(payload)}`;
}

/** Token hợp lệ → claims; sai chữ ký, hết hạn hoặc sai dạng → null (không phân biệt lý do để tránh dò). */
export function verifyPreviewToken(token: string | null | undefined, now = Date.now()): PreviewClaims | null {
  if (!token || token.length > 512) return null;
  const [version, payload, signature] = token.split(".");
  if (version !== "v1" || !payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<PreviewClaims>;
    if (!claims.kind || !kinds.has(claims.kind) || typeof claims.id !== "string" || !uuidPattern.test(claims.id) || typeof claims.exp !== "number") return null;
    if (claims.exp * 1000 <= now) return null;
    return { kind: claims.kind, id: claims.id, exp: claims.exp };
  } catch {
    return null;
  }
}
