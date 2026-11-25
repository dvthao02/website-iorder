// Bộ nhớ đệm trong tiến trình cho lượt tra chuyển hướng URL ở proxy.
//
// Proxy chạy ở MỌI lượt xem trang và Next không áp bộ đệm dữ liệu (`force-cache`) cho fetch trong proxy, nên trước đây mỗi lượt xem trang kéo theo
// một cuộc gọi tới Backend và một truy vấn PostgreSQL chỉ để biết "đường dẫn này có chuyển hướng không" (đo: 100 lượt xem /contact → 100 lần quét bảng
// `redirects`, thêm 8–20 ms mỗi trang và CPU của Backend). Hầu hết đường dẫn không có chuyển hướng, kết quả hiếm khi đổi, nên giữ kết quả (kể cả "không có")
// vài chục giây. Lỗi không được nhớ (Backend lỗi thì lần sau hỏi lại). Số khóa có trần để bot quét hàng loạt đường dẫn lạ không làm phình bộ nhớ.

export type RedirectLookup<T> = (path: string) => Promise<T>;

type Entry<T> = { expiresAt: number; value: Promise<T> };

export function createRedirectLookupCache<T>({ load, now = Date.now, ttlMs = 30_000, maxEntries = 500 }: { load: RedirectLookup<T>; now?: () => number; ttlMs?: number; maxEntries?: number }) {
  const entries = new Map<string, Entry<T>>();

  function lookup(path: string): Promise<T> {
    const current = now();
    const hit = entries.get(path);
    if (hit && hit.expiresAt > current) return hit.value;

    const value = load(path);
    entries.delete(path);
    entries.set(path, { expiresAt: current + ttlMs, value });
    // Map giữ thứ tự thêm vào: bỏ khóa cũ nhất khi vượt trần.
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
    // Lỗi không được nhớ. Nhánh .catch chỉ để dọn bộ đệm; người gọi vẫn nhận lỗi qua `value`.
    value.catch(() => { if (entries.get(path)?.value === value) entries.delete(path); });
    return value;
  }

  return { lookup, clear: () => entries.clear(), size: () => entries.size };
}
