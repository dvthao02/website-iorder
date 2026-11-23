import "dotenv/config";

import { diagnoseSearchConsole } from "@iorder/shared/server/search-console/search-console";

// Kiểm tra nối Google Search Console (chỉ đọc). Chỉ in email của tài khoản dịch vụ, danh sách website nó thấy và kết quả thử một truy vấn;
// không in khóa riêng hay mã truy cập. Chạy: pnpm gsc:check
async function main() {
  const result = await diagnoseSearchConsole();

  if (!result.configured) {
    console.log("Chưa nối Google Search Console: chưa đặt khóa tài khoản dịch vụ.");
    console.log("  Cần một trong hai biến trong .env (xem .env.example):");
    console.log("  - GOOGLE_SERVICE_ACCOUNT_FILE = đường dẫn tới tệp khóa JSON (đặt ngoài thư mục dự án)");
    console.log("  - GOOGLE_SERVICE_ACCOUNT_JSON = nội dung tệp JSON trên một dòng (cho Docker/máy chủ)");
    console.log("  Các bước ở phía Google: docs/INTEGRATIONS.md, mục \"Google Search Console\".");
    return;
  }

  if (result.email) console.log(`Tài khoản dịch vụ: ${result.email}`);
  console.log(`Địa chỉ website trong CMS: ${result.websiteUrl ?? "(chưa đặt)"}`);
  console.log(`Website tài khoản này thấy trong Search Console: ${result.sites.length ? result.sites.map((site) => `${site.siteUrl} (${site.permissionLevel ?? "?"})`).join(", ") : "chưa thấy website nào"}`);

  if (result.problem) {
    console.log(`\nCHƯA ĐƯỢC: ${result.problem}`);
    process.exitCode = 1;
    return;
  }
  if (result.property && result.period) {
    console.log(`Thuộc tính được dùng: ${result.property}`);
    console.log(`Khoảng ngày thử: ${result.period.startDate} đến ${result.period.endDate}`);
    console.log(result.sampleQueries
      ? `\nĐÃ NỐI ĐƯỢC: Google trả về ${result.sampleQueries} cụm tìm kiếm mẫu. CMS sẽ hiện thẻ "Cơ hội trên Google" ở Tổng quan.`
      : "\nĐÃ NỐI ĐƯỢC, nhưng Google chưa có cụm tìm kiếm nào trong khoảng ngày này (website mới thường cần vài ngày đến vài tuần).");
  }
}

void main().catch(() => {
  console.error("Không chạy được kiểm tra Google Search Console (kiểm tra kết nối cơ sở dữ liệu và mạng).");
  process.exitCode = 1;
});
