import { redirect } from "next/navigation";

// Vai trò & quyền đã gộp vào trang Người dùng (tab thứ hai); giữ đường dẫn cũ cho dấu trang và liên kết cũ.
export default function RolesAndPermissionsPage() {
  redirect("/admin/users?tab=roles");
}
