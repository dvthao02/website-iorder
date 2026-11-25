import { getPublishedAuthorPage, getPublishedAuthorSummaries } from "../authors/authors.service";
import { getEquipment } from "../equipment/equipment.service";
import { getNavigation } from "../navigation/navigation.service";
import { getPublishedOfferingBySlug, getPublishedOfferingSummaries } from "../offerings/offerings.service";
import { getPublishedPage, getPublishedPageSummaries } from "../pages/pages.service";
import { getPublishedPostBySlug, getPublishedPostSummaries } from "../posts/posts.service";
import { getCatalogContent } from "../settings/catalog-content.service";
import { getConsultPopup } from "../settings/consult-popup.service";
import { getExternalLinks } from "../settings/external-links.service";
import { getListingContent } from "../settings/listing-content.service";
import { getSiteProfile } from "../settings/profile.service";
import { getPublishingConfig } from "../settings/publishing.service";
import { getEnabledSupportDownloads } from "../support/support-downloads.service";
import { getPartners, getTestimonials } from "../supporting/supporting.service";
import { getTaxonomy } from "../taxonomy/taxonomy.service";
import { mapTranslatable, sourceKey } from "./translatable";
import { storedUiKey, uiMessageKeys, uiMessages } from "./ui-messages";

/** Một câu tiếng Việt cần dịch: khóa, nội dung và vài nơi dùng nó (để người dịch biết ngữ cảnh). */
export type SourceUnit = { key: string; text: string; places: string[] };

const maxPlaces = 3;

/**
 * Gom mọi câu cần dịch trong nội dung đang công khai (cùng những nguồn mà route `/api/v1/public/content` trả cho website), theo thứ tự
 * chữ cố định của giao diện (khóa là tên, tiếng Việt lấy từ code) → thông tin chung → trang → phần mềm/giải pháp → thiết bị → bài viết → còn lại,
 * để file xuất đọc theo mạch nội dung.
 */
export async function collectSourceUnits(): Promise<Map<string, SourceUnit>> {
  const units = new Map<string, SourceUnit>();
  for (const key of uiMessageKeys) units.set(storedUiKey(key), { key: storedUiKey(key), text: uiMessages[key], places: ["Giao diện website"] });
  const add = (scope: string, body: unknown) => {
    mapTranslatable(body, (core, place) => {
      const key = sourceKey(core);
      const unit = units.get(key);
      if (!unit) units.set(key, { key, text: core, places: [place] });
      else if (unit.places.length < maxPlaces && !unit.places.includes(place)) unit.places.push(place);
      return undefined;
    }, scope);
  };

  const [config, profile, externalLinks, consultPopup, catalogContent, listingContent, header, headerCta, footer] = await Promise.all([
    getPublishingConfig(), getSiteProfile(), getExternalLinks(), getConsultPopup(), getCatalogContent(), getListingContent(),
    getNavigation("header"), getNavigation("header_cta"), getNavigation("footer"),
  ]);
  add("shared.config", config);
  add("shared.profile", profile);
  add("shared.externalLinks", externalLinks);
  add("shared.consultPopup", consultPopup);
  add("shared.catalogContent", catalogContent);
  add("shared.listingContent", listingContent);
  add("navigation.header", header);
  add("navigation.headerCta", headerCta);
  add("navigation.footer", footer);

  for (const summary of await getPublishedPageSummaries()) add(`page:${summary.slug}`, await getPublishedPage(summary.slug));

  for (const type of ["software", "solution"] as const) {
    for (const summary of await getPublishedOfferingSummaries(type)) add(`offering:${summary.slug}`, await getPublishedOfferingBySlug(type, summary.slug));
  }

  add("equipment", await getEquipment(true));

  const posts = await getPublishedPostSummaries();
  add("post-summaries", posts);
  for (const post of posts) add(`post:${post.slug}`, await getPublishedPostBySlug(post.slug));

  add("taxonomy", await getTaxonomy());
  add("downloads", await getEnabledSupportDownloads());
  add("partners", await getPartners(true));
  add("testimonials", await getTestimonials(true));
  const authors = await getPublishedAuthorSummaries();
  add("author-summaries", authors);
  for (const author of authors) add(`author:${author.slug}`, await getPublishedAuthorPage(author.slug));

  return units;
}
