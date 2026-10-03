import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { users } from "../packages/core/src/db/schema";
import { getExternalLinks, updateExternalLinks } from "../packages/core/src/server/settings/external-links.service";

const v1ExternalLinks = {
  appLogin: "https://app.iorder.vn/login",
  trial: "https://app.iorder.vn/register-trial",
  facebook: "https://www.facebook.com/iorder.phanmemquanlybanhang",
  zalo: "https://zalo.me/202942984074069074",
  youtube: null,
  appStore: null,
  googlePlay: null,
};

async function run() {
  const existing = await getExternalLinks();
  const next = { ...v1ExternalLinks, ...existing };
  const needsSeed = !existing || ["appLogin", "trial", "facebook", "zalo"].some((key) => existing[key as keyof typeof existing] === null);
  if (!needsSeed) {
    console.log("Liên kết ngoài đã đủ dữ liệu V1; giữ nguyên dữ liệu CMS.");
    return;
  }

  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị để khởi tạo liên kết ngoài.");
  await updateExternalLinks(next, user.id);
  console.log(existing ? "Đã bổ sung liên kết V1 còn thiếu vào CMS." : "Đã khởi tạo liên kết ngoài từ dữ liệu V1.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể khởi tạo liên kết ngoài.");
  process.exit(1);
});
