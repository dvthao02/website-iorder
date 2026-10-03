import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { testimonials, users } from "../packages/core/src/db/schema";
import { writeSupporting } from "../packages/core/src/server/supporting/supporting.service";

const sourceTestimonials = [
  {
    authorName: "Anh Minh",
    authorRole: "Chuỗi 3 quán cafe tại TP.HCM",
    company: null,
    quote: "iOrder giúp tôi theo dõi doanh thu từng ca, từng nhân viên mà không cần ngồi đối chiếu sổ sách. Mỗi tháng tiết kiệm được gần chục giờ đồng hồ.",
    rating: 5,
    sortOrder: 0,
  },
  {
    authorName: "Chị Hà",
    authorRole: "Quản lý chuỗi trà sữa 5 chi nhánh",
    company: null,
    quote: "Trước đây kho hay bị thất thoát mà không biết lý do. Từ khi dùng iOrder, mỗi lần xuất kho đều có ghi nhận, cuối tháng so khớp rất nhanh.",
    rating: 5,
    sortOrder: 1,
  },
  {
    authorName: "Anh Tuấn",
    authorRole: "Chủ cửa hàng bán lẻ tại Hà Nội",
    company: null,
    quote: "Nhân viên mới chỉ cần học 30 phút là dùng được. Triển khai xong trong 1 ngày, hôm sau mở cửa bán hàng bình thường.",
    rating: 5,
    sortOrder: 2,
  },
] as const;

async function run() {
  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị để nhập đánh giá từ V1.");

  for (const item of sourceTestimonials) {
    const [existing] = await getDb().select({ id: testimonials.id }).from(testimonials).where(eq(testimonials.authorName, item.authorName)).limit(1);
    if (!existing) await writeSupporting("testimonials", null, { ...item, avatarMediaId: null, isEnabled: true }, user.id);
  }

  console.log("Đã kiểm tra và nhập các đánh giá khách hàng hợp lệ từ V1.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể nhập đánh giá khách hàng từ V1.");
  process.exit(1);
});
