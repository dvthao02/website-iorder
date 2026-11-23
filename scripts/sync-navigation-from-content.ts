import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { users } from "../packages/shared/src/db/schema";
import type { NavigationItems } from "../packages/shared/src/server/navigation/navigation.contract";
import { saveNavigation } from "../packages/shared/src/server/navigation/navigation.service";
import { listPublishedOfferings } from "../packages/shared/src/server/offerings/offerings.repository";
import { listCategories } from "../packages/shared/src/server/taxonomy/taxonomy.repository";

const catalogRoots = [
  { key: "software", label: "Phần mềm", url: "/software", type: "software" as const },
  { key: "solution", label: "Giải pháp", url: "/solutions", type: "solution" as const },
];

function item(key: string, label: string, url: string, parentKey: string | null = null): NavigationItems[number] {
  return { key, label, url, parentKey, linkType: "custom", contentId: null, target: "_self", isEnabled: true };
}

async function run() {
  const [author] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!author) throw new Error("Chưa có tài khoản quản trị để ghi nhận thay đổi menu.");

  const [catalogs, categories] = await Promise.all([
    Promise.all(catalogRoots.map(async root => ({ ...root, offerings: await listPublishedOfferings(root.type) }))),
    listCategories(),
  ]);

  const headerItems: NavigationItems = [];
  for (const catalog of catalogs) {
    headerItems.push(item(catalog.key, catalog.label, catalog.url));
    headerItems.push(...catalog.offerings.map(offering => item(`${catalog.key}-${offering.slug}`, offering.title, `${catalog.url}/${offering.slug}`, catalog.key)));
  }
  headerItems.push(
    item("equipment", "Thiết bị", "/equipment"),
    item("support", "Hỗ trợ", "/support/setup"),
    item("support-installation", "Hỗ trợ cài đặt", "/support/setup", "support"),
    item("support-faq", "Câu hỏi thường gặp", "/support/faq", "support"),
    item("support-videos", "Video hướng dẫn", "/support/videos", "support"),
    item("support-remote", "Hỗ trợ từ xa", "/support/remote", "support"),
    item("news", "Tin tức", "/news"),
    ...categories.map(category => item(`category-${category.slug}`, category.name, `/news/category/${category.slug}`, "news")),
    item("guides", "Hướng dẫn sử dụng", "/support/guides", "support"),
    item("consultation", "Tư vấn triển khai", "/contact"),
  );

  const footerItems: NavigationItems = [
    item("footer-products", "Sản phẩm & giải pháp", "/software"),
    item("footer-software", "Phần mềm", "/software", "footer-products"),
    item("footer-solutions", "Giải pháp", "/solutions", "footer-products"),
    item("footer-equipment", "Thiết bị", "/equipment", "footer-products"),
    item("footer-support", "Hỗ trợ", "/support/setup"),
    item("footer-installation", "Hỗ trợ cài đặt", "/support/setup", "footer-support"),
    item("footer-faq", "Câu hỏi thường gặp", "/support/faq", "footer-support"),
    item("footer-video", "Video hướng dẫn", "/support/videos", "footer-support"),
    item("footer-remote", "Hỗ trợ từ xa", "/support/remote", "footer-support"),
    item("footer-resources", "Tài nguyên", "/news"),
    item("footer-news", "Tin tức", "/news", "footer-resources"),
    item("footer-guides", "Hướng dẫn sử dụng", "/support/guides", "footer-support"),
    item("footer-about", "Về iOrder", "/about", "footer-resources"),
    item("footer-contact", "Liên hệ", "/contact", "footer-resources"),
    item("footer-terms", "Điều khoản dịch vụ", "/terms-of-use", "footer-resources"),
    item("footer-privacy", "Chính sách bảo mật", "/privacy-policy", "footer-resources"),
  ];

  await Promise.all([saveNavigation("header", headerItems, author.id), saveNavigation("footer", footerItems, author.id)]);
  console.log(`Đã đồng bộ ${headerItems.length} mục Header và ${footerItems.length} mục Footer từ nội dung CMS hiện có.`);
}

run().then(() => process.exit(0)).catch((error: unknown) => {
  console.error(error instanceof Error ? `Không thể đồng bộ menu CMS: ${error.message}` : "Không thể đồng bộ menu CMS.");
  process.exit(1);
});
