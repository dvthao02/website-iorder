import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { pages, users } from "../packages/core/src/db/schema";
import { saveAdminPage } from "../packages/core/src/server/pages/pages.service";

type Section = [heading: string, items: string[]];

function make(title: string, description: string, sections: Section[]) {
  return {
    title,
    template: "default" as const,
    status: "published" as const,
    seoTitle: title,
    seoDescription: description,
    canonicalUrl: null,
    scheduledAt: null,
    blocks: [
      { type: "hero" as const, isEnabled: true, data: { eyebrow: "iOrder", title, description, primaryAction: null, secondaryAction: null } },
      { type: "features" as const, isEnabled: true, data: { eyebrow: null, title: "Nội dung", description: null, items: sections.map(([heading, items]) => ({ title: heading, description: items.join(" · "), href: null })) } },
    ],
  };
}

const entries = [
  { slug: "about", values: make("Về iOrder", "iOrder là nền tảng quản lý bán hàng và vận hành cửa hàng được thiết kế cho những chủ kinh doanh muốn nhìn rõ dữ liệu, giảm sai sót và mở rộng mà không đánh mất sự kiểm soát.", [["Chúng tôi tin vào vận hành rõ ràng", ["Bán hàng nhanh nhưng dữ liệu phải chính xác", "Quản lý kho phải đi cùng đơn hàng thực tế", "Báo cáo phải giúp chủ cửa hàng ra quyết định ngay", "Mở thêm chi nhánh phải có quy trình thống nhất"]], ["iOrder đồng hành trong từng ca bán", ["POS tại quầy, gọi món, in bếp và thanh toán", "Tồn kho, khách hàng, nhân viên và phân quyền", "Báo cáo doanh thu theo thời gian thực", "Hỗ trợ thiết bị, hạ tầng và triển khai thực tế tại cửa hàng"]], ["Dành cho mô hình đang muốn lớn lên", ["Nhà hàng, cafe, trà sữa, bán lẻ và chuỗi cửa hàng", "Chủ kinh doanh cần quản lý từ xa", "Đội ngũ cần thao tác đơn giản, ít đào tạo", "Doanh nghiệp cần dữ liệu tập trung để mở rộng"]], ["Điều làm iOrder khác biệt", ["Không tách rời phần mềm khỏi vận hành thực tế", "Tập trung vào trải nghiệm nhân viên lẫn góc nhìn quản lý", "Linh hoạt theo nghiệp vụ từng mô hình", "Ưu tiên triển khai được, dùng được và đo lường được"]]]) },
  { slug: "support-faq", values: make("Câu hỏi thường gặp", "Tổng hợp các câu hỏi phổ biến khi bắt đầu sử dụng iOrder.", [["Bắt đầu", ["Có thể dùng thử trước khi đăng ký không?", "Có hỗ trợ nhập dữ liệu ban đầu không?", "Có dùng được nhiều chi nhánh không?"]], ["Vận hành", ["Mất mạng có ảnh hưởng bán hàng không?", "Có kết nối máy in bếp không?", "Có phân quyền nhân viên không?"]]]) },
  { slug: "remote-support", values: make("Hỗ trợ từ xa", "Đội ngũ kỹ thuật có thể hỗ trợ kiểm tra cấu hình, thiết bị và phần mềm qua các công cụ điều khiển từ xa.", [["Khi nào cần hỗ trợ từ xa", ["Lỗi in hóa đơn", "Không kết nối thiết bị", "Cần kiểm tra cấu hình", "Cần hướng dẫn thao tác nhanh"]], ["Thông tin cần cung cấp", ["Tên cửa hàng", "Số điện thoại liên hệ", "Mô tả lỗi", "Ảnh chụp màn hình nếu có"]]]) },
  { slug: "support-videos", values: make("Video hướng dẫn", "Khu vực tổng hợp video hướng dẫn thao tác bán hàng, quản lý kho, báo cáo và cấu hình thiết bị.", [["Chủ đề video", ["Tạo sản phẩm", "Bán hàng POS", "In hóa đơn", "Kiểm kho", "Xem báo cáo"]], ["Đang cập nhật", ["Video sẽ được bổ sung theo từng nhóm nghiệp vụ", "Liên hệ hỗ trợ nếu cần hướng dẫn trực tiếp"]]]) },
  { slug: "privacy-policy", values: make("Chính sách bảo mật", "iOrder cam kết tôn trọng và bảo vệ thông tin cá nhân của khách hàng sử dụng ứng dụng và dịch vụ của chúng tôi.", [["1. Mục đích và phạm vi thu thập", ["Thu thập thông tin cơ bản cần thiết để đăng ký, xác thực và cung cấp dịch vụ", "Đăng ký tài khoản và xác thực người dùng", "Cung cấp dịch vụ và hỗ trợ kỹ thuật", "Cải thiện trải nghiệm người dùng và ứng dụng", "Đảm bảo quyền lợi của khách hàng"]], ["2. Dịch vụ và ứng dụng liên kết", ["Chỉ yêu cầu quyền truy cập cần thiết khi khách hàng đồng ý", "Quyền thiết bị được dùng để vận hành tính năng đã được cấp phép", "Kết nối Facebook hoặc Zalo chỉ lấy dữ liệu cần cho tích hợp", "Khách hàng có thể từ chối quyền; một số tính năng có thể bị ảnh hưởng"]], ["3. Phạm vi sử dụng thông tin", ["Cung cấp dịch vụ và hỗ trợ khách hàng", "Gửi thông báo trao đổi với bộ phận hỗ trợ kỹ thuật", "Ngăn chặn hoạt động giả mạo hoặc phá hoại tài khoản", "Gửi thông báo, khuyến mãi khi khách hàng đồng ý", "Cung cấp thông tin theo yêu cầu hợp pháp của cơ quan có thẩm quyền"]], ["4. Thời gian lưu trữ thông tin", ["Thông tin được bảo mật trên hệ thống của iOrder", "Khách hàng có thể yêu cầu cập nhật, điều chỉnh hoặc xóa dữ liệu cá nhân", "Dữ liệu được lưu trong thời gian sử dụng dịch vụ", "Sau khi ngưng sử dụng, dữ liệu có thể được lưu theo yêu cầu pháp luật, tranh chấp hoặc an toàn kỹ thuật"]], ["6. Tiếp cận và chỉnh sửa dữ liệu", ["Khách hàng có thể tự kiểm tra và điều chỉnh thông tin qua tài khoản", "Khách hàng có thể yêu cầu iOrder hỗ trợ cập nhật dữ liệu", "Khi có khiếu nại, iOrder xác nhận thông tin và hướng dẫn khôi phục, bảo mật lại tài khoản"]], ["7. Cam kết bảo mật", ["Không tiết lộ thông tin cá nhân cho bên thứ ba khi chưa được cho phép, trừ trường hợp pháp luật quy định", "Bảo mật thông tin giao dịch trực tuyến, hóa đơn và chứng từ số hóa", "Chủ động phòng tránh truy cập trái phép, tấn công dữ liệu và mất mát thông tin"]], ["8. Cập nhật chính sách", ["Chính sách có thể được cập nhật theo thời gian", "Mọi thay đổi quan trọng sẽ được thông báo trên ứng dụng hoặc website", "Việc tiếp tục sử dụng dịch vụ sau khi có thay đổi đồng nghĩa khách hàng chấp thuận chính sách mới"]]]) },
  { slug: "terms", values: make("Điều khoản dịch vụ", "Các điều khoản sử dụng dịch vụ, trách nhiệm hỗ trợ và nguyên tắc bảo vệ dữ liệu khi khách hàng sử dụng iOrder.", [["Nguyên tắc sử dụng", ["Cung cấp thông tin chính xác", "Bảo mật tài khoản", "Sử dụng dịch vụ đúng mục đích", "Thông báo khi phát hiện sự cố"]], ["Hỗ trợ và dữ liệu", ["Hỗ trợ trong phạm vi dịch vụ đăng ký", "Không chia sẻ dữ liệu trái phép", "Sao lưu theo chính sách từng gói", "Liên hệ khi cần điều chỉnh thông tin"]]]) },
];

async function run() {
  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị để nhập trang V1.");
  for (const entry of entries) {
    const [existing] = await getDb().select({ id: pages.id }).from(pages).where(eq(pages.slug, entry.slug)).limit(1);
    if (!existing) await saveAdminPage(null, { ...entry.values, slug: entry.slug }, user.id, { allowFixedPageCreation: true });
  }
  console.log("Đã kiểm tra và nhập các trang nội dung V1 còn thiếu.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể nhập trang nội dung V1.");
  process.exit(1);
});
