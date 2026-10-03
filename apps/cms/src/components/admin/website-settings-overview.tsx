export function WebsiteSettingsOverview() {
  return <main className="admin-settings-page">
    <header className="admin-settings-page__header">
      <p>Cài đặt</p>
      <h1>Cấu hình website</h1>
      <span>Đây là nơi giải thích cách sắp xếp cấu hình. Chọn mục tương ứng ngay ở thanh điều hướng bên trái để thực hiện thay đổi.</span>
    </header>
    <section className="admin-settings-page__section admin-settings-overview" aria-label="Hướng dẫn cấu hình website">
      <h2>Chọn đúng khu vực cần quản lý</h2>
      <p>Không lặp lại các đường dẫn tại đây để sidebar luôn là nơi điều hướng duy nhất.</p>
      <div>
        <article><strong>Tổ chức website</strong><span>Menu, chuyên mục, SEO, chuyển hướng URL và liên kết ngoài.</span></article>
        <article><strong>Thư viện</strong><span>Hình ảnh và tệp dùng cho nội dung website.</span></article>
        <article><strong>Cài đặt</strong><span>Thiết lập xuất bản và giao diện làm việc của CMS.</span></article>
      </div>
    </section>
  </main>;
}
