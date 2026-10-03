import { NextResponse } from "next/server";

import { getEquipment } from "@iorder/core/server/equipment/equipment.service";
import { getNavigation } from "@iorder/core/server/navigation/navigation.service";
import { getPublishedOfferingBySlug, getPublishedOfferingSummaries } from "@iorder/core/server/offerings/offerings.service";
import { getPublishedPage, getPublishedPageSummaries } from "@iorder/core/server/pages/pages.service";
import { getPublishedPostBySlug, getPublishedPostSummaries } from "@iorder/core/server/posts/posts.service";
import { getCatalogContent } from "@iorder/core/server/settings/catalog-content.service";
import { getExternalLinks } from "@iorder/core/server/settings/external-links.service";
import { getListingContent } from "@iorder/core/server/settings/listing-content.service";
import { getSiteProfile } from "@iorder/core/server/settings/profile.service";
import { getPublishingConfig } from "@iorder/core/server/settings/publishing.service";
import { getEnabledSupportDownloads } from "@iorder/core/server/support/support-downloads.service";
import { getPartners, getTestimonials } from "@iorder/core/server/supporting/supporting.service";
import { getTaxonomy } from "@iorder/core/server/taxonomy/taxonomy.service";

export const runtime = "nodejs";

// A read-only snapshot keeps public rendering independent from PostgreSQL while
// allowing the web image to make one internal request per render.
export async function GET() {
  const [config, profile, externalLinks, catalogContent, listingContent, header, headerCta, footer, pageSummaries, posts, equipment, taxonomy, downloads, partners, testimonials, software, solution, service] = await Promise.all([
    getPublishingConfig(), getSiteProfile(), getExternalLinks(), getCatalogContent(), getListingContent(),
    getNavigation("header"), getNavigation("header_cta"), getNavigation("footer"), getPublishedPageSummaries(),
    getPublishedPostSummaries(), getEquipment(true), getTaxonomy(), getEnabledSupportDownloads(), getPartners(true), getTestimonials(true),
    getPublishedOfferingSummaries("software"), getPublishedOfferingSummaries("solution"), getPublishedOfferingSummaries("service"),
  ]);

  const [pages, postDetails, softwareDetails, solutionDetails, serviceDetails] = await Promise.all([
    Promise.all(pageSummaries.map((page) => getPublishedPage(page.slug))),
    Promise.all(posts.map((post) => getPublishedPostBySlug(post.slug))),
    Promise.all(software.map((offering) => getPublishedOfferingBySlug("software", offering.slug))),
    Promise.all(solution.map((offering) => getPublishedOfferingBySlug("solution", offering.slug))),
    Promise.all(service.map((offering) => getPublishedOfferingBySlug("service", offering.slug))),
  ]);

  return NextResponse.json({
    settings: { config, profile, externalLinks, catalogContent, listingContent },
    navigation: { header, headerCta, footer },
    pages: pages.filter(Boolean),
    pageSummaries,
    posts: postDetails.filter(Boolean),
    postSummaries: posts,
    equipment,
    taxonomy,
    downloads,
    partners,
    testimonials,
    offerings: { software: softwareDetails.filter(Boolean), solution: solutionDetails.filter(Boolean), service: serviceDetails.filter(Boolean) },
  });
}
