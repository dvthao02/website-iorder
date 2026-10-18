import { redirect } from "next/navigation";

// Trang tổng quan cũ chỉ có chữ hướng dẫn; cấu hình website (tên miền, lập chỉ mục) nằm ở SEO & Xuất bản.
export default function LegacySettingsPage() {
  redirect("/admin/seo");
}
