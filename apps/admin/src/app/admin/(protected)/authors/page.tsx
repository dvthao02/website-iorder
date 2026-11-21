import { AdminPage } from "@/components/admin/ui/admin-page";
import { AuthorsManager } from "@/components/admin/authors-manager";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAuthors } from "@/lib/backend";

export const dynamic = "force-dynamic";

// Tác giả bài viết thuộc mô-đun Bài viết nên dùng quyền posts.*.
export default async function AuthorsPage() {
  await requireAdminPermission("posts.view");
  const authors = await getAuthors();
  return <AdminPage variant="flush">
    <AuthorsManager authors={authors} />
  </AdminPage>;
}
