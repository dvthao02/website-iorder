import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { users } from "../packages/core/src/db/schema";
import { getPublishingConfig, updatePublishingConfig } from "../packages/core/src/server/settings/publishing.service";

const v1Metadata = {
  defaultTitle: "iOrder - Phần mềm quản lý bán hàng",
  defaultDescription: "iOrder là phần mềm quản lý bán hàng, order tại bàn, quản lý kho, nhân viên và báo cáo doanh thu cho nhà hàng, cafe, bán lẻ và chuỗi cửa hàng.",
};

async function run() {
  const config = await getPublishingConfig();
  if (config.defaultTitle && config.defaultDescription) {
    console.log("Metadata xuất bản đã tồn tại; giữ nguyên dữ liệu CMS.");
    return;
  }

  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị để khởi tạo metadata xuất bản.");
  await updatePublishingConfig({ ...config, defaultTitle: config.defaultTitle ?? v1Metadata.defaultTitle, defaultDescription: config.defaultDescription ?? v1Metadata.defaultDescription }, user.id);
  console.log("Đã bổ sung metadata công khai từ V1 vào CMS.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể khởi tạo metadata xuất bản.");
  process.exit(1);
});
