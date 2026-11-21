// Chuyển phần đầu trang của Sản phẩm / Giải pháp / Dịch vụ từ khối cố định sang thành phần "Phần đầu trang" (cùng loại với Trang chủ).
// Dữ liệu dựng từ các trường hiện có (tên, tóm tắt, ảnh bìa, nhãn nhóm, "Phù hợp với", "Giá trị nổi bật", Bố cục khối); xem `offeringHeroBlock`.
// Chỉ thêm, không ghi đè: mục đã có thành phần Phần đầu trang thì bỏ qua; chạy lại an toàn. Mỗi mục lưu một phiên bản mới (khôi phục được trong lịch sử).
import "dotenv/config";
import { eq } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { users } from "../packages/shared/src/db/schema";
import { withOfferingHero } from "../packages/shared/src/server/offerings/offering-hero";
import { getAdminOfferings, updateAdminOffering } from "../packages/shared/src/server/offerings/offerings.service";

async function run() {
  const [admin] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!admin) throw new Error("Chưa có tài khoản quản trị để ghi nhận thay đổi.");
  for (const offering of await getAdminOfferings()) {
    const blocks = offering.content.blocks;
    if (!blocks) { console.log(`${offering.slug}: chưa chuyển nội dung cũ thành thành phần, bỏ qua`); continue; }
    if (blocks.some((block) => block.type === "hero")) { console.log(`${offering.slug}: đã có Phần đầu trang, bỏ qua`); continue; }
    const next = withOfferingHero(blocks, { title: offering.title, summary: offering.summary, coverMediaId: offering.coverMediaId, content: offering.content });
    const { id, draftVersion, publishedAt, updatedAt, ...input } = offering;
    void publishedAt; void updatedAt;
    await updateAdminOffering(id, { ...input, content: { ...offering.content, blocks: next } }, admin.id, "Chuyển Phần đầu trang thành thành phần", draftVersion);
    console.log(`${offering.slug}: đã thêm Phần đầu trang`);
  }
}

run().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
