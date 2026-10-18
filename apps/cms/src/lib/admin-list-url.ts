// Trang vượt quá tổng số trang (ví dụ sau khi xóa) → về trang cuối, giữ nguyên bộ lọc và sắp xếp.
export function outOfRangeListHref(baseHref: string, result: { page: number; totalPages: number }, filters: Record<string, string | undefined>) {
  if (result.page <= result.totalPages) return undefined;
  const params = new URLSearchParams({ page: String(result.totalPages) });
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return `${baseHref}?${params}`;
}
