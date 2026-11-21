import { createRateLimiter, type RateLimitRule, type RateLimiter } from "@iorder/shared/server/shared/rate-limit";

// Hạn mức theo IP cho từng nhóm đường dẫn của Backend (cửa sổ 1 phút). Đây là van xả lũ chạy trước khi chạm DB/S3; quota đăng nhập
// và liên hệ ở PostgreSQL (login-throttle, leads.rate-limit) vẫn là lớp chính cho hai luồng đó. Số liệu chọn theo cách CMS gọi API:
// tải lên hàng loạt, lưới thư viện media tải tới 100 ảnh một lần, bản xem trước tự gửi tối đa 1 lần/1,5 giây.
export type RouteRateLimit = RateLimitRule & { group: string };

const minute = 60_000;
const perMinute = (group: string, limit: number): RouteRateLimit => ({ group, limit, windowMs: minute });

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const adminPrefix = "/api/v1/admin/";

/** Hạn mức áp cho một request, hoặc null nếu không giới hạn. */
export function rateLimitFor(rawPathname: string, method: string): RouteRateLimit | null {
  const pathname = rawPathname.replace(/\/{2,}/g, "/").replace(/(.)\/+$/, "$1");
  const verb = method.toUpperCase();
  const write = writeMethods.has(verb);

  if (pathname === "/api/health") return null;
  if (pathname.startsWith("/media/")) return perMinute("media", 1_200);
  if (pathname === "/api/v1/leads") return write ? perMinute("lead", 20) : perMinute("api", 300);
  if (pathname.startsWith("/api/v1/public/")) return perMinute("public", 120);

  if (pathname.startsWith(adminPrefix)) {
    const [resource, second, third] = pathname.slice(adminPrefix.length).split("/");
    // Chặn dò mật khẩu hàng loạt trước khi tới quota PostgreSQL (mỗi lần thử tốn một lần ghi DB và một lần băm scrypt).
    if (resource === "session" && verb === "POST") return perMinute("login", 20);
    // Đổi mật khẩu/ảnh đại diện, khóa API, sao lưu & phục hồi: hiếm khi dùng, thao tác nặng hoặc nhạy cảm.
    if ((resource === "account" || resource === "secrets" || resource === "backup") && write) return perMinute("sensitive", 20);
    // Tác vụ tốn CPU/băng thông: tải tệp từ link ngoài, nhập Word, nhập/xuất bảng, kiểm tra SEO.
    if ((resource === "media" && second === "import-url") || (resource === "posts" && third === "word")
      || resource === "data-transfer" || (resource === "leads" && second === "export") || resource === "seo-audit") return perMinute("heavy", 20);
    // Tải tệp lên thư viện media: cho phép tải hàng loạt.
    if (resource === "media" && verb === "POST" && second === undefined) return perMinute("upload", 60);
    return write ? perMinute("admin-write", 120) : perMinute("admin-read", 600);
  }

  return perMinute("api", 300);
}

// Một bộ đếm dùng chung cho tiến trình; globalThis để không bị tạo lại mỗi lần nạp lại module khi `next dev`.
const globalForLimiter = globalThis as typeof globalThis & { __iorderApiRateLimiter?: RateLimiter };
export const apiRateLimiter = globalForLimiter.__iorderApiRateLimiter ??= createRateLimiter();

// Công tắc khẩn cấp cho người vận hành khi hạn mức chặn nhầm người dùng thật: đặt RATE_LIMIT_DISABLED=1 rồi khởi động lại api.
export function isRateLimitDisabled(env: Record<string, string | undefined> = process.env) {
  const value = env.RATE_LIMIT_DISABLED?.trim().toLowerCase();
  return value === "1" || value === "true";
}
