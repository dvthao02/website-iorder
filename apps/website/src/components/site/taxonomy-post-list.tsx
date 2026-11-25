import type { PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
import { Container } from "@/components/ui";
import { PostCard } from "./collection-list";
import { getT } from "@/lib/messages";

// Bài viết của một chuyên mục / thẻ: lưới thẻ bài như trang Tin tức (ảnh, loại bài, tiêu đề, tóm tắt, ngày).
export async function TaxonomyPostList({ posts }: { posts: PublicPostSummary[] }) {
  const t = await getT();
  return <section aria-label={t("news.postsLabel")} className="bg-surface-tinted"><Container className="py-10 sm:py-14">
    {posts.length
      ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.map(post => <PostCard Heading="h2" key={post.id} post={post} />)}</div>
      : <p className="m-0 rounded-card border border-dashed border-line bg-white p-8 text-body text-muted">{t("news.emptyTopic")}</p>}
  </Container></section>;
}
