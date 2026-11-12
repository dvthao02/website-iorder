// Dữ liệu cấu trúc schema.org cho trang chi tiết: giúp Google hiểu loại nội dung và hiện breadcrumb.
// Chỉ dựng khi đã cấu hình URL website (schema.org cần URL tuyệt đối).

type Crumb = { name: string; path: string };

function absolute(siteUrl: string, path: string) {
  return new URL(path, siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).toString();
}

export function breadcrumbJsonLd(siteUrl: string, crumbs: readonly Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: absolute(siteUrl, crumb.path) })),
  };
}

export function articleJsonLd(siteUrl: string, input: { title: string; description: string | null; path: string; imagePath: string | null; publishedAt: Date | null; publisherName: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title.slice(0, 110),
    description: input.description ?? undefined,
    mainEntityOfPage: absolute(siteUrl, input.path),
    image: input.imagePath ? [absolute(siteUrl, input.imagePath)] : undefined,
    datePublished: input.publishedAt?.toISOString(),
    publisher: { "@type": "Organization", name: input.publisherName },
  };
}

// Thiết bị bán kèm (có giá) là Product; phần mềm/giải pháp/dịch vụ là Service vì không có giá cố định công khai.
export function productJsonLd(siteUrl: string, input: { name: string; description: string | null; path: string; imagePath: string | null; sku?: string | null; priceVnd?: number | null; brand: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description ?? undefined,
    image: input.imagePath ? [absolute(siteUrl, input.imagePath)] : undefined,
    sku: input.sku ?? undefined,
    brand: { "@type": "Brand", name: input.brand },
    offers: input.priceVnd ? { "@type": "Offer", priceCurrency: "VND", price: input.priceVnd, availability: "https://schema.org/InStock", url: absolute(siteUrl, input.path) } : undefined,
  };
}

export function serviceJsonLd(siteUrl: string, input: { name: string; description: string | null; path: string; imagePath: string | null; providerName: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description ?? undefined,
    url: absolute(siteUrl, input.path),
    image: input.imagePath ? absolute(siteUrl, input.imagePath) : undefined,
    provider: { "@type": "Organization", name: input.providerName },
  };
}

/** Chuỗi JSON an toàn để đặt trong <script type="application/ld+json">. */
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
