import "dotenv/config";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { mediaAssets, users } from "../packages/shared/src/db/schema";
import { getAdminPageBySlug, saveAdminPage } from "../packages/shared/src/server/pages/pages.service";
import { aboutMediaIds, aboutPageTitle, aboutPageValues } from "./lib/about-page";
import { ensureCertificateMedia } from "./lib/company-certificate";

// Làm lại nội dung trang "Về chúng tôi" (/about): giới thiệu, con số kiểm chứng được, sứ mệnh – tầm nhìn – cam kết, nguyên tắc làm sản phẩm, hệ sinh thái,
// quy trình đồng hành, khách hàng và đối tác, giấy chứng nhận, thông tin doanh nghiệp. Nội dung ở scripts/lib/about-page.ts.
// Trang giữ nguyên tiêu đề, đường dẫn, trạng thái và SEO nâng cao; chỉ thay các khối và tiêu đề/mô tả SEO. Nội dung cũ vẫn nằm trong lịch sử phiên bản của trang
// (CMS › Trang › Về iOrder › Lịch sử) nên khôi phục được bằng một lần bấm.
// Khối giấy chứng nhận mặc định ẩn (ảnh có số hộ chiếu và địa chỉ của tác giả); thêm --show-certificate để hiện ngay.
// Chạy lại khi trang đã là bản mới thì không làm gì (giữ chỉnh sửa của người vận hành); thêm --force để ghi đè.
// Dùng: node --env-file=.env --import tsx scripts/rebuild-about-page.ts [--show-certificate] [--force]
async function run() {
  const force = process.argv.includes("--force");
  const showCertificate = process.argv.includes("--show-certificate");
  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị (INITIAL_ADMIN_USERNAME) để ghi nhận thay đổi trang.");

  const page = await getAdminPageBySlug("about");
  if (!page) throw new Error("Chưa có trang Về chúng tôi (slug about) trong CMS.");
  const first = page.blocks[0];
  if (!force && first?.type === "hero" && first.data.title === aboutPageTitle) {
    console.log("Trang Về chúng tôi đã là bản mới; giữ nguyên nội dung trong CMS (thêm --force để ghi đè).");
    return;
  }

  const found = await getDb().select({ id: mediaAssets.id }).from(mediaAssets).where(and(inArray(mediaAssets.id, Object.values(aboutMediaIds)), isNull(mediaAssets.deletedAt)));
  const certificateMediaId = await ensureCertificateMedia(user.id);
  const values = aboutPageValues({ certificateMediaId, showCertificate, availableMedia: new Set(found.map(row => row.id)) }, {
    title: page.title, slug: page.slug, template: page.template, status: page.status, canonicalUrl: page.canonicalUrl, scheduledAt: page.scheduledAt, seo: page.seo,
  });
  await saveAdminPage(page.id, values, user.id, { expectedVersion: page.draftVersion, changeNote: "Làm lại trang Về chúng tôi (scripts/rebuild-about-page.ts)" });
  console.log(`Đã làm lại trang Về chúng tôi (${values.blocks.length} khối, khối giấy chứng nhận ${showCertificate ? "đang hiện" : "đang ẩn"}). Bản cũ nằm trong lịch sử phiên bản của trang.`);
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể làm lại trang Về chúng tôi.");
  process.exit(1);
});
