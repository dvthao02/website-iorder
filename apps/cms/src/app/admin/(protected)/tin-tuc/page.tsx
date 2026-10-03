import { redirect } from "next/navigation";

import { PostManagerList } from "@/components/admin/post-manager-list";
import { getAdminPosts } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function AdministratorPostsPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string }> }) {
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/tin-tuc/moi");
  if (params.edit) redirect(`/admin/tin-tuc/${encodeURIComponent(params.edit)}`);
  const posts = await getAdminPosts();

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <section className="mx-auto max-w-7xl">
        <PostManagerList items={posts.filter((post) => post.type !== "guide")} />
      </section>
    </main>
  );
}
