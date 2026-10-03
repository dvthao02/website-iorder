import "dotenv/config";
import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { pages, users } from "../packages/core/src/db/schema";
import { saveAdminPage } from "../packages/core/src/server/pages/pages.service";

async function run() {
  const existing = await getDb().select({ id: pages.id }).from(pages).where(eq(pages.slug, "home")).limit(1);
  if (existing.length) {
    console.log("Trang chủ đã tồn tại; giữ nguyên dữ liệu CMS.");
    return;
  }

  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const [administrator] = username ? await getDb().select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1) : [];
  if (!administrator) throw new Error("Không tìm thấy tài khoản quản trị để tạo trang chủ.");

  await saveAdminPage(null, {
    title: "Trang chủ iOrder",
    slug: "home",
    template: "homepage",
    status: "published",
    seoTitle: "iOrder | Nền tảng vận hành cho doanh nghiệp Việt",
    seoDescription: "iOrder kết nối phần mềm, thiết bị và dịch vụ công nghệ để doanh nghiệp vận hành rõ ràng hơn.",
    canonicalUrl: null,
    scheduledAt: null,
    blocks: [
      {
        type: "hero",
        data: {
          eyebrow: "Nền tảng vận hành cho doanh nghiệp Việt",
          title: "Đơn giản hóa vận hành. Sẵn sàng để tăng trưởng.",
          description: "iOrder kết nối phần mềm, thiết bị và dịch vụ công nghệ để cửa hàng và doanh nghiệp vận hành rõ ràng hơn mỗi ngày.",
          primaryAction: { label: "Nhận tư vấn giải pháp", href: "#tu-van" },
          secondaryAction: { label: "Khám phá iOrder", href: "#gia-tri" },
        },
        isEnabled: true,
      },
      {
        type: "features",
        data: {
          eyebrow: "Một hệ sinh thái, một cách vận hành",
          title: "Công nghệ phục vụ công việc hằng ngày.",
          description: null,
          items: [
            { title: "Phần mềm phù hợp nghiệp vụ", description: "Hỗ trợ bán hàng, quản lý vận hành và báo cáo theo cách trực quan, dễ dùng.", href: "/phan-mem" },
            { title: "Thiết bị và hạ tầng đồng bộ", description: "Từ máy POS, máy in đến mạng và camera — triển khai theo nhu cầu thực tế.", href: "/thiet-bi" },
            { title: "Đồng hành khi triển khai", description: "Khảo sát, cài đặt, đào tạo và hỗ trợ để đội ngũ có thể tự tin vận hành.", href: "/dich-vu" },
          ],
        },
        isEnabled: true,
      },
      {
        type: "cta",
        data: {
          id: "tu-van",
          eyebrow: "Bắt đầu từ nhu cầu của bạn",
          title: "Cùng iOrder thiết kế cách vận hành phù hợp hơn.",
          action: { label: "Trao đổi với chuyên gia", href: "mailto:contact@iorder.vn" },
        },
        isEnabled: true,
      },
    ],
  }, administrator.id, { allowFixedPageCreation: true });
  console.log("Đã chuyển nội dung trang chủ hiện có vào CMS.");
}

run().catch((error: unknown) => {
  console.error(`Không thể chuyển trang chủ vào CMS: ${error instanceof Error ? error.message : "Lỗi không xác định"}`);
  process.exitCode = 1;
});
