import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { siteSettings, users } from "../packages/core/src/db/schema";
import { updateListingContent } from "../packages/core/src/server/settings/listing-content.service";

const content = {
  news: { eyebrow: "Blog iOrder", title: "Tin tức và góc nhìn vận hành", description: "Cập nhật kiến thức triển khai, vận hành và tăng trưởng dành cho doanh nghiệp Việt." },
  support: { eyebrow: "Hỗ trợ", title: "Cài đặt và tải công cụ", description: "Tải các tệp do iOrder cung cấp để cài đặt hoặc sử dụng theo hướng dẫn triển khai." },
  equipment: { eyebrow: "Thiết bị", title: "Thiết bị", description: null },
  guides: { eyebrow: "Trung tâm trợ giúp", title: "Hướng dẫn sử dụng iOrder", description: "Tài liệu hướng dẫn thiết lập, bán hàng, kho, hóa đơn điện tử và vận hành iOrder." },
};

async function run() {
  const [existing] = await getDb().select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, "listing_content")).limit(1);
  const existingValue = existing?.value as Partial<typeof content> | undefined;
  if (existingValue?.guides) {
    console.log("Nội dung listing đã có cấu hình thư viện hướng dẫn; giữ nguyên dữ liệu CMS.");
    return;
  }

  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị để khởi tạo nội dung listing.");
  await updateListingContent({ ...content, ...existingValue, guides: content.guides }, user.id);
  console.log(existing ? "Đã bổ sung cấu hình thư viện hướng dẫn vào CMS." : "Đã chuyển nội dung listing hiện có vào CMS.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể khởi tạo nội dung listing.");
  process.exit(1);
});
