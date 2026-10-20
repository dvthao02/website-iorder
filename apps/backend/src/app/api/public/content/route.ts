import { NextResponse } from "next/server";
import { z } from "zod";

import { getEquipment } from "@iorder/core/server/equipment/equipment.service";
import { getNavigation } from "@iorder/core/server/navigation/navigation.service";
import { getPublishedOfferingBySlug, getPublishedOfferingSummaries } from "@iorder/core/server/offerings/offerings.service";
import { getPublishedPage, getPublishedPageSummaries, systemPageExists } from "@iorder/core/server/pages/pages.service";
import { getPublishedPostBySlug, getPublishedPostsByTaxonomy, getPublishedPostSummaries } from "@iorder/core/server/posts/posts.service";
import { getCatalogContent } from "@iorder/core/server/settings/catalog-content.service";
import { getExternalLinks } from "@iorder/core/server/settings/external-links.service";
import { getListingContent } from "@iorder/core/server/settings/listing-content.service";
import { getPublishingConfig } from "@iorder/core/server/settings/publishing.service";
import { getSiteProfile } from "@iorder/core/server/settings/profile.service";
import { getEnabledSupportDownloads } from "@iorder/core/server/support/support-downloads.service";
import { getPartners, getTestimonials } from "@iorder/core/server/supporting/supporting.service";
import { getTaxonomy } from "@iorder/core/server/taxonomy/taxonomy.service";
import { logger } from "@iorder/core/server/shared/logger";
import { verifyPreviewToken } from "@iorder/core/server/publishing/preview-token";

export const runtime = "nodejs";

const resourceSchema = z.enum([
  "shared", "page", "page-summaries", "post", "post-summaries", "post-taxonomy",
  "taxonomy", "offering", "offering-summaries", "equipment", "downloads", "partners", "testimonials",
]);
const offeringTypeSchema = z.enum(["software", "solution", "service"]);
const postTypeSchema = z.enum(["announcement", "case_study", "guide", "news", "promotion"]);

function invalidRequest(message: string) {
  return NextResponse.json({ error: { code: "INVALID_INPUT", message } }, { status: 400 });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const resource = resourceSchema.safeParse(query.get("resource") ?? "shared");
  if (!resource.success) return invalidRequest("Loại nội dung public không hợp lệ.");

  const slug = query.get("slug")?.trim();
  const postType = query.get("postType") ? postTypeSchema.safeParse(query.get("postType")) : undefined;
  const offeringType = query.get("offeringType") ? offeringTypeSchema.safeParse(query.get("offeringType")) : undefined;
  if (postType && !postType.success) return invalidRequest("Loại bài viết không hợp lệ.");
  if (offeringType && !offeringType.success) return invalidRequest("Loại catalog không hợp lệ.");
  // Xem trước bản nháp: token hợp lệ chỉ mở đúng một nội dung (loại + id); phản hồi không được cache.
  const preview = verifyPreviewToken(query.get("preview"));
  const previewId = (kind: "post" | "page" | "offering") => preview?.kind === kind ? preview.id : undefined;
  const respond = (body: unknown) => NextResponse.json(body, preview ? { headers: { "cache-control": "private, no-store" } } : undefined);

  try {
    switch (resource.data) {
      case "shared": {
        const [config, profile, externalLinks, catalogContent, listingContent, header, headerCta, footer] = await Promise.all([
          getPublishingConfig(), getSiteProfile(), getExternalLinks(), getCatalogContent(), getListingContent(),
          getNavigation("header"), getNavigation("header_cta"), getNavigation("footer"),
        ]);
        return NextResponse.json({ settings: { config, profile, externalLinks, catalogContent, listingContent }, navigation: { header, headerCta, footer } });
      }
      case "page":
        if (!slug) return invalidRequest("Cần slug trang.");
        {
          const page = (previewId("page") ? await getPublishedPage(slug, previewId("page")) : undefined) ?? await getPublishedPage(slug) ?? null;
          // Chỉ báo "đã tồn tại nhưng chưa xuất bản" cho slug hệ thống (đã công khai trong code), không dò slug tùy ý.
          return respond({ page, systemPageExists: page ? true : await systemPageExists(slug) });
        }
      case "page-summaries":
        return NextResponse.json({ pages: await getPublishedPageSummaries() });
      case "post":
        if (!slug) return invalidRequest("Cần slug bài viết.");
        return respond({ post: (previewId("post") ? await getPublishedPostBySlug(slug, previewId("post")) : undefined) ?? await getPublishedPostBySlug(slug) ?? null });
      case "post-summaries":
        return NextResponse.json({ posts: await getPublishedPostSummaries(postType?.data) });
      case "post-taxonomy": {
        if (!slug) return invalidRequest("Cần slug phân loại bài viết.");
        const kind = z.enum(["category", "tag"]).safeParse(query.get("taxonomyKind"));
        if (!kind.success) return invalidRequest("Loại phân loại bài viết không hợp lệ.");
        return NextResponse.json({ posts: await getPublishedPostsByTaxonomy(kind.data, slug) });
      }
      case "taxonomy":
        return NextResponse.json({ taxonomy: await getTaxonomy() });
      case "offering":
        if (!slug || !offeringType?.success) return invalidRequest("Cần loại và slug nội dung catalog.");
        return respond({ offering: (previewId("offering") ? await getPublishedOfferingBySlug(offeringType.data, slug, previewId("offering")) : undefined) ?? await getPublishedOfferingBySlug(offeringType.data, slug) ?? null });
      case "offering-summaries":
        if (!offeringType?.success) return invalidRequest("Cần loại nội dung catalog.");
        return NextResponse.json({ offerings: await getPublishedOfferingSummaries(offeringType.data) });
      case "equipment":
        return NextResponse.json({ equipment: await getEquipment(true) });
      case "downloads":
        return NextResponse.json({ downloads: await getEnabledSupportDownloads() });
      case "partners":
        return NextResponse.json({ partners: await getPartners(true) });
      case "testimonials":
        return NextResponse.json({ testimonials: await getTestimonials(true) });
    }
  } catch (error) {
    logger.error("Đọc nội dung public thất bại.", { request, resource: resource.data, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải nội dung website lúc này." } }, { status: 500 });
  }
}
