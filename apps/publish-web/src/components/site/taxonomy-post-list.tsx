import { SiteLink as Link } from "@/components/site/site-link";
import type { PublicPostSummary } from "@iorder/core/server/posts/posts.contract";

const postTypeLabel = { announcement: "Thông báo", case_study: "Câu chuyện khách hàng", guide: "Hướng dẫn", news: "Tin tức", promotion: "Khuyến mãi" } as const;

export function TaxonomyPostList({ posts }: { posts: PublicPostSummary[] }) {
  return posts.length ? <section className="mt-10 grid gap-4">{posts.map(post => <Link className="rounded-xl border border-slate-200 bg-white p-5 hover:border-brand-300" href={post.type === "guide" ? `/ho-tro/huong-dan/${post.slug}` : `/tin-tuc/${post.slug}`} key={post.id}><p className="text-sm font-bold text-brand-700">{postTypeLabel[post.type]}</p><h2 className="mt-2 text-xl font-bold">{post.title}</h2>{post.excerpt ? <p className="mt-2 text-slate-600">{post.excerpt}</p> : null}</Link>)}</section> : <p className="mt-10 rounded-xl border border-dashed p-6 text-slate-600">Chưa có bài viết được xuất bản trong mục này.</p>;
}
