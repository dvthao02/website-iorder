import { equipmentAvailabilitySchemaOrg, type EquipmentAvailability } from "@iorder/shared/server/equipment/equipment-availability";

// Dữ liệu cấu trúc schema.org cho trang chi tiết: giúp Google hiểu loại nội dung và hiện breadcrumb.
// Chỉ dựng khi đã cấu hình URL website (schema.org cần URL tuyệt đối).

type Crumb = { name: string; path: string };

function absolute(siteUrl: string, path: string) {
  return new URL(path, siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).toString();
}

/** Mã nút của tổ chức và website: mọi trang tham chiếu về cùng một thực thể để Google gom nhận diện thương hiệu về một chỗ. */
export function organizationId(siteUrl: string) { return `${absolute(siteUrl, "/")}#organization`; }
export function websiteId(siteUrl: string) { return `${absolute(siteUrl, "/")}#website`; }

export const siteLanguage = "vi-VN";

export type WebPageKind = "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage";

// Loại trang theo trang hệ thống: Giới thiệu/Liên hệ/danh sách có loại riêng để Google và công cụ AI hiểu vai trò của trang.
export function webPageKindOf(slug: string, kind?: string): WebPageKind {
  if (slug === "about") return "AboutPage";
  if (slug === "contact") return "ContactPage";
  return kind === "listing" ? "CollectionPage" : "WebPage";
}

/** Nút WebPage của một trang: thuộc về WebSite chung (`isPartOf`), có ngôn ngữ và ngày sửa gần nhất. */
export function webPageJsonLd(siteUrl: string, input: { kind?: WebPageKind; name: string; description: string | null; path: string; modifiedAt?: Date | null }) {
  const url = absolute(siteUrl, input.path);
  const kind = input.kind ?? "WebPage";
  return {
    "@context": "https://schema.org",
    "@type": kind,
    "@id": `${url}#webpage`,
    url,
    name: input.name,
    description: input.description ?? undefined,
    inLanguage: siteLanguage,
    isPartOf: { "@id": websiteId(siteUrl) },
    about: kind === "AboutPage" ? { "@id": organizationId(siteUrl) } : undefined,
    dateModified: input.modifiedAt && !Number.isNaN(input.modifiedAt.getTime()) ? input.modifiedAt.toISOString() : undefined,
  };
}

export type FaqItem = { question: string; answer: string };

/** Giới hạn của Google: câu hỏi và câu trả lời phải hiện trên trang; mục rỗng/đã tắt bị bỏ. Không có mục nào thì không dựng. */
export function faqPageJsonLd(siteUrl: string, path: string, items: readonly (FaqItem & { isEnabled?: boolean })[]) {
  const questions = items.filter((item) => item.isEnabled !== false && item.question.trim() && item.answer.trim());
  if (!questions.length) return null;
  const url = absolute(siteUrl, path);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    url,
    inLanguage: siteLanguage,
    mainEntity: questions.map((item) => ({ "@type": "Question", name: item.question.trim(), acceptedAnswer: { "@type": "Answer", text: item.answer.trim() } })),
  };
}

/** Câu hỏi thường gặp trong các khối FAQ đang bật của trang (mục đã tắt cũng bị bỏ, giống phần hiển thị). */
export function faqItemsOfBlocks(blocks: readonly { type: string; data: unknown; isEnabled?: boolean }[]): FaqItem[] {
  return blocks.flatMap((block) => {
    if (block.type !== "faq" || block.isEnabled === false) return [];
    const items = (block.data as { items?: unknown } | null)?.items;
    return Array.isArray(items) ? items.filter((item): item is FaqItem & { isEnabled?: boolean } => typeof item?.question === "string" && typeof item?.answer === "string" && item.isEnabled !== false) : [];
  });
}

/** Trang tác giả: ProfilePage có thực thể Person là nội dung chính (Google dùng để hiểu đây là hồ sơ một người thật). */
export function profilePageJsonLd(siteUrl: string, input: { name: string; jobTitle: string | null; bio: string | null; path: string; avatarPath: string | null; profileUrl: string | null; modifiedAt?: Date | null }) {
  const url = absolute(siteUrl, input.path);
  const profile = input.profileUrl?.trim() || undefined;
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${url}#profilepage`,
    url,
    name: `${input.name} – Tác giả`,
    inLanguage: siteLanguage,
    isPartOf: { "@id": websiteId(siteUrl) },
    dateModified: input.modifiedAt && !Number.isNaN(input.modifiedAt.getTime()) ? input.modifiedAt.toISOString() : undefined,
    mainEntity: { "@type": "Person", "@id": `${url}#person`, name: input.name, jobTitle: input.jobTitle?.trim() || undefined, description: input.bio?.trim() || undefined, image: input.avatarPath ? absolute(siteUrl, input.avatarPath) : undefined, url, sameAs: profile ? [profile] : undefined },
  };
}

export function breadcrumbJsonLd(siteUrl: string, crumbs: readonly Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: absolute(siteUrl, crumb.path) })),
  };
}

// pagePath: trang riêng của tác giả trên website (nếu có); profileUrl: hồ sơ ngoài. Có trang riêng thì Person có @id/url trỏ về đó và hồ sơ ngoài là sameAs.
export type ArticleAuthor = { name: string; jobTitle?: string | null; pagePath?: string | null; profileUrl?: string | null };

function personNode(siteUrl: string, author: ArticleAuthor) {
  const page = author.pagePath ? absolute(siteUrl, author.pagePath) : undefined;
  const profile = author.profileUrl?.trim() || undefined;
  return { "@type": "Person", "@id": page ? `${page}#person` : undefined, name: author.name.trim(), jobTitle: author.jobTitle?.trim() || undefined, url: page ?? profile, sameAs: page && profile ? [profile] : undefined };
}

