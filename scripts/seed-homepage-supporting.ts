import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { pages, users } from "../packages/core/src/db/schema";
import { getPublishedPage, saveAdminPage } from "../packages/core/src/server/pages/pages.service";

async function run() {
  const page = await getPublishedPage("home");
  if (!page) throw new Error("Chưa có trang chủ để bổ sung nội dung hỗ trợ.");

  let changed = false;
  const blocks = page.blocks.map((block) => {
    if (block.type !== "cta" || block.data.action.href !== "mailto:contact@iorder.vn") return block;
    changed = true;
    return { ...block, data: { ...block.data, action: { ...block.data.action, href: "/lien-he" } } };
  });

  if (!blocks.some((block) => block.type === "testimonials")) {
    blocks.push({ type: "testimonials", isEnabled: true, data: { eyebrow: "Khách hàng chia sẻ", title: "Kết quả từ vận hành thực tế", limit: 6 } });
    changed = true;
  }
  if (!changed) {
    console.log("Trang chủ đã có block đánh giá và CTA liên hệ; giữ nguyên dữ liệu CMS.");
    return;
  }

  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  const [record] = await getDb().select({ id: pages.id }).from(pages).where(eq(pages.slug, "home")).limit(1);
  if (!user || !record) throw new Error("Không thể xác định dữ liệu trang chủ hoặc tài khoản quản trị.");

  await saveAdminPage(record.id, { title: page.title, slug: page.slug, template: page.template, status: page.status, seoTitle: page.seoTitle, seoDescription: page.seoDescription, canonicalUrl: page.canonicalUrl, scheduledAt: page.scheduledAt, blocks }, user.id);
  console.log("Đã bổ sung nội dung hỗ trợ và CTA liên hệ vào trang chủ CMS.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể bổ sung nội dung hỗ trợ vào trang chủ.");
  process.exit(1);
});
