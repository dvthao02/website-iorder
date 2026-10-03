import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../packages/core/src/db/client";
import { siteSettings, users } from "../packages/core/src/db/schema";
import { updateCatalogContent } from "../packages/core/src/server/settings/catalog-content.service";

const content = { software: { eyebrow: "Phần mềm", title: "Phần mềm giúp vận hành rõ ràng hơn", description: "Các nền tảng quản lý, bán hàng và tự động hóa được chọn lọc từ nội dung iOrder." }, solution: { eyebrow: "Giải pháp", title: "Giải pháp hạ tầng và chuyển đổi số", description: "Thiết kế nền tảng công nghệ phù hợp với quy mô, mục tiêu và cách vận hành của doanh nghiệp." }, service: { eyebrow: "Dịch vụ", title: "Dịch vụ công nghệ theo nhu cầu vận hành", description: "Tư vấn, triển khai và đồng hành cùng doanh nghiệp trên từng bài toán thực tế." }, industry: { eyebrow: "Ngành nghề", title: "Ngành nghề", description: null } };
async function run() { const [existing] = await getDb().select({ id: siteSettings.id }).from(siteSettings).where(eq(siteSettings.key, "catalog_content")).limit(1); if (existing) { console.log("Nội dung catalog đã tồn tại; giữ nguyên dữ liệu CMS."); return; } const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1); if (!user) throw new Error("Chưa có tài khoản quản trị để khởi tạo nội dung catalog."); await updateCatalogContent(content, user.id); console.log("Đã chuyển nội dung catalog hiện có vào CMS."); }
run().then(() => process.exit(0)).catch(error => { console.error(error instanceof Error ? error.message : "Không thể khởi tạo nội dung catalog."); process.exit(1); });
