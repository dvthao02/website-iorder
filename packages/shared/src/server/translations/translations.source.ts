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
import { postGroupId, type TranslationGroupId } from "./translations.groups";
import { storedUiKey, uiMessageKeys, uiMessages } from "./ui-messages";

/** Một câu tiếng Việt cần dịch: khóa, nội dung, vài nơi dùng nó (để người dịch biết ngữ cảnh), tổng số nơi dùng và các vùng của website có dùng nó. */
export type SourceUnit = { key: string; text: string; places: string[]; uses: number; groups: TranslationGroupId[] };

const maxPlaces = 3;

/**
 * Gom mọi câu cần dịch trong nội dung đang công khai (cùng những nguồn mà route `/api/v1/public/content` trả cho website), theo thứ tự
 * chữ cố định của giao diện (khóa là tên, tiếng Việt lấy từ code) → thông tin chung → trang → phần mềm/giải pháp → thiết bị → bài viết → còn lại,
 * để file xuất đọc theo mạch nội dung.
 */
export async function collectSourceUnits(): Promise<Map<string, SourceUnit>> {
  const units = new Map<string, SourceUnit>();
  for (const key of uiMessageKeys) units.set(storedUiKey(key), { key: storedUiKey(key), text: uiMessages[key], places: ["Giao diện website"], uses: 1, groups: ["ui"] });
  const add = (scope: string, body: unknown, group: TranslationGroupId) => {
    mapTranslatable(body, (core, place) => {
      const key = sourceKey(core);
      const unit = units.get(key);
      if (!unit) { units.set(key, { key, text: core, places: [place], uses: 1, groups: [group] }); return undefined; }
      unit.uses += 1;
      if (unit.places.length < maxPlaces && !unit.places.includes(place)) unit.places.push(place);
      if (!unit.groups.includes(group)) unit.groups.push(group);
      return undefined;
    }, scope);
  };

  const [config, profile, externalLinks, consultPopup, catalogContent, listingContent, header, headerCta, footer] = await Promise.all([
    getPublishingConfig(), getSiteProfile(), getExternalLinks(), getConsultPopup(), getCatalogContent(), getListingContent(),
    getNavigation("header"), getNavigation("header_cta"), getNavigation("footer"),
  ]);
  add("shared.config", config, "site");
  add("shared.profile", profile, "site");
  add("shared.externalLinks", externalLinks, "site");
  add("shared.consultPopup", consultPopup, "site");
  add("shared.catalogContent", catalogContent, "site");
  add("shared.listingContent", listingContent, "site");
  add("navigation.header", header, "navigation");
  add("navigation.headerCta", headerCta, "navigation");
  add("navigation.footer", footer, "navigation");

  for (const summary of await getPublishedPageSummaries()) add(`page:${summary.slug}`, await getPublishedPage(summary.slug), "pages");

  for (const type of ["software", "solution"] as const) {
    for (const summary of await getPublishedOfferingSummaries(type)) add(`offering:${summary.slug}`, await getPublishedOfferingBySlug(type, summary.slug), type === "software" ? "software" : "solutions");
  }

  add("equipment", await getEquipment(true), "equipment");

  const posts = await getPublishedPostSummaries();
  for (const post of posts) {
    // Thẻ bài viết ở trang danh sách và nội dung bài cùng thuộc vùng của loại bài.
    add(`post-summary:${post.slug}`, post, postGroupId(post.type));
    add(`post:${post.slug}`, await getPublishedPostBySlug(post.slug), postGroupId(post.type));
  }

  add("taxonomy", await getTaxonomy(), "taxonomy");
  add("downloads", await getEnabledSupportDownloads(), "other");
  add("partners", await getPartners(true), "other");
  add("testimonials", await getTestimonials(true), "other");
  const authors = await getPublishedAuthorSummaries();
  add("author-summaries", authors, "other");
  for (const author of authors) add(`author:${author.slug}`, await getPublishedAuthorPage(author.slug), "other");

  return units;
}
