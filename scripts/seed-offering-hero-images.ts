// Gắn ảnh trượt thêm cho thành phần "Phần đầu trang" của vài sản phẩm, dùng ảnh giao diện iOrder đã có sẵn trong thư viện.
// Chỉ thêm, không ghi đè: phần đầu trang đã có ảnh thêm thì bỏ qua; chạy lại an toàn. Cần chạy `pnpm db:seed:offering-hero-blocks` trước.
import "dotenv/config";
import { eq, isNull } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { mediaAssets, users } from "../packages/shared/src/db/schema";
import { getAdminOfferings, updateAdminOffering } from "../packages/shared/src/server/offerings/offerings.service";

// slug → tiền tố mã ảnh trong thư viện (ảnh đúng nội dung, đã có mô tả).
const wanted: Record<string, string[]> = {
  "phan-mem-quan-ly-ban-hang-iorder": ["aff41be3", "f2bedba7", "b7c6af00"], // iOrder trên laptop + điện thoại, ứng dụng điện thoại, báo cáo tổng quan
  "hoa-don-dien-tu-chu-ky-so": ["7c7eea26"], // màn hình Quản lý hóa đơn trên laptop
};

async function run() {
  const [admin] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!admin) throw new Error("Chưa có tài khoản quản trị để ghi nhận thay đổi.");
  const media = await getDb().select({ id: mediaAssets.id }).from(mediaAssets).where(isNull(mediaAssets.deletedAt));
  for (const offering of await getAdminOfferings()) {
    const prefixes = wanted[offering.slug];
    if (!prefixes) continue;
    const blocks = offering.content.blocks ?? [];
    const heroIndex = blocks.findIndex((block) => block.type === "hero");
    const hero = blocks[heroIndex];
    if (!hero || hero.type !== "hero") { console.log(`${offering.slug}: chưa có thành phần Phần đầu trang, bỏ qua`); continue; }
    if (hero.data.extraMediaIds.length) { console.log(`${offering.slug}: đã có ảnh trượt thêm, bỏ qua`); continue; }
    const ids = prefixes.flatMap((prefix) => media.filter((item) => item.id.startsWith(prefix)).map((item) => item.id));
    if (ids.length !== prefixes.length) { console.log(`${offering.slug}: thiếu ảnh trong thư viện, bỏ qua`); continue; }
    const next = blocks.map((block, index) => index === heroIndex && block.type === "hero" ? { ...block, data: { ...block.data, extraMediaIds: ids } } : block);
    const { id, draftVersion, publishedAt, updatedAt, ...input } = offering;
    void publishedAt; void updatedAt;
    await updateAdminOffering(id, { ...input, content: { ...offering.content, blocks: next } }, admin.id, "Thêm ảnh trượt cho phần đầu trang", draftVersion);
    console.log(`${offering.slug}: đã thêm ${ids.length} ảnh trượt`);
  }
}

run().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
