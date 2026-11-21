import type { Metadata, ResolvingMetadata } from "next";
import { draftMode, headers } from "next/headers";
import { contentSeoSchema, type ContentSeo } from "@iorder/shared/server/shared/content-seo";
import { getMediaById, getPublishingConfig } from "@/lib/backend";
import { ogImagePath, ogImageSize } from "@/lib/og-image";
import { robotsDirectives } from "@/lib/robots-meta";
import { withBrand } from "@iorder/shared/server/shared/seo";

type ContentMetadataInput = {
  title: string;
  description?: string | null;
  /** Đường dẫn public của trang, dùng làm canonical mặc định. */
  path: string;
  /** Canonical do người vận hành nhập trong CMS (ưu tiên hơn đường dẫn trang). */
  canonicalUrl?: string | null;
  image?: { url: string; alt?: string | null } | null;
  type?: "website" | "article";
  /** Chỉ dùng khi `type` là article: Facebook/Zalo/LinkedIn đọc ngày đăng, ngày sửa, chuyên mục và thẻ từ đây. */
  article?: { publishedTime?: Date | null; modifiedTime?: Date | null; section?: string | null; tags?: readonly string[] };
  /** Tác giả thật của bài (CMS): thành thẻ meta author và liên kết rel=author. */
  authors?: ReadonlyArray<{ name: string; url?: string | null }>;
  seo?: ContentSeo;
};

// Tiêu đề trên Google/tab trình duyệt luôn có tên thương hiệu: thêm " | iOrder" khi tiêu đề chưa có chữ iOrder
// (trang danh sách, trang tĩnh trước đây thiếu; trang đã tự thêm thì giữ nguyên, không lặp).
// Quy tắc dùng chung với bản xem trước Google trong CMS (shared/seo.ts) để hai bên luôn hiện cùng một tiêu đề.
export { withBrand };

// Metadata của một trang nội dung: canonical trỏ về chính trang (hoặc canonical CMS) và
// Open Graph riêng. Metadata được merge nông, nên openGraph ở đây thay toàn bộ openGraph của
// layout: lấy ảnh và tên site mặc định từ `parent` để không mất khi trang không có ảnh riêng.
export async function contentMetadata(input: ContentMetadataInput, parent: ResolvingMetadata): Promise<Metadata> {
  const inherited = await parent;
  const seo = contentSeoSchema.parse(input.seo ?? {});
  const [config, draft, requestHeaders, ogMedia, twitterMedia] = await Promise.all([
    getPublishingConfig(), draftMode(), headers(),
    seo.openGraph?.imageMediaId ? getMediaById(seo.openGraph.imageMediaId) : null,
    seo.twitter?.imageMediaId ? getMediaById(seo.twitter.imageMediaId) : null,
  ]);
  const preview = draft.isEnabled || Boolean(requestHeaders.get("x-iorder-builder-preview"));
  // Không có metadataBase (chưa cấu hình URL website) thì đường dẫn tương đối không có nghĩa.
  const url = input.canonicalUrl ?? (inherited.metadataBase ? input.path : undefined);
  const description = input.description ?? undefined;
  const title = withBrand(input.title);
  const ogTitle = seo.openGraph?.title || title;
  const ogDescription = seo.openGraph?.description || description;
  // Thứ tự ảnh chia sẻ: ảnh riêng của nội dung → ảnh mặc định của website (Cài đặt) → ảnh tự sinh theo tên trang
  // (cần metadataBase để thành URL tuyệt đối; chưa có URL website thì không tạo).
  const siteImages = config.defaultOgMediaId ? inherited.openGraph?.images : undefined;
  const generated = inherited.metadataBase ? [{ url: ogImagePath(seo.openGraph?.title || input.title), width: ogImageSize.width, height: ogImageSize.height, alt: ogTitle }] : undefined;
  const images = ogMedia?.mimeType.startsWith("image/") ? [{ url: ogMedia.url, alt: ogMedia.altText ?? ogTitle }] : input.image ? [{ url: input.image.url, alt: input.image.alt ?? input.title }] : siteImages ?? generated;
  const twitterImages = twitterMedia?.mimeType.startsWith("image/") ? [{ url: twitterMedia.url, alt: twitterMedia.altText ?? input.title }] : images;
  const common = { title: ogTitle, description: ogDescription, url, locale: "vi_VN", siteName: inherited.openGraph?.siteName ?? undefined, images };
  // modifiedTime không được trước publishedTime (dữ liệu nhập tay/nhập khẩu có thể lệch).
  const published = input.article?.publishedTime ?? undefined;
  const modified = input.article?.modifiedTime && (!published || input.article.modifiedTime >= published) ? input.article.modifiedTime : undefined;
  const openGraph: Metadata["openGraph"] = input.type === "article"
    ? { ...common, type: "article", publishedTime: published?.toISOString(), modifiedTime: modified?.toISOString(), section: input.article?.section ?? undefined, tags: input.article?.tags?.length ? [...input.article.tags] : undefined }
    : { ...common, type: "website" };
  return {
    title,
    description,
    authors: input.authors?.length ? input.authors.map((author) => ({ name: author.name, url: author.url ?? undefined })) : undefined,
    // alternates của trang thay toàn bộ alternates của layout, nên kế thừa liên kết RSS (types) từ `parent`.
    alternates: url || inherited.alternates?.types ? { canonical: url, types: inherited.alternates?.types ?? undefined } : undefined,
    robots: robotsDirectives(!preview && config.allowSearchIndexing && seo.index !== false, !preview && config.allowSearchIndexing && seo.follow !== false),
    openGraph,
    twitter: { card: seo.twitter?.card ?? (twitterImages?.length ? "summary_large_image" : "summary"), title: seo.twitter?.title || ogTitle, description: seo.twitter?.description || ogDescription, images: twitterImages },
  };
}
