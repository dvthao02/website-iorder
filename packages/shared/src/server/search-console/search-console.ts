import { getCmsSecret } from "../secrets/secrets";
import { getPublishingConfig } from "../settings/publishing.service";
import { createSearchConsoleService, defaultReadFile } from "./search-console.service";

export type { SearchConsoleOverview, SearchConsolePageQueries, SearchConsoleQuery, SearchConsoleOpportunity } from "./search-console.contract";

// Cấu hình thật: khóa tài khoản dịch vụ từ GOOGLE_SERVICE_ACCOUNT_JSON hoặc GOOGLE_SERVICE_ACCOUNT_FILE (xem .env.example);
// chưa đặt thì mọi hàm trả `not_configured` và không gọi ra ngoài. Địa chỉ website lấy từ Cài đặt "Tên miền & SEO".
const service = createSearchConsoleService({
  fetch: (...args) => fetch(...args),
  env: process.env,
  now: () => new Date(),
  readFile: defaultReadFile,
  siteUrl: async () => (await getPublishingConfig()).siteUrl,
  // Khóa nhập ở CMS (đã mã hóa trong database); chỉ dùng khi biến môi trường chưa đặt.
  cmsSecret: getCmsSecret,
});

/** Tổng quan 28 ngày: tổng lượt hiện/bấm, cụm hay gõ nhất và cơ hội cải thiện. Chỉ đọc. */
export const getSearchConsoleOverview = service.getOverview;
/** Các cụm khách gõ để thấy một trang (đường dẫn công khai). */
export const getSearchConsolePageQueries = service.getPageQueries;
/** Chẩn đoán cấu hình (lệnh pnpm gsc:check). */
export const diagnoseSearchConsole = service.diagnose;
