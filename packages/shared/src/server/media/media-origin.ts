// Giữ quy tắc host hiện tại; header không parse được phải bị từ chối thay vì ném lỗi.
export function isMediaUploadOriginAllowed(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Caddy overwrites X-Forwarded-Host before sending a request to CMS. Next
// rewrites then use the backend's internal Host, so mutation checks must prefer
// that original public host when it is present.
export function getOriginalRequestHost(headers: Headers): string | null {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",").at(-1)?.trim();
  return forwardedHost || headers.get("host");
}
