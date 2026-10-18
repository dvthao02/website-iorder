import type { Metadata, ResolvingMetadata } from "next";

type ContentMetadataInput = {
  title: string;
  description?: string | null;
  /** Đường dẫn public của trang, dùng làm canonical mặc định. */
  path: string;
  /** Canonical do người vận hành nhập trong CMS (ưu tiên hơn đường dẫn trang). */
  canonicalUrl?: string | null;
  image?: { url: string; alt?: string | null } | null;
  type?: "website" | "article";
};

// Metadata của một trang nội dung: canonical trỏ về chính trang (hoặc canonical CMS) và
// Open Graph riêng. Metadata được merge nông, nên openGraph ở đây thay toàn bộ openGraph của
// layout: lấy ảnh và tên site mặc định từ `parent` để không mất khi trang không có ảnh riêng.
export async function contentMetadata(input: ContentMetadataInput, parent: ResolvingMetadata): Promise<Metadata> {
  const inherited = await parent;
  // Không có metadataBase (chưa cấu hình URL website) thì đường dẫn tương đối không có nghĩa.
  const url = input.canonicalUrl ?? (inherited.metadataBase ? input.path : undefined);
  const description = input.description ?? undefined;
  return {
    title: input.title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title: input.title,
      description,
      url,
      type: input.type ?? "website",
      siteName: inherited.openGraph?.siteName ?? undefined,
      images: input.image ? [{ url: input.image.url, alt: input.image.alt ?? input.title }] : inherited.openGraph?.images,
    },
  };
}
