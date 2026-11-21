// Chọn địa chỉ gốc của website công khai cho các nút "Xem website", "Mở trang đã xuất bản", "Xem trước bản nháp" trong CMS.
// Quy tắc dựa trên nơi người dùng đang mở CMS, nên không cần build lại khi đổi môi trường:
//  - CMS mở bằng localhost hoặc IP/tên máy trong mạng nội bộ (192.168.x, 10.x, 172.16–31.x, *.local, tên một chữ):
//    website chạy cùng máy đó. Giữ cổng của địa chỉ website cấu hình sẵn (mặc định 3000), chỉ đổi tên máy. Không dùng tên miền
//    đã cấu hình ở Cài đặt, vì trước khi xuất bản tên miền đó chưa trỏ về máy này.
//  - CMS mở bằng tên miền thật: ưu tiên "Địa chỉ website" ở CMS → Cài đặt (sửa được ngay, không build lại), rồi tới biến môi trường
//    NEXT_PUBLIC_PUBLISH_WEB_URL khi nó không phải localhost, cuối cùng là giá trị cấu hình sẵn.

export const defaultWebsiteOrigin = "http://localhost:3000";

function parseOrigin(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Tên máy trong Host/X-Forwarded-Host (bỏ cổng; hỗ trợ IPv6 dạng [::1]:3001). Rỗng khi không đọc được. */
export function hostnameOf(host: string | null | undefined) {
  const first = host?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first) return "";
  if (first.startsWith("[")) return first.slice(0, first.indexOf("]") + 1);
  return first.replace(/:\d+$/, "");
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
export function isLoopbackHostname(hostname: string) {
  return loopbackHosts.has(hostname) || hostname.endsWith(".localhost") || /^127\./.test(hostname);
}

/** Tên máy chỉ có ý nghĩa trong mạng nội bộ: loopback, IP riêng, link-local, IPv6 nội bộ, *.local/.lan/.internal hoặc tên không có dấu chấm. */
export function isLocalNetworkHostname(hostname: string) {
  if (!hostname) return false;
  if (isLoopbackHostname(hostname)) return true;
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  if (hostname.startsWith("[")) return /^\[(fc|fd|fe80)/.test(hostname);
  return !hostname.includes(".") || /\.(local|lan|internal|home|localdomain)$/.test(hostname);
}

export type WebsiteOriginInput = {
  /** Host của yêu cầu vào CMS (X-Forwarded-Host hoặc Host). */
  requestHost: string | null | undefined;
  /** "Địa chỉ website" nhập ở CMS → Cài đặt. */
  configuredSiteUrl: string | null | undefined;
  /** NEXT_PUBLIC_PUBLISH_WEB_URL (cấu hình lúc build/chạy). */
  envOrigin: string | null | undefined;
};

export function resolveWebsiteOrigin({ requestHost, configuredSiteUrl, envOrigin }: WebsiteOriginInput): string {
  const env = parseOrigin(envOrigin) ?? new URL(defaultWebsiteOrigin);
  const configured = parseOrigin(configuredSiteUrl);
  const hostname = hostnameOf(requestHost);

  if (hostname && isLocalNetworkHostname(hostname)) {
    // Website được đặt ở địa chỉ thật (không phải localhost) thì tôn trọng; còn lại là website cùng máy với CMS, đổi tên máy theo nơi đang mở CMS.
    if (!isLoopbackHostname(env.hostname)) return env.origin;
    const rebased = new URL(env.origin);
    rebased.hostname = hostname;
    return rebased.origin;
  }

  if (configured && !isLoopbackHostname(configured.hostname)) return configured.origin;
  return env.origin;
}

/**
 * Địa chỉ website hiển thị trong bản xem trước Google: là địa chỉ khách sẽ thấy trên Google, nên ưu tiên "Địa chỉ website" ở Cài đặt
 * (kể cả khi đang mở CMS qua LAN) và chỉ khi chưa đặt hoặc đặt là localhost mới dùng địa chỉ các nút mở trang đang dùng.
 */
export function resolvePublicOrigin(configuredSiteUrl: string | null | undefined, origin: string) {
  const configured = parseOrigin(configuredSiteUrl);
  return configured && !isLoopbackHostname(configured.hostname) ? configured.origin : origin;
}

/** Ghép đường dẫn (hoặc URL tuyệt đối) với địa chỉ gốc đã chọn. */
export function websiteUrl(origin: string, path: string) {
  return new URL(path, origin).toString();
}
