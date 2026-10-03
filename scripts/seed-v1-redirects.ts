import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { redirects, users } from "../packages/core/src/db/schema";
import { writeRedirect } from "../packages/core/src/server/redirects/redirects.service";

const redirectsToSeed = [
  // URL catalogue V1: V2 uses a flat, content-type-based URL structure.
  { sourcePath: "/giai-phap/phan-mem", destinationPath: "/phan-mem" },
  { sourcePath: "/giai-phap/ha-tang", destinationPath: "/giai-phap" },
  { sourcePath: "/giai-phap/dich-vu-cntt", destinationPath: "/dich-vu" },
  { sourcePath: "/dich-vu/dich-vu-cntt", destinationPath: "/dich-vu" },
  { sourcePath: "/giai-phap/ha-tang/mang-wifi-camera", destinationPath: "/giai-phap/mang-wifi-camera" },
  { sourcePath: "/giai-phap/ha-tang/can-bang-tai-ha-bao-mat", destinationPath: "/giai-phap/can-bang-tai-ha-bao-mat" },
  { sourcePath: "/giai-phap/ha-tang/data-center", destinationPath: "/giai-phap/data-center" },
  { sourcePath: "/giai-phap/ha-tang/may-chu-server", destinationPath: "/giai-phap/may-chu-server" },
  { sourcePath: "/giai-phap/ha-tang/kiem-soat-ra-vao-cham-cong", destinationPath: "/giai-phap/kiem-soat-ra-vao-cham-cong" },
  { sourcePath: "/dich-vu/dich-vu-cntt/thi-cong-mang-wifi-camera", destinationPath: "/dich-vu/thi-cong-mang-wifi-camera" },
  { sourcePath: "/dich-vu/dich-vu-cntt/bao-tri-it", destinationPath: "/dich-vu/bao-tri-it" },
  { sourcePath: "/dich-vu/dich-vu-cntt/hosting-website", destinationPath: "/dich-vu/hosting-website" },
  { sourcePath: "/dich-vu/dich-vu-cntt/chu-ky-so-hoa-don-dien-tu", destinationPath: "/dich-vu/chu-ky-so-hoa-don-dien-tu" },
  { sourcePath: "/dich-vu/dich-vu-cntt/name-card-dien-tu", destinationPath: "/dich-vu/name-card-dien-tu" },
  { sourcePath: "/dich-vu/dich-vu-cntt/phat-trien-phan-mem", destinationPath: "/dich-vu/phat-trien-phan-mem" },
  { sourcePath: "/dich-vu/dich-vu-cntt/tu-van-chuyen-doi-so", destinationPath: "/dich-vu/tu-van-chuyen-doi-so" },
  { sourcePath: "/faq", destinationPath: "/ho-tro/faq" },
  { sourcePath: "/trang/about", destinationPath: "/gioi-thieu" },
  { sourcePath: "/trang/contact", destinationPath: "/lien-he" },
  { sourcePath: "/trang/terms", destinationPath: "/terms" },
  { sourcePath: "/trang/privacy-policy", destinationPath: "/privacy-policy" },
  { sourcePath: "/trang/support-faq", destinationPath: "/ho-tro/faq" },
  { sourcePath: "/trang/remote-support", destinationPath: "/ho-tro-tu-xa" },
  { sourcePath: "/trang/support-videos", destinationPath: "/ho-tro/video" },
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
