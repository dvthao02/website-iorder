import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../packages/core/src/db/client";
import { users } from "../packages/core/src/db/schema";
import { getNavigation, saveNavigation } from "../packages/core/src/server/navigation/navigation.service";

async function run() {
  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị để ghi nhận thao tác chuyển menu.");
  if (await getNavigation("header") === null) { const links = [["Phần mềm", "/phan-mem"], ["Giải pháp", "/giai-phap"], ["Dịch vụ", "/dich-vu"], ["Hỗ trợ", "/ho-tro/cai-dat"], ["Tin tức", "/tin-tuc"]]; await saveNavigation("header", links.map(([label, url], index) => ({ key: String(index), parentKey: null, label, url, target: "_self", isEnabled: true })), user.id); }
  if (await getNavigation("header_cta") === null) await saveNavigation("header_cta", [{ key: "consultation", parentKey: null, label: "Tư vấn triển khai", url: "/#tu-van", target: "_self", isEnabled: true }], user.id);
  if (await getNavigation("footer") === null) { const links = [["Hướng dẫn sử dụng", "/ho-tro/cai-dat#huong-dan"], ["Hỗ trợ cài đặt", "/ho-tro/cai-dat"], ["Câu hỏi thường gặp", "/ho-tro/faq"], ["Hỗ trợ từ xa", "/ho-tro-tu-xa"], ["Liên hệ hỗ trợ", "/lien-he"], ["Về iOrder", "/gioi-thieu"], ["Tin tức", "/tin-tuc"], ["Chính sách bảo mật", "/privacy-policy"]]; await saveNavigation("footer", links.map(([label, url], index) => ({ key: String(index), parentKey: null, label, url, target: "_self", isEnabled: true })), user.id); }
  console.log("Đã kiểm tra và bổ sung menu điều hướng CMS còn thiếu.");
}
run().then(() => process.exit(0)).catch(() => { console.error("Không thể chuyển menu vào CMS."); process.exit(1); });
