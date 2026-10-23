import { redirect } from "next/navigation";

// Đường dẫn cũ khi hướng dẫn còn là một tab của "Hỗ trợ cài đặt".
export default function LegacyNewGuidePage() {
  redirect("/admin/guides/new");
}
