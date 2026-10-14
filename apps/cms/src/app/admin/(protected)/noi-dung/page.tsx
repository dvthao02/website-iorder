import { redirect } from "next/navigation";

/** Danh mục này đã được chuẩn hoá theo các model Sản phẩm, Giải pháp và Dịch vụ. */
export default function AdministratorContentPage() {
  redirect("/admin/san-pham");
}
