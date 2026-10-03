import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { users } from "../packages/core/src/db/schema";
import type { NavigationItems } from "../packages/core/src/server/navigation/navigation.contract";
import { saveNavigation } from "../packages/core/src/server/navigation/navigation.service";
import { listPublishedOfferings } from "../packages/core/src/server/offerings/offerings.repository";
import { listCategories } from "../packages/core/src/server/taxonomy/taxonomy.repository";

const catalogRoots = [
  { key: "software", label: "Phần mềm", url: "/phan-mem", type: "software" as const },
  { key: "solution", label: "Giải pháp", url: "/giai-phap", type: "solution" as const },
  { key: "service", label: "Dịch vụ", url: "/dich-vu", type: "service" as const },
];

function item(key: string, label: string, url: string, parentKey: string | null = null): NavigationItems[number] {
  return { key, label, url, parentKey, target: "_self", isEnabled: true };
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
    item("equipment", "Thiết bị", "/thiet-bi"),
    item("support", "Hỗ trợ", "/ho-tro/cai-dat"),
    item("support-installation", "Hỗ trợ cài đặt", "/ho-tro/cai-dat", "support"),
    item("support-faq", "Câu hỏi thường gặp", "/ho-tro/faq", "support"),
    item("support-videos", "Video hướng dẫn", "/ho-tro/video", "support"),
    item("support-remote", "Hỗ trợ từ xa", "/ho-tro-tu-xa", "support"),
    item("news", "Tin tức", "/tin-tuc"),
    ...categories.map(category => item(`category-${category.slug}`, category.name, `/tin-tuc/chuyen-muc/${category.slug}`, "news")),
    item("guides", "Hướng dẫn sử dụng", "/ho-tro/cai-dat#huong-dan", "support"),
    item("consultation", "Tư vấn triển khai", "/lien-he"),
  );

  const footerItems: NavigationItems = [
    item("footer-products", "Sản phẩm & giải pháp", "/phan-mem"),
    item("footer-software", "Phần mềm", "/phan-mem", "footer-products"),
    item("footer-solutions", "Giải pháp", "/giai-phap", "footer-products"),
    item("footer-services", "Dịch vụ", "/dich-vu", "footer-products"),
    item("footer-equipment", "Thiết bị", "/thiet-bi", "footer-products"),
    item("footer-support", "Hỗ trợ", "/ho-tro/cai-dat"),
    item("footer-installation", "Hỗ trợ cài đặt", "/ho-tro/cai-dat", "footer-support"),
    item("footer-faq", "Câu hỏi thường gặp", "/ho-tro/faq", "footer-support"),
    item("footer-video", "Video hướng dẫn", "/ho-tro/video", "footer-support"),
    item("footer-remote", "Hỗ trợ từ xa", "/ho-tro-tu-xa", "footer-support"),
    item("footer-resources", "Tài nguyên", "/tin-tuc"),
    item("footer-news", "Tin tức", "/tin-tuc", "footer-resources"),
    item("footer-guides", "Hướng dẫn sử dụng", "/ho-tro/cai-dat#huong-dan", "footer-support"),
    item("footer-about", "Về iOrder", "/gioi-thieu", "footer-resources"),
    item("footer-contact", "Liên hệ", "/lien-he", "footer-resources"),
    item("footer-terms", "Điều khoản dịch vụ", "/terms", "footer-resources"),
    item("footer-privacy", "Chính sách bảo mật", "/privacy-policy", "footer-resources"),
  ];

  await Promise.all([saveNavigation("header", headerItems, author.id), saveNavigation("footer", footerItems, author.id)]);
  console.log(`Đã đồng bộ ${headerItems.length} mục Header và ${footerItems.length} mục Footer từ nội dung CMS hiện có.`);
}

run().then(() => process.exit(0)).catch((error: unknown) => {
  console.error(error instanceof Error ? `Không thể đồng bộ menu CMS: ${error.message}` : "Không thể đồng bộ menu CMS.");
  process.exit(1);
});
