import { notFound } from "next/navigation";

// Địa chỉ /admin/... không có màn nào: hiện trang "Không tìm thấy" của CMS (trong khung CMS, có thanh bên và ô tìm kiếm)
// thay cho trang 404 tiếng Anh mặc định của Next.
export default function MissingAdminPage() {
  notFound();
}
