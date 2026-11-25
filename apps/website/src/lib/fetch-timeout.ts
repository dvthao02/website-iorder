// Next bỏ `signal` của fetch khi làm mới nền một mục cache đã cũ (node_modules/next/dist/server/lib/patch-fetch.js: "don't pass through signal when revalidating"),
// nên timeout 10 giây đặt ở backend.ts không áp dụng cho lượt làm mới đó. Backend treo (database mất kết nối…) thì undici đợi tới 5 phút
// (UND_ERR_HEADERS_TIMEOUT) và các lượt treo dồn lại. Mọi fetch của website không mang `signal` được giới hạn thời gian ở đây;
// fetch đã có `signal` (hoặc truyền vào là Request, vốn có signal riêng) giữ nguyên.
export const defaultFetchTimeoutMs = 10_000;

type FetchFunction = typeof fetch;
const installedMarker = Symbol.for("iorder.website.defaultFetchTimeout");

export function withDefaultFetchTimeout(base: FetchFunction, timeoutMs = defaultFetchTimeoutMs): FetchFunction {
  return ((input: Parameters<FetchFunction>[0], init?: Parameters<FetchFunction>[1]) => {
    if (init?.signal || input instanceof Request) return base(input, init);
    return base(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }) as FetchFunction;
}

/**
 * Phải chạy trước khi Next vá fetch (`register()` trong instrumentation chạy trước bước nạp trang), để lớp giới hạn này nằm dưới lớp cache của Next
 * và thấy được lượt làm mới nền đã bị bỏ `signal`. Gọi lại nhiều lần chỉ bọc một lần.
 */
export function installDefaultFetchTimeout(timeoutMs = defaultFetchTimeoutMs) {
  const current = globalThis.fetch as FetchFunction & { [installedMarker]?: true };
  if (typeof current !== "function" || current[installedMarker]) return;
  const bounded = withDefaultFetchTimeout(current, timeoutMs) as FetchFunction & { [installedMarker]?: true };
  bounded[installedMarker] = true;
  globalThis.fetch = bounded;
}
