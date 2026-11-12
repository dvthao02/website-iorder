export type PaginationItem = number | "gap-start" | "gap-end";

/**
 * Dãy nút số trang: ít trang thì hiện hết; nhiều trang thì luôn có trang đầu, trang cuối và trang hiện tại
 * cùng hai bên, phần còn lại thu thành "…". Luôn đúng 7 ô khi từ 8 trang trở lên nên thanh không nhảy chỗ.
 */
export function paginationItems(page: number, totalPages: number): PaginationItem[] {
  const last = Math.max(totalPages, 1);
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1);
  const current = Math.min(Math.max(page, 1), last);
  if (current <= 4) return [1, 2, 3, 4, 5, "gap-end", last];
  if (current >= last - 3) return [1, "gap-start", last - 4, last - 3, last - 2, last - 1, last];
  return [1, "gap-start", current - 1, current, current + 1, "gap-end", last];
}

/** Số gõ vào ô "Nhảy tới trang": chỉ nhận số nguyên dương; vượt quá thì về trang cuối; không hợp lệ thì bỏ qua. */
export function parseJumpPage(value: string, totalPages: number): number | null {
  if (!/^\s*\d+\s*$/.test(value)) return null;
  const target = Number(value);
  if (!Number.isSafeInteger(target) || target < 1) return null;
  return Math.min(target, Math.max(totalPages, 1));
}
