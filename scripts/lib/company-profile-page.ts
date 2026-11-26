import { pageInputSchema, type PageInput } from "../../packages/shared/src/server/pages/pages.contract";

// Nội dung trang "Hồ sơ năng lực" (/pages/ho-so-nang-luc) cho scripts/seed-company-profile-page.ts. Chỉ dùng thông tin đã có trên website và trên giấy
// chứng nhận; không có số liệu tự nghĩ ra. Tách khỏi script chạy để kiểm thử/xem trước dùng lại được mà không chạm DB.
export const companyProfilePageSlug = "ho-so-nang-luc";
export const companyProfileMenuLabel = "Hồ sơ năng lực";
export const companyProfileCertificateAlt = "Giấy chứng nhận đăng ký quyền tác giả số 0996/2026/QTG do Cục Bản quyền tác giả cấp ngày 27/01/2026 cho tác phẩm Phần mềm quản lý bán hàng iOrder";

const action = (label: string, href: string) => ({ label, href });

// Qua schema để các trường mặc định của khối (vỏ chung, nền, khoảng cách…) được điền đủ như khi lưu từ CMS.
export function companyProfilePageValues(certificateMediaId: string, status: PageInput["status"] = "published"): PageInput {
  return pageInputSchema.parse({
    title: "Hồ sơ năng lực",
    slug: companyProfilePageSlug,
    template: "default",
    status,
    seoTitle: "Hồ sơ năng lực iOrder - Thông tin pháp lý, giấy chứng nhận",
    seoDescription: "Thông tin doanh nghiệp, lĩnh vực hoạt động, văn phòng và giấy chứng nhận đăng ký quyền tác giả phần mềm quản lý bán hàng của Công ty TNHH IORDER.",
    canonicalUrl: null,
    scheduledAt: null,
    blocks: [
      { type: "hero", isEnabled: true, data: { eyebrow: "Hồ sơ năng lực", title: "Công ty TNHH IORDER", description: "Thông tin pháp lý, lĩnh vực hoạt động, văn phòng và các giấy chứng nhận của iOrder — đơn vị phát triển phần mềm bán hàng, cung cấp thiết bị và triển khai hạ tầng cho cửa hàng.", primaryAction: action("Liên hệ", "/contact"), secondaryAction: action("Về chúng tôi", "/about"), mediaId: null, layout: "centered", highlights: [], footnote: null, slides: [], extraMediaIds: [], tone: null, panels: [] } },
      {
        type: "features", isEnabled: true, appearance: { anchor: "thong-tin-doanh-nghiep" },
        data: {
          cardStyle: "compact", eyebrow: "Thông tin doanh nghiệp", title: "Thông tin pháp lý và liên hệ", description: "Thông tin đăng ký của công ty để đối tác và khách hàng đối chiếu khi ký kết, thanh toán và xuất hóa đơn.",
          items: [
            { title: "Tên công ty", description: "CÔNG TY TNHH IORDER\n(IORDER COMPANY LIMITED)", href: null, icon: "building" },
            { title: "Số đăng ký kinh doanh", description: "0319027616, đăng ký ngày 27/06/2025", href: null, icon: "briefcase" },
            { title: "Văn phòng Hồ Chí Minh", description: "756A Âu Cơ, Phường Tân Bình, Thành phố Hồ Chí Minh", href: null, icon: "map-pin" },
            { title: "Văn phòng Đà Nẵng", description: "21 Phạm Nhữ Tăng, Phường Thanh Khê, Thành phố Đà Nẵng", href: null, icon: "map-pin" },
            { title: "Hotline", description: "028 710 73 999\nKinh doanh: contact@iorder.vn\nHỗ trợ: support@iorder.vn", href: null, icon: "headphones" },
            { title: "Giờ làm việc", description: "Thứ 2 - Thứ 6: 9:00 - 18:00", href: null, icon: "clock" },
          ],
        },
      },
      {
        type: "features", isEnabled: true, appearance: { anchor: "linh-vuc-hoat-dong" },
        data: {
          cardStyle: "compact", eyebrow: "Lĩnh vực hoạt động", title: "Phần mềm, thiết bị và hạ tầng cho cửa hàng", description: null,
          items: [
            { title: "Phần mềm", description: "Phần mềm quản lý bán hàng iOrder, quản lý trạm sạc xe điện iOrder EV, hóa đơn điện tử và chữ ký số.", href: "/software", icon: "monitor" },
            { title: "Thiết bị bán hàng", description: "Máy POS, máy in hóa đơn, máy quét mã vạch và thiết bị hỗ trợ vận hành cửa hàng.", href: "/equipment", icon: "printer" },
            { title: "Giải pháp hạ tầng", description: "Hạ tầng mạng, Wi-Fi, camera, data center, kiểm soát ra vào và chấm công.", href: "/solutions", icon: "wifi" },
            { title: "Tư vấn và phát triển phần mềm", description: "Tư vấn chuyển đổi số và phát triển phần mềm theo yêu cầu của doanh nghiệp.", href: "/solutions", icon: "laptop" },
            { title: "Hỗ trợ khách hàng", description: "Hướng dẫn sử dụng, hỗ trợ cài đặt và hỗ trợ từ xa.", href: "/support/setup", icon: "headphones" },
          ],
        },
      },
      {
        type: "features", isEnabled: true, appearance: { anchor: "giay-to-phap-ly" },
        data: {
          cardStyle: "document", eyebrow: "Pháp lý và chứng nhận", title: "Giấy chứng nhận và giấy tờ pháp lý", description: "Các giấy chứng nhận do cơ quan nhà nước cấp cho iOrder và sản phẩm của chúng tôi. Bấm vào từng thẻ để xem bản chụp.",
          items: [
            { title: "Giấy chứng nhận đăng ký quyền tác giả", description: "Số 0996/2026/QTG · Xem giấy chứng nhận", href: null, mediaId: certificateMediaId },
          ],
        },
      },
      { type: "cta", isEnabled: true, data: { id: null, eyebrow: "Liên hệ", title: "Cần thêm thông tin về iOrder?", action: action("Liên hệ với chúng tôi", "/contact") } },
    ],
  });
}
