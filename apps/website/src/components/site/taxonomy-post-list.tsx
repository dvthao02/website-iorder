import type { PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
import { Container } from "@/components/ui";
import { PostCard } from "./collection-list";

// Bài viết của một chuyên mục / thẻ: lưới thẻ bài như trang Tin tức (ảnh, loại bài, tiêu đề, tóm tắt, ngày).
export function TaxonomyPostList({ posts }: { posts: PublicPostSummary[] }) {
  return <section aria-label="Bài viết" className="bg-surface-tinted"><Container className="py-10 sm:py-14">
    {posts.length
      ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.map(post => <PostCard Heading="h2" key={post.id} post={post} />)}</div>
      : <p className="m-0 rounded-card border border-dashed border-line bg-white p-8 text-body text-muted">Chưa có bài viết được xuất bản trong mục này.</p>}
  </Container></section>;
}
