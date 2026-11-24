import { scrubDeletedLeads } from "@iorder/shared/server/leads/leads.repository";

// Xóa nốt thông tin cá nhân của các liên hệ đã bị xóa từ phiên bản cũ (chỉ ẩn). Từ phiên bản hiện tại, xóa hoặc gộp liên hệ đã tự xóa thông tin cá nhân,
// nên lệnh này chủ yếu dùng một lần cho dữ liệu cũ; chạy lại không sao.
async function main() {
  const scrubbed = await scrubDeletedLeads();
  console.log(`Đã xóa thông tin cá nhân của ${scrubbed} liên hệ đã bị xóa trước đây.`);
}

void main().catch(() => {
  console.error("Không thể dọn liên hệ đã xóa.");
  process.exitCode = 1;
});
