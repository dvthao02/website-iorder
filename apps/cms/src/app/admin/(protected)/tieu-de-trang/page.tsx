import { redirect } from "next/navigation";

// Phần đầu trang Tin tức/Thiết bị/Hỗ trợ nay là "Trang danh sách" trong Trang website,
// mở từ nút "Trang danh sách" ở màn quản lý từng module.
export default function LegacyListingTitlesPage() {
  redirect("/admin/tin-tuc");
}
