import { redirect } from "next/navigation";

// Danh sách đã gộp vào màn "Sản phẩm & Dịch vụ" (/admin/products, tab theo loại); trang sửa vẫn ở /admin/services/<id>.
export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string; query?: string; status?: string; page?: string; sort?: string; dir?: string }> }) {
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/services/new");
  if (params.edit) redirect(`/admin/services/${encodeURIComponent(params.edit)}`);
  const query = new URLSearchParams({ type: "service" });
  // Giữ bộ lọc, trang và thứ tự của link cũ (bookmark); /admin/products tự sửa giá trị không hợp lệ.
  for (const key of ["query", "status", "page", "sort", "dir"] as const) { const value = params[key]; if (value) query.set(key, value); }
  redirect(`/admin/products?${query.toString()}`);
}
