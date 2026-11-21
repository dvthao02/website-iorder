// Mẫu khung bài viết: chèn sẵn các tiêu đề và gợi ý nội dung để người viết điền tiếp.
export type ContentTemplate = { id: string; label: string; description: string; html: string };

export const contentTemplates: ContentTemplate[] = [
  {
    id: "guide",
    label: "Hướng dẫn từng bước",
    description: "Chuẩn bị, các bước thực hiện, lỗi thường gặp.",
    html: "<p>Giới thiệu ngắn: bài này giúp bạn làm được gì và mất bao lâu.</p><h2>Chuẩn bị</h2><ul><li><p>Thiết bị/tài khoản cần có</p></li><li><p>Quyền hoặc thông tin cần chuẩn bị</p></li></ul><h2>Các bước thực hiện</h2><h3>Bước 1: …</h3><p>Mô tả thao tác, kèm ảnh chụp màn hình.</p><h3>Bước 2: …</h3><p>Mô tả thao tác.</p><h3>Bước 3: …</h3><p>Mô tả thao tác.</p><h2>Lỗi thường gặp</h2><table><tr><th><p>Hiện tượng</p></th><th><p>Cách xử lý</p></th></tr><tr><td><p>…</p></td><td><p>…</p></td></tr></table><h2>Cần hỗ trợ thêm?</h2><p>Liên hệ hotline hoặc gửi yêu cầu hỗ trợ từ xa.</p>",
  },
  {
    id: "news",
    label: "Tin tức",
    description: "Tóm tắt sự kiện, chi tiết, ý nghĩa với khách hàng.",
    html: "<p><strong>Tóm tắt:</strong> điều gì xảy ra, khi nào, ở đâu.</p><h2>Chi tiết</h2><p>Nội dung chính của sự kiện hoặc thay đổi.</p><h2>Ý nghĩa với khách hàng</h2><ul><li><p>Lợi ích 1</p></li><li><p>Lợi ích 2</p></li></ul><h2>Thông tin thêm</h2><p>Liên kết, thời gian áp dụng, người liên hệ.</p>",
  },
  {
    id: "case-study",
    label: "Câu chuyện khách hàng",
    description: "Bối cảnh, vấn đề, giải pháp, kết quả có số liệu.",
    html: "<p>Giới thiệu khách hàng: ngành, quy mô, số chi nhánh.</p><h2>Bối cảnh và vấn đề</h2><p>Khó khăn trước khi dùng iOrder.</p><h2>Giải pháp triển khai</h2><ul><li><p>Phần mềm/thiết bị đã dùng</p></li><li><p>Thời gian triển khai</p></li></ul><h2>Kết quả</h2><table><tr><th><p>Chỉ số</p></th><th><p>Trước</p></th><th><p>Sau</p></th></tr><tr><td><p>…</p></td><td><p>…</p></td><td><p>…</p></td></tr></table><blockquote><p>“Trích lời khách hàng.” — Tên, chức vụ</p></blockquote>",
  },
  {
    id: "promotion",
    label: "Khuyến mãi",
    description: "Ưu đãi, thời gian, điều kiện, cách đăng ký.",
    html: "<p><strong>Ưu đãi:</strong> mô tả ngắn gọn mức giảm/quà tặng.</p><h2>Thời gian áp dụng</h2><p>Từ … đến …</p><h2>Điều kiện</h2><ul><li><p>Đối tượng áp dụng</p></li><li><p>Sản phẩm/gói áp dụng</p></li></ul><h2>Cách đăng ký</h2><ol><li><p>Bước 1</p></li><li><p>Bước 2</p></li></ol>",
  },
];
