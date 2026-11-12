import { isIP } from "node:net";

export function getClientAddress(forwardedFor: string | null, realIp: string | null) {
  const forwardedAddress = forwardedFor?.split(",").at(-1)?.trim();
  if (forwardedAddress) return isIP(forwardedAddress) ? forwardedAddress : null;

  const fallbackAddress = realIp?.trim();
  return fallbackAddress && isIP(fallbackAddress) ? fallbackAddress : null;
}
