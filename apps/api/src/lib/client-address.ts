import { isIP } from "node:net";

export function getClientAddress(forwardedFor: string | null, realIp: string | null) {
  const forwardedAddress = forwardedFor?.split(",").at(-1)?.trim();
  if (forwardedAddress) return isIP(forwardedAddress) ? forwardedAddress : null;

  const fallbackAddress = realIp?.trim();
  return fallbackAddress && isIP(fallbackAddress) ? fallbackAddress : null;
}

function isInternalIPv4(address: string) {
  const [first, second] = address.split(".").map(Number);
  return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

/**
 * Địa chỉ nội bộ: loopback, mạng riêng (RFC 1918, gồm mạng cầu nối của Docker), link-local và ULA IPv6.
 * Website và CMS gọi Backend từ phía server qua mạng nội bộ; Next tự gán `X-Forwarded-For` bằng địa chỉ socket khi request không có header đó
 * (base-server.js), nên "không có IP" không dùng được để nhận ra lời gọi nội bộ. Khách thật luôn có IP công cộng do Caddy ghi đè.
 */
export function isInternalAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isInternalIPv4(address);
  if (family !== 6) return false;
  const lower = address.toLowerCase();
  const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isInternalIPv4(dotted[1]);
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) { const high = parseInt(hex[1], 16); const low = parseInt(hex[2], 16); return isInternalIPv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`); }
  return lower === "::1" || lower === "::" || /^f[cd][0-9a-f]{2}:/.test(lower) || /^fe[89ab][0-9a-f]:/.test(lower);
}
