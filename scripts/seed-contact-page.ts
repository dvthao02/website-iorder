import "dotenv/config";

import { and, eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { auditLogs, menuItems, menus, pages, users } from "../packages/core/src/db/schema";
import { saveAdminPage } from "../packages/core/src/server/pages/pages.service";

const values = {
  title: "Liên hệ tư vấn",
  slug: "contact",
  template: "contact",
  status: "published" as const,
  seoTitle: "Liên hệ iOrder để cấu hình đúng mô hình cửa hàng",
  seoDescription: "Gửi thông tin cơ bản về mô hình kinh doanh, số chi nhánh và nhu cầu vận hành để iOrder tư vấn cấu hình phù hợp.",
  canonicalUrl: null,
  scheduledAt: null,
  blocks: [
    { type: "hero" as const, isEnabled: true, data: { eyebrow: "Tư vấn triển khai", title: "Liên hệ iOrder để cấu hình đúng mô hình cửa hàng", description: "Gửi thông tin cơ bản về mô hình kinh doanh, số chi nhánh và nhu cầu vận hành. iOrder sẽ tư vấn gói triển khai, thiết bị và quy trình phù hợp.", primaryAction: null, secondaryAction: null } },
    { type: "lead_form" as const, isEnabled: true, data: { title: "Thông tin tư vấn", description: null, submitLabel: "Gửi thông tin tư vấn", needOptions: ["POS bán hàng tại quầy", "Order tại bàn, in bếp/bar", "Quản lý kho", "Báo cáo doanh thu", "Đồng bộ nhiều chi nhánh", "Cần tư vấn tổng thể"] } },
  ],
};

async function migrateContactLinks(userId: string) {
  for (const location of ["header", "header_cta"] as const) {
    const [menu] = await getDb().select({ id: menus.id }).from(menus).where(eq(menus.location, location)).limit(1);
    if (!menu) continue;
    const [item] = await getDb().select({ id: menuItems.id, url: menuItems.url }).from(menuItems).where(and(eq(menuItems.menuId, menu.id), eq(menuItems.url, "/#tu-van"))).limit(1);
    if (!item) continue;
    await getDb().transaction(async (tx) => {
      await tx.update(menuItems).set({ url: "/lien-he", updatedAt: new Date() }).where(eq(menuItems.id, item.id));
      await tx.insert(auditLogs).values({ userId, action: "navigation.contact_cta_migrate", entityType: "menu_item", entityId: item.id, beforeData: { url: item.url }, afterData: { url: "/lien-he" } });
    });
  }
}

async function run() {
  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị để khởi tạo trang liên hệ.");
  const [page] = await getDb().select({ id: pages.id }).from(pages).where(eq(pages.slug, "contact")).limit(1);
  if (!page) await saveAdminPage(null, values, user.id, { allowFixedPageCreation: true });
  await migrateContactLinks(user.id);
  console.log("Đã kiểm tra trang liên hệ và CTA tư vấn trong CMS.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể khởi tạo trang liên hệ.");
  process.exit(1);
});
