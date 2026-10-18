// Tóm tắt user agent thành "Trình duyệt · Hệ điều hành · loại thiết bị" cho nhật ký hoạt động.
// Chỉ nhận diện các trường hợp phổ biến; chuỗi gốc vẫn được lưu và hiển thị trong phần chi tiết.
export type DeviceSummary = { browser: string | null; os: string | null; device: "Máy tính" | "Điện thoại" | "Máy tính bảng" | null; label: string };

const browsers: [RegExp, string][] = [
  [/coc_coc_browser\/(\d+)/i, "Cốc Cốc"],
  [/edg(?:e|a|ios)?\/(\d+)/i, "Edge"],
  [/(?:opr|opera)\/(\d+)/i, "Opera"],
  [/samsungbrowser\/(\d+)/i, "Samsung Internet"],
  [/zalo(?:theme)?\/?(\d+)?/i, "Zalo"],
  [/fban|fbav\/(\d+)/i, "Facebook"],
  [/(?:firefox|fxios)\/(\d+)/i, "Firefox"],
  [/(?:chrome|crios)\/(\d+)/i, "Chrome"],
  [/version\/(\d+)[\d.]* (?:mobile\/\S+ )?safari/i, "Safari"],
];

function detectOs(ua: string) {
  if (/windows nt 10/i.test(ua)) return "Windows";
  if (/windows nt/i.test(ua)) return "Windows (cũ)";
  if (/iphone|ipod/i.test(ua)) return `iOS${ua.match(/os (\d+)_/i)?.[1] ? ` ${ua.match(/os (\d+)_/i)![1]}` : ""}`;
  if (/ipad/i.test(ua)) return "iPadOS";
  if (/android/i.test(ua)) return `Android${ua.match(/android (\d+)/i)?.[1] ? ` ${ua.match(/android (\d+)/i)![1]}` : ""}`;
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return null;
}

export function summarizeUserAgent(userAgent: string | null | undefined): DeviceSummary {
  const ua = userAgent?.trim() ?? "";
  if (!ua) return { browser: null, os: null, device: null, label: "Không rõ" };
  if (/curl|wget|python|node-fetch|undici|postman|httpie|go-http-client|axios/i.test(ua)) {
    return { browser: null, os: null, device: null, label: `Công cụ dòng lệnh (${ua.split(/[\s/]/)[0]})` };
  }
  let browser: string | null = null;
  for (const [pattern, name] of browsers) {
    const match = ua.match(pattern);
    if (match) { browser = match[1] ? `${name} ${match[1]}` : name; break; }
  }
  const os = detectOs(ua);
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? "Máy tính bảng" : /mobi|iphone|ipod/i.test(ua) ? "Điện thoại" : os ? "Máy tính" : null;
  const parts = [browser, os, device].filter(Boolean);
  return { browser, os, device, label: parts.length ? parts.join(" · ") : "Không rõ" };
}
