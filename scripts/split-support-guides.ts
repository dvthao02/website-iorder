import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { users } from "../packages/shared/src/db/schema";
import { getAdminNavigation, saveNavigation } from "../packages/shared/src/server/navigation/navigation.service";
import { getFixedWebsitePage, type AdminPage, type CollectionListData, type PageBlock } from "../packages/shared/src/server/pages/pages.contract";
import { getAdminPageBySlug, saveAdminPage } from "../packages/shared/src/server/pages/pages.service";

// Tách "Hướng dẫn sử dụng" khỏi trang "Hỗ trợ cài đặt" trên dữ liệu đã có:
// 1. Bỏ khối danh sách hướng dẫn khỏi /ho-tro/cai-dat (còn trong lịch sử phiên bản của trang).
// 2. Tạo trang danh sách /ho-tro/huong-dan nếu chưa có, giữ tiêu đề/mô tả của khối vừa bỏ.
// 3. Đổi liên kết menu "/ho-tro/cai-dat#huong-dan" thành "/ho-tro/huong-dan".
// Chạy lại nhiều lần an toàn: bước nào đã xong thì bỏ qua.
const legacyGuidesUrl = "/ho-tro/cai-dat#huong-dan";
const guidesUrl = "/ho-tro/huong-dan";

function pageValues(page: AdminPage, blocks: PageBlock[]) {
  const { title, slug, template, status, seoTitle, seoDescription, canonicalUrl, scheduledAt } = page;
  return { title, slug, template, status, seoTitle, seoDescription, canonicalUrl, scheduledAt, blocks };
}

function isGuidesList(block: PageBlock): block is Extract<PageBlock, { type: "collection_list" }> {
  return block.type === "collection_list" && block.data.source === "guides";
}

async function splitSupportPage(userId: string): Promise<CollectionListData | undefined> {
  const page = await getAdminPageBySlug("listing-support");
  const guides = page?.blocks.find(isGuidesList);
  if (!page || !guides) return undefined;
  // Trang chỉ còn một danh sách: bỏ mã neo/tiêu đề phụ "Tệp cài đặt" dư thừa thì để người vận hành tự quyết trong CMS.
  await saveAdminPage(page.id, pageValues(page, page.blocks.filter(block => !isGuidesList(block))), userId, { expectedVersion: page.draftVersion });
  console.log("Đã bỏ danh sách hướng dẫn khỏi /ho-tro/cai-dat.");
  return guides.data;
}

async function createGuidesPage(userId: string, previous: CollectionListData | undefined) {
  if (await getAdminPageBySlug("listing-guides")) return;
  const fixedPage = getFixedWebsitePage("listing-guides")!;
  await saveAdminPage(null, {
    title: fixedPage.label,
    slug: fixedPage.slug,
    template: fixedPage.template,
    status: "published",
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    scheduledAt: null,
    blocks: [
      { type: "hero", isEnabled: true, data: { eyebrow: previous?.eyebrow ?? "Trung tâm trợ giúp", title: previous?.title ?? fixedPage.label, description: previous?.description ?? null, primaryAction: null, secondaryAction: null } },
      { type: "collection_list", isEnabled: true, data: { source: "guides", eyebrow: null, title: null, description: null, limit: null, anchor: null } },
    ],
  }, userId, { allowFixedPageCreation: true });
  console.log(`Đã tạo trang danh sách ${fixedPage.publicPath}.`);
}

async function updateNavigationLinks(userId: string) {
  for (const location of ["header", "footer"] as const) {
    const document = await getAdminNavigation(location);
    if (!document.id || !document.items.some(item => item.url === legacyGuidesUrl)) continue;
    const items = document.items.map(item => item.url === legacyGuidesUrl ? { ...item, url: guidesUrl } : item);
    await saveNavigation(location, items, userId, { expectedVersion: document.version, changeNote: "Tách Hướng dẫn sử dụng thành trang riêng" });
    console.log(`Đã đổi liên kết Hướng dẫn sử dụng trong menu ${location}.`);
  }
}

async function run() {
  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị (INITIAL_ADMIN_USERNAME) để ghi nhận thay đổi.");
  const previous = await splitSupportPage(user.id);
  await createGuidesPage(user.id, previous);
  await updateNavigationLinks(user.id);
  console.log("Hoàn tất tách Hướng dẫn sử dụng khỏi Hỗ trợ cài đặt.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể tách trang Hướng dẫn sử dụng.");
  process.exit(1);
});
