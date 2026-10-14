export function outOfRangeListHref(baseHref: string, result: { page: number; totalPages: number }, filters: { query?: string; status?: string }) {
  if (result.page <= result.totalPages) return undefined;
  const params = new URLSearchParams({ page: String(result.totalPages) });
  if (filters.query) params.set("query", filters.query);
  if (filters.status) params.set("status", filters.status);
  return `${baseHref}?${params}`;
}
