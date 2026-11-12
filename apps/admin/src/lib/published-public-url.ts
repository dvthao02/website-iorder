const defaultPublicWebsiteOrigin = "http://localhost:3000";

function normalizedOrigin(value: string | undefined) {
  const candidate = value?.trim() || defaultPublicWebsiteOrigin;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : defaultPublicWebsiteOrigin;
  } catch {
    return defaultPublicWebsiteOrigin;
  }
}

/** CMS và website public là hai ứng dụng độc lập. */
export function publishedPublicUrl(path: string, origin = process.env.NEXT_PUBLIC_PUBLISH_WEB_URL) {
  return new URL(path, normalizedOrigin(origin)).toString();
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Website cấu hình là localhost nhưng CMS đang mở bằng IP/tên máy khác: đổi sang cùng máy với CMS (giữ cổng website). */
export function rebaseLoopbackHost(url: string, currentHostname: string) {
  const parsed = new URL(url);
  if (loopbackHosts.has(parsed.hostname) && currentHostname && !loopbackHosts.has(currentHostname)) parsed.hostname = currentHostname;
  return parsed.toString();
}

/**
 * Dùng ở trình duyệt (trong sự kiện hoặc effect, không để vẽ ra HTML phía server): khi mở CMS qua IP LAN (ví dụ http://192.168.1.5:3001)
 * thì xem trước/liên kết website dùng cùng IP đó thay vì "localhost" (là chính máy người xem, không phải máy chạy website).
 */
export function browserPublicUrl(path: string, origin = process.env.NEXT_PUBLIC_PUBLISH_WEB_URL) {
  const url = publishedPublicUrl(path, origin);
  return typeof window === "undefined" ? url : rebaseLoopbackHost(url, window.location.hostname);
}
