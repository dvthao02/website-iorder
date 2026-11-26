import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { pages, users } from "../packages/shared/src/db/schema";
import { getAdminNavigation, saveNavigation } from "../packages/shared/src/server/navigation/navigation.service";
import type { NavigationItems } from "../packages/shared/src/server/navigation/navigation.contract";
import { ensureCertificateMedia } from "./lib/company-certificate";
import { companyProfileMenuLabel, companyProfilePageSlug, companyProfilePageValues } from "./lib/company-profile-page";
import { saveAdminPage } from "../packages/shared/src/server/pages/pages.service";

// Trang "Hồ sơ năng lực" (/pages/ho-so-nang-luc): bổ sung cho trang Giới thiệu bằng thông tin pháp lý, lĩnh vực hoạt động, văn phòng và
// giấy chứng nhận (kiểu thẻ "Giấy tờ & chứng nhận"). Chỉ dùng thông tin đã có trên website và trên giấy chứng nhận; không có số liệu tự nghĩ ra.
// Mặc định tạo trang ở dạng NHÁP (chưa công khai) để người vận hành xem lại thông tin pháp lý và ảnh giấy chứng nhận trong CMS rồi tự xuất bản; thêm --publish để tạo thẳng bản đã xuất bản.
// Mục menu chỉ được thêm khi trang đã xuất bản, nên sau khi xuất bản trong CMS chạy lại lệnh này (hoặc tự thêm ở CMS › Menu).
// Chạy lại nhiều lần an toàn: trang đã có thì giữ nguyên (không ghi đè nội dung người vận hành đã sửa), mục menu đã có thì không thêm lần nữa.
// Dùng: node --env-file=.env --import tsx scripts/seed-company-profile-page.ts [--publish] (hoặc pnpm db:seed:company-profile khi shell đã nạp .env).
// Ảnh giấy chứng nhận: scripts/data/company-documents/ (đã thu nhỏ từ bản chụp gốc).
const pageUrl = `/pages/${companyProfilePageSlug}`;

// Thêm "Hồ sơ năng lực" ngay sau mục "Về chúng tôi" (/about nằm trong nhóm "Công ty") của menu đầu trang và chân trang. Menu không có mục đó (người vận hành đã đổi cấu trúc) thì bỏ qua.
async function addMenuItem(userId: string) {
  for (const location of ["header", "footer"] as const) {
    const document = await getAdminNavigation(location);
    if (!document.id || document.items.some(item => item.url === pageUrl)) continue;
    const anchorIndex = document.items.findIndex(item => item.url === "/about" && item.parentKey !== null);
    if (anchorIndex < 0) { console.log(`Menu ${location}: không có mục "Về chúng tôi" trong nhóm, bỏ qua.`); continue; }
    const used = new Set(document.items.map(item => item.key));
    let key = "company-profile";
    for (let count = 2; used.has(key); count += 1) key = `company-profile-${count}`;
    const next: NavigationItems = [...document.items];
    next.splice(anchorIndex + 1, 0, { key, parentKey: document.items[anchorIndex].parentKey, label: companyProfileMenuLabel, url: pageUrl, linkType: "custom", contentId: null, target: "_self", isEnabled: true });
    await saveNavigation(location, next, userId, { expectedVersion: document.version, changeNote: `Thêm mục ${companyProfileMenuLabel}` });
    console.log(`Menu ${location}: đã thêm "${companyProfileMenuLabel}".`);
  }
}

async function run() {
  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị (INITIAL_ADMIN_USERNAME) để tạo trang hồ sơ năng lực.");

  const publish = process.argv.includes("--publish");
  const [existing] = await getDb().select({ id: pages.id }).from(pages).where(eq(pages.slug, companyProfilePageSlug)).limit(1);
  if (existing) {
    console.log(`Trang ${pageUrl} đã có; giữ nguyên nội dung trong CMS.`);
  } else {
    await saveAdminPage(null, companyProfilePageValues(await ensureCertificateMedia(user.id), publish ? "published" : "draft"), user.id);
    console.log(`Đã tạo trang ${pageUrl} ở dạng ${publish ? "đã xuất bản" : "nháp (xem lại trong CMS › Trang tĩnh rồi xuất bản)"}; ảnh giấy chứng nhận nằm trong thư viện media.`);
  }
  const [current] = await getDb().select({ status: pages.status }).from(pages).where(eq(pages.slug, companyProfilePageSlug)).limit(1);
  if (current?.status === "published") await addMenuItem(user.id);
  else console.log("Trang chưa xuất bản nên chưa thêm mục menu.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể tạo trang hồ sơ năng lực.");
  process.exit(1);
});
