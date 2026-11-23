import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { redirects, users } from "../packages/shared/src/db/schema";
import { writeRedirect } from "../packages/shared/src/server/redirects/redirects.service";

const redirectsToSeed = [
  // URL catalogue V1: V2 uses a flat, content-type-based URL structure.
  { sourcePath: "/giai-phap/phan-mem", destinationPath: "/software" },
  { sourcePath: "/giai-phap/ha-tang", destinationPath: "/solutions" },
  { sourcePath: "/giai-phap/dich-vu-cntt", destinationPath: "/solutions" },
  { sourcePath: "/dich-vu/dich-vu-cntt", destinationPath: "/solutions" },
  { sourcePath: "/giai-phap/ha-tang/mang-wifi-camera", destinationPath: "/solutions/mang-wifi-camera" },
  { sourcePath: "/giai-phap/ha-tang/can-bang-tai-ha-bao-mat", destinationPath: "/solutions/can-bang-tai-ha-bao-mat" },
  { sourcePath: "/giai-phap/ha-tang/data-center", destinationPath: "/solutions/data-center" },
  { sourcePath: "/giai-phap/ha-tang/may-chu-server", destinationPath: "/solutions/may-chu-server" },
  { sourcePath: "/giai-phap/ha-tang/kiem-soat-ra-vao-cham-cong", destinationPath: "/solutions/kiem-soat-ra-vao-cham-cong" },
  { sourcePath: "/dich-vu/dich-vu-cntt/thi-cong-mang-wifi-camera", destinationPath: "/solutions/thi-cong-mang-wifi-camera" },
  { sourcePath: "/dich-vu/dich-vu-cntt/bao-tri-it", destinationPath: "/solutions/bao-tri-it" },
  { sourcePath: "/dich-vu/dich-vu-cntt/hosting-website", destinationPath: "/solutions/hosting-website" },
  { sourcePath: "/dich-vu/dich-vu-cntt/chu-ky-so-hoa-don-dien-tu", destinationPath: "/solutions/chu-ky-so-hoa-don-dien-tu" },
  { sourcePath: "/dich-vu/dich-vu-cntt/name-card-dien-tu", destinationPath: "/solutions/name-card-dien-tu" },
  { sourcePath: "/dich-vu/dich-vu-cntt/phat-trien-phan-mem", destinationPath: "/solutions/phat-trien-phan-mem" },
  { sourcePath: "/dich-vu/dich-vu-cntt/tu-van-chuyen-doi-so", destinationPath: "/solutions/tu-van-chuyen-doi-so" },
  { sourcePath: "/faq", destinationPath: "/support/faq" },
  { sourcePath: "/trang/about", destinationPath: "/about" },
  { sourcePath: "/trang/contact", destinationPath: "/contact" },
  { sourcePath: "/trang/terms", destinationPath: "/terms-of-use" },
  { sourcePath: "/trang/privacy-policy", destinationPath: "/privacy-policy" },
  { sourcePath: "/trang/support-faq", destinationPath: "/support/faq" },
  { sourcePath: "/trang/remote-support", destinationPath: "/support/remote" },
  { sourcePath: "/trang/support-videos", destinationPath: "/support/videos" },
] as const;

async function run() {
  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị để tạo redirect từ V1.");
  let created = 0;
  for (const item of redirectsToSeed) {
    const [existing] = await getDb().select({ id: redirects.id }).from(redirects).where(eq(redirects.sourcePath, item.sourcePath)).limit(1);
    if (existing) continue;
    await writeRedirect(null, { ...item, statusCode: 301, isEnabled: true }, user.id);
    created += 1;
  }
  console.log(created ? `Đã tạo ${created} redirect URL chuẩn trong CMS.` : "Các redirect URL chuẩn đã tồn tại; giữ nguyên cấu hình CMS.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể tạo redirect URL từ V1.");
  process.exit(1);
});
