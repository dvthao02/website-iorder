import { getFixedWebsitePage } from "@iorder/core/server/pages/pages.contract";
import { publishedPublicUrl } from "@/lib/published-public-url";

type PublishedPreviewLinkProps = {
  kind: "page" | "post" | "offering" | "equipment";
  status: string | undefined;
  slug: string | undefined;
  contentType?: string | undefined;
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
    return getFixedWebsitePage(slug)?.publicPath ?? `/trang/${slug}`;
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

  const path = getPublicPath({
    kind,
    slug,
    contentType,
  });

  if (!path) return null;

  const href = publishedPublicUrl(path);

  return (
   <a
  className="published-preview-link"
  href={href}
  rel="noreferrer"
  target="_blank"
>
  Mở trang đã xuất bản ↗
</a>)
}
