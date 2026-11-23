// Hướng dẫn SEO theo loại trang, viết cho người vận hành không rành kỹ thuật.
// "auto": việc website đã tự làm (không cần nhập tay). "todo": việc cần người viết nội dung.
// Giữ đúng với hành vi thật của website (apps/website/src/lib/page-metadata.ts, structured-data.ts); đổi code thì cập nhật ở đây.

export type SeoPageKind = "software" | "solution" | "post" | "equipment" | "page";

export type SeoPageGuide = { title: string; auto: readonly string[]; todo: readonly string[] };

const commonAuto = [
  "Thẻ canonical trỏ về chính trang này, tránh bị Google coi là trùng nội dung.",
  "Thẻ chia sẻ Facebook/Zalo (tiêu đề, mô tả, ảnh); chưa có ảnh thì tự tạo ảnh theo tên trang.",
  "Có tên trong sơ đồ trang (sitemap) và đường dẫn breadcrumb khi đã đăng.",
];

export const seoPageGuides: Record<SeoPageKind, SeoPageGuide> = {
  software: {
    title: "Trang phần mềm",
    auto: [...commonAuto, "Dữ liệu cấu trúc: có bảng giá ghi số rõ ràng như “199.000đ” thì là “Phần mềm ứng dụng” (SoftwareApplication) kèm giá thấp nhất; chưa có thì là “Dịch vụ” (Service).", "Câu hỏi thường gặp tự thành dữ liệu FAQ cho Google."],
    todo: [
      "Tiêu đề SEO: đặt cụm khách hay gõ lên đầu, ví dụ “Phần mềm quản lý bán hàng iOrder”, tối đa 60 ký tự.",
      "Mô tả SEO 120–155 ký tự: nêu lợi ích chính (quản lý toàn diện nhà hàng, quán cafe…), ưu đãi nếu có (ví dụ dùng thử), rồi kết bằng lời kêu gọi như “Dùng thử ngay”.",
      "Ghi giá trong bảng giá bằng số (“199.000đ”) để Google hiểu mức giá; “Liên hệ” thì Google không hiện giá.",
      "Ảnh bìa: dùng ảnh giao diện thật của phần mềm, nhập “Mô tả ảnh” có cụm từ khóa, ví dụ “Giao diện phần mềm quản lý bán hàng iOrder cho quán cafe”.",
      "Thêm mục Câu hỏi thường gặp trả lời đúng điều khách hỏi (giá, dùng thử, thiết bị nào dùng được).",
      "Đánh giá sao chỉ thêm khi có đánh giá thật của khách; thêm giả bị Google phạt.",
    ],
  },
  solution: {
    title: "Trang giải pháp",
    auto: [...commonAuto, "Dữ liệu cấu trúc “Dịch vụ” (Service) và dữ liệu FAQ."],
    todo: [
      "Đặt tên theo nhu cầu của khách, ví dụ “Giải pháp quản lý chuỗi nhà hàng”, thay vì tên nội bộ.",
      "Mô tả SEO nêu rõ giải pháp dành cho ai và giải quyết việc gì; kết bằng lời kêu gọi như “Nhận tư vấn miễn phí”.",
      "Chọn ảnh bìa và nhập mô tả ảnh nói rõ ảnh thể hiện điều gì.",
      "Liên kết sang trang phần mềm hoặc thiết bị liên quan trong nội dung để Google hiểu mối liên hệ.",
    ],
  },
  post: {
    title: "Bài viết",
    auto: [...commonAuto, "Dữ liệu cấu trúc “Bài viết” (Article) với tác giả, ngày đăng, ngày sửa.", "Thẻ ngày đăng, chuyên mục, thẻ gắn cho Facebook/Zalo."],
    todo: [
      "Nhập “Cụm từ khách hay gõ” rồi để cụm đó có trong tiêu đề, mô tả, đoạn đầu và ít nhất một đề mục.",
      "Bài trên 300 từ, chia đề mục H2/H3; mỗi ảnh có mô tả ảnh (alt).",
      "Chọn tác giả thật để trang tác giả được liên kết (giúp Google tin cậy nội dung).",
      "Dẫn liên kết sang 2–3 bài hoặc trang sản phẩm liên quan.",
    ],
  },
  equipment: {
    title: "Trang thiết bị",
    auto: [...commonAuto, "Dữ liệu cấu trúc “Sản phẩm” (Product) kèm giá và tình trạng hàng nếu có giá."],
    todo: [
      "Tiêu đề có tên và mã thiết bị, ví dụ “Máy POS cảm ứng iOrder P2”.",
      "Điền giá, mã sản phẩm (SKU) và tình trạng hàng để Google hiển thị giá/còn hàng.",
      "Ảnh sản phẩm rõ nét, mô tả ảnh nêu tên thiết bị và góc chụp.",
      "Mô tả nêu thông số chính và nơi dùng (quầy thu ngân, bếp…).",
    ],
  },
  page: {
    title: "Trang tĩnh",
    auto: [...commonAuto, "Dữ liệu cấu trúc theo loại trang (Giới thiệu, Liên hệ, danh sách) và FAQ nếu trang có khối câu hỏi."],
    todo: [
      "Tiêu đề và mô tả SEO riêng cho trang, không dùng chung với trang khác.",
      "Mô tả 120–155 ký tự, kết bằng lời kêu gọi (“Liên hệ ngay”, “Xem bảng giá”).",
      "Chỉ bật “không cho Google lập chỉ mục” với trang nội bộ hoặc trang cảm ơn.",
    ],
  },
};
