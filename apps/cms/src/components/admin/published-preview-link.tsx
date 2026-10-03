import Link from "next/link";

type PublishedPreviewLinkProps = {
  kind: "page" | "post" | "offering" | "equipment";
  status: string | undefined;
  slug: string | undefined;
  contentType?: string | undefined;
};

const pagePaths: Record<string, string> = {
  about: "/gioi-thieu",
  contact: "/lien-he",
  home: "/",
  "privacy-policy": "/privacy-policy",
  "remote-support": "/ho-tro-tu-xa",
  "support-faq": "/ho-tro/faq",
  "support-videos": "/ho-tro/video",
  terms: "/terms",
};

const offeringCatalogPaths: Record<string, string> = {
  software: "/phan-mem",
  solution: "/giai-phap",
  service: "/dich-vu",
};

function getPublicPath({
  kind,
  slug,
  contentType,
}: Omit<PublishedPreviewLinkProps, "status">) {
  if (!slug) return null;

  if (kind === "page") {
    return pagePaths[slug] ?? `/trang/${slug}`;
  }

  if (kind === "post") {
    return contentType === "guide"
      ? `/ho-tro/cai-dat/${slug}`
      : `/tin-tuc/${slug}`;
  }

  if (kind === "equipment") {
    return `/thiet-bi/${slug}`;
  }

  const catalogPath = contentType
    ? offeringCatalogPaths[contentType]
    : undefined;

  return catalogPath ? `${catalogPath}/${slug}` : null;
}

export function PublishedPreviewLink({
  kind,
  status,
  slug,
  contentType,
}: PublishedPreviewLinkProps) {
  if (status !== "published") return null;

  const href = getPublicPath({
    kind,
    slug,
    contentType,
  });

  if (!href) return null;

  return (
   <Link
  className="published-preview-link"
  href={href}
  rel="noreferrer"
  target="_blank"
>
  Mở trang đã xuất bản ↗
</Link>)
}