export function articleJsonLd(siteUrl: string, input: { title: string; description: string | null; path: string; imagePath: string | null; publishedAt: Date | null; modifiedAt?: Date | null; section?: string | null; keywords?: readonly string[]; publisherName: string; author?: ArticleAuthor | null }) {
  const url = absolute(siteUrl, input.path);
  const organization = { "@type": "Organization", "@id": organizationId(siteUrl), name: input.publisherName };
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.title.slice(0, 110),
    description: input.description ?? undefined,
    mainEntityOfPage: url,
    url,
    inLanguage: siteLanguage,
    image: input.imagePath ? [absolute(siteUrl, input.imagePath)] : undefined,
    datePublished: input.publishedAt?.toISOString(),
    // Google dùng dateModified để biết bài còn mới; chỉ gửi khi có và không trước ngày xuất bản.
    dateModified: input.modifiedAt && (!input.publishedAt || input.modifiedAt >= input.publishedAt) ? input.modifiedAt.toISOString() : undefined,
    articleSection: input.section ?? undefined,
    keywords: input.keywords?.length ? input.keywords.join(", ") : undefined,
    // Có tác giả thật (CMS) thì là Person kèm chức danh và trang cá nhân; không có thì tác giả là tổ chức như trước. Nhà xuất bản luôn là tổ chức.
    author: input.author?.name.trim() ? personNode(siteUrl, input.author) : organization,
    publisher: organization,
  };
}

// Thiết bị bán kèm (có giá) là Product; phần mềm/giải pháp/dịch vụ là Service vì không có giá cố định công khai.
export function productJsonLd(siteUrl: string, input: { name: string; description: string | null; path: string; imagePath: string | null; sku?: string | null; priceVnd?: number | null; brand?: string | null; availability?: EquipmentAvailability | null }) {
  const url = absolute(siteUrl, input.path);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: input.name,
    description: input.description ?? undefined,
    url,
    image: input.imagePath ? [absolute(siteUrl, input.imagePath)] : undefined,
    sku: input.sku ?? undefined,
    // Không đoán thương hiệu: thiết bị của hãng khác (Sunmi, Datamax…) khai là thương hiệu của iOrder là sai dữ liệu cấu trúc.
    brand: input.brand ? { "@type": "Brand", name: input.brand } : undefined,
    offers: input.priceVnd ? { "@type": "Offer", priceCurrency: "VND", price: input.priceVnd, availability: equipmentAvailabilitySchemaOrg[input.availability ?? "in_stock"], itemCondition: "https://schema.org/NewCondition", url, seller: { "@id": organizationId(siteUrl) } } : undefined,
  };
}

export function serviceJsonLd(siteUrl: string, input: { name: string; description: string | null; path: string; imagePath: string | null; providerName: string }) {
  const url = absolute(siteUrl, input.path);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: input.name,
    description: input.description ?? undefined,
    url,
    inLanguage: siteLanguage,
    image: input.imagePath ? absolute(siteUrl, input.imagePath) : undefined,
    provider: { "@type": "Organization", "@id": organizationId(siteUrl), name: input.providerName },
  };
}

/**
 * Giá thấp nhất (VND) đọc được từ bảng giá: chỉ lấy khi chữ giá là số rõ ràng ("199.000đ", "Từ 1.200.000 ₫"), bỏ qua "Liên hệ"/"Miễn phí"/gói đã tắt.
 * Không đoán: giá sai trong schema bị Google coi là thông tin gây hiểu lầm, nên không đọc được thì trả về null và không đưa `offers`.
 */
export function lowestPlanPriceVnd(plans: readonly { price: string; isEnabled?: boolean }[] | null | undefined): number | null {
  const prices = (plans ?? []).filter((plan) => plan.isEnabled !== false).flatMap((plan) => {
    const match = plan.price.replace(/\s/g, "").match(/(\d{1,3}(?:[.,]\d{3})+|\d+)(?:đ|₫|vnd|vnđ|\/|$)/i);
    const value = match ? Number(match[1].replace(/[.,]/g, "")) : NaN;
    return Number.isFinite(value) && value >= 1000 ? [value] : [];
  });
  return prices.length ? Math.min(...prices) : null;
}

/**
 * Trang Phần mềm: SoftwareApplication (Google hiểu đây là ứng dụng, đủ điều kiện kết quả nổi bật phần mềm).
 * Chỉ khai những gì có thật: giá khi đọc được từ bảng giá; KHÔNG tự thêm đánh giá sao (aggregateRating) vì cần đánh giá thật của khách.
 */
export function softwareApplicationJsonLd(siteUrl: string, input: { name: string; description: string | null; path: string; imagePath: string | null; publisherName: string; category?: string | null; operatingSystem?: string; priceVnd?: number | null }) {
  const url = absolute(siteUrl, input.path);
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name: input.name,
    description: input.description ?? undefined,
    url,
    inLanguage: siteLanguage,
    image: input.imagePath ? absolute(siteUrl, input.imagePath) : undefined,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: input.category?.trim() || undefined,
    operatingSystem: input.operatingSystem ?? "Web, Android, iOS, Windows",
    publisher: { "@type": "Organization", "@id": organizationId(siteUrl), name: input.publisherName },
    offers: input.priceVnd ? { "@type": "Offer", priceCurrency: "VND", price: input.priceVnd, availability: "https://schema.org/InStock", url } : undefined,
  };
}

/** Chuỗi JSON an toàn để đặt trong <script type="application/ld+json">. */
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
