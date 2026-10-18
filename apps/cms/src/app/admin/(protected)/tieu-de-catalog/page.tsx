import { redirect } from "next/navigation";

// Phần đầu trang Phần mềm/Giải pháp/Dịch vụ nay là "Trang danh sách" trong Trang website,
// mở từ nút "Trang danh sách" ở màn quản lý từng loại.
export default function LegacyCatalogTitlesPage() {
  redirect("/admin/san-pham");
}
