import type { Metadata, ResolvingMetadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { authorPublicPath } from "@iorder/shared/server/authors/authors.contract";
import { suggestSeoDescription } from "@iorder/shared/server/shared/seo";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { getT } from "@/lib/messages";
import { TaxonomyPostList } from "@/components/site/taxonomy-post-list";
import { getPublishedAuthorPage, getPublishingConfig } from "@/lib/backend";
import { contentMetadata } from "@/lib/page-metadata";
import { profilePageJsonLd } from "@/lib/structured-data";

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 0;

// Không có tiểu sử thì dùng câu mô tả theo tên (Google và phần đầu trang dùng chung).
const describe = (name: string, bio: string | null) => (bio ? suggestSeoDescription(bio, null) : null) ?? `Các bài viết và hướng dẫn của ${name} trên iOrder.`;

export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const result = await getPublishedAuthorPage((await params).slug);
  if (!result) return { title: (await getT())("author.notFound") };
  const { author } = result;
  return contentMetadata({
    title: `${author.name}${author.jobTitle ? ` – ${author.jobTitle}` : ""} – Tác giả`,
    description: describe(author.name, author.bio),
    path: authorPublicPath(author.slug),
    image: author.avatar ? { url: author.avatar.url, alt: author.avatar.altText ?? author.name } : null,
  }, parent);
}

// Trang tác giả: hồ sơ (ảnh, chức danh, tiểu sử, liên kết hồ sơ ngoài) rồi danh sách bài đã xuất bản của người đó.
// Chỉ có khi tác giả đã bật trang riêng và có ít nhất một bài; không thì 404 (backend trả null).
export default async function AuthorPage({ params }: Props) {
  const t = await getT();
  const { slug } = await params;
  const [result, config] = await Promise.all([getPublishedAuthorPage(slug), getPublishingConfig()]);
  if (!result) notFound();
  const { author, posts } = result;
  const path = authorPublicPath(author.slug);
  return <>
    <SiteHeader />
    {config.siteUrl ? <JsonLd data={[profilePageJsonLd(config.siteUrl, { name: author.name, jobTitle: author.jobTitle, bio: author.bio, path, avatarPath: author.avatar?.url ?? null, profileUrl: author.profileUrl, modifiedAt: author.updatedAt })]} /> : null}
    <main id="noi-dung">
      <PageHero crumbs={[{ name: author.name, path }]} description={author.jobTitle} eyebrow={t("author.eyebrow")} title={author.name}>
        <div className="mt-6 flex max-w-3xl flex-col gap-5 sm:flex-row sm:items-start">
          {author.avatar ? <Image alt={author.avatar.altText ?? author.name} className="h-28 w-28 shrink-0 rounded-full border border-line object-cover" height={112} priority sizes="112px" src={author.avatar.url} width={112} /> : null}
          <div className="min-w-0">
            {author.bio ? <p className="m-0 text-lead whitespace-pre-line text-muted">{author.bio}</p> : null}
            {author.profileUrl ? <p className="mt-3 mb-0"><a className="font-semibold text-brand-700 hover:underline" href={author.profileUrl} rel="me noopener" target="_blank">{t("author.profile", { name: author.name })}</a></p> : null}
          </div>
        </div>
      </PageHero>
      <TaxonomyPostList posts={posts} />
    </main>
  </>;
}
