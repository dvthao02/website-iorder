import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { pages, users } from "../packages/core/src/db/schema";
import { defaultListingCollections, fixedWebsitePages, type CollectionListData, type ListingHeader, type ListingPageSlug, type PageBlock } from "../packages/core/src/server/pages/pages.contract";
import { saveAdminPage } from "../packages/core/src/server/pages/pages.service";
import { getCatalogContent } from "../packages/core/src/server/settings/catalog-content.service";
import { getListingContent } from "../packages/core/src/server/settings/listing-content.service";

// Chuyển tiêu đề trang danh sách từ site_settings (listing_content, catalog_content) sang
// Trang hệ thống trong "Trang website". Chạy lại nhiều lần an toàn: trang đã có thì giữ nguyên.
async function legacyContent() {
  const [listing, catalog] = await Promise.all([getListingContent(), getCatalogContent()]);
  const headers: Partial<Record<ListingPageSlug, ListingHeader>> = {
    "listing-news": listing?.news,
    "listing-equipment": listing?.equipment,
    "listing-support": listing?.support,
    "listing-software": catalog?.software,
    "listing-solution": catalog?.solution,
    "listing-service": catalog?.service,
  };
  return { headers, guides: listing?.guides };
}

// Khối danh sách tường minh để người vận hành thấy và sắp xếp được ngay trong editor.
function collectionBlocks(slug: ListingPageSlug, guides: ListingHeader | undefined): PageBlock[] {
  return defaultListingCollections[slug].map((data): PageBlock => {
    const withLegacy: CollectionListData = data.source === "guides" && guides ? { ...data, eyebrow: guides.eyebrow || null, title: guides.title, description: guides.description } : data;
    return { type: "collection_list", isEnabled: true, data: withLegacy };
  });
}

async function run() {
  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị (INITIAL_ADMIN_USERNAME) để tạo trang danh sách.");

  const { headers, guides } = await legacyContent();
  let created = 0;
  const conflicts: string[] = [];
  for (const fixedPage of fixedWebsitePages) {
    if (fixedPage.kind !== "listing") continue;
    const [existing] = await getDb().select({ id: pages.id, template: pages.template }).from(pages).where(eq(pages.slug, fixedPage.slug)).limit(1);
    // Slug hệ thống đang bị một trang thường chiếm: không tự sửa dữ liệu, báo để người vận hành đổi slug trang đó.
    if (existing && existing.template !== fixedPage.template) { conflicts.push(`${fixedPage.slug} (đang là trang template "${existing.template}", id ${existing.id})`); continue; }
    if (existing) continue;
    const header = headers[fixedPage.slug] ?? { eyebrow: null, title: fixedPage.label, description: null };
    await saveAdminPage(null, {
      title: fixedPage.label,
      slug: fixedPage.slug,
      template: fixedPage.template,
      status: "published",
      seoTitle: null,
      seoDescription: null,
      canonicalUrl: null,
      scheduledAt: null,
      blocks: [{ type: "hero", isEnabled: true, data: { eyebrow: header.eyebrow || null, title: header.title, description: header.description, primaryAction: null, secondaryAction: null } }, ...collectionBlocks(fixedPage.slug, guides)],
    }, user.id, { allowFixedPageCreation: true });
    created += 1;
    console.log(`Đã tạo trang danh sách ${fixedPage.publicPath} từ ${headers[fixedPage.slug] ? "cấu hình cũ" : "giá trị mặc định"}.`);
  }
  console.log(created ? `Hoàn tất: tạo ${created} trang danh sách.` : "Các trang danh sách đã tồn tại; giữ nguyên dữ liệu CMS.");
  if (conflicts.length) throw new Error(`Slug trang danh sách đang bị trang khác dùng: ${conflicts.join("; ")}. Đổi slug các trang đó trong CMS rồi chạy lại.`);
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể tạo trang danh sách.");
  process.exit(1);
});
