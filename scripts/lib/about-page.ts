import { pageInputSchema, type PageInput } from "../../packages/shared/src/server/pages/pages.contract";

// Nội dung trang "Về chúng tôi" (/about) cho scripts/rebuild-about-page.ts. Chữ lấy từ những gì iOrder đã công bố: trang chủ (hệ sinh thái, quy trình
// 6 bước, dùng thử 15 ngày), nội dung giới thiệu V1, trang Giới thiệu cũ (sứ mệnh) và giấy chứng nhận. Không có số liệu về năm thành lập, số khách hàng
// hay nhân sự: các con số trong khối "iOrder trong một cái nhìn" đều đếm được từ website (văn phòng, nhóm giải pháp, ngày dùng thử, kênh hỗ trợ).
// Không dùng khối "Cảm nhận khách hàng": các đánh giá hiện có trong CMS là dữ liệu mẫu (ghi "Dữ liệu mẫu"), đưa lên trang công khai sẽ gây hiểu lầm.
// Tầm nhìn là câu định hướng do người soạn đề xuất: người vận hành đọc lại trước khi giữ.

export const aboutPageTitle = "Công nghệ đồng hành cùng cửa hàng Việt";

// Ảnh dùng trong trang (đã có sẵn trong thư viện media của hệ thống đang chạy). Mã không còn trong thư viện thì script bỏ ảnh đó, trang vẫn lưu được.
export const aboutMediaIds = {
  hero: "6d50582c-0d34-458f-8cb3-bc8b69445181",
  posStation: "99c91bf8-c895-48aa-a323-462a3bce2833",
  software: "f84d51d1-bf62-457f-b68d-a814cff2807c",
  equipment: "40ff9e56-dd19-446b-870c-608ceefd1dd1",
  network: "558164f3-5ecb-43fd-9567-6ef58a661c7e",
  development: "ea2aeb17-c7c0-4616-ab67-98150833d31c",
  support: "792d16aa-327a-454b-9b5d-5120f54b6551",
} as const;

const action = (label: string, href: string) => ({ label, href });

type AboutOptions = {
  /** Mã ảnh giấy chứng nhận trong thư viện media. */
  certificateMediaId: string;
  /** Khối giấy chứng nhận có hiện ngay không. Ảnh có số hộ chiếu và địa chỉ của tác giả nên mặc định ẩn cho tới khi người vận hành quyết định công khai. */
  showCertificate: boolean;
  /** Tập mã ảnh còn tồn tại; mã ngoài tập này bị bỏ. Không truyền = giữ mọi ảnh. */
  availableMedia?: ReadonlySet<string>;
};

export function aboutPageValues(options: AboutOptions, current: Pick<PageInput, "title" | "slug" | "template" | "status" | "canonicalUrl" | "scheduledAt" | "seo">): PageInput {
  const media = (id: string) => (!options.availableMedia || options.availableMedia.has(id) ? id : null);
  return pageInputSchema.parse({
    ...current,
    seoTitle: "Về iOrder - Phần mềm, thiết bị và hạ tầng cho cửa hàng",
    seoDescription: "Công ty TNHH IORDER phát triển phần mềm quản lý bán hàng, cung cấp thiết bị và triển khai hạ tầng cho nhà hàng, cà phê, bán lẻ và chuỗi cửa hàng. Văn phòng tại TP.HCM và Đà Nẵng.",
    blocks: [
      { type: "hero", isEnabled: true, data: {
        eyebrow: "Về chúng tôi", title: aboutPageTitle,
        description: "iOrder phát triển phần mềm quản lý bán hàng, cung cấp thiết bị và triển khai hạ tầng ngay tại cửa hàng, để bán nhanh hơn, quản lý rõ hơn và mở rộng mà vẫn kiểm soát được.",
        primaryAction: action("Nhận tư vấn", "/contact"), secondaryAction: action("Xem sản phẩm", "/software"),
        mediaId: media(aboutMediaIds.hero), layout: "split",
        highlights: [
          { title: "Phần mềm bán hàng", note: "Nhà hàng, cà phê, bán lẻ và chuỗi" },
          { title: "Thiết bị và hạ tầng", note: "POS, máy in, mạng, camera" },
          { title: "Hỗ trợ triển khai", note: "Cài đặt, hướng dẫn, hỗ trợ từ xa" },
        ],
        footnote: "Dùng thử miễn phí 15 ngày", slides: [], extraMediaIds: [], tone: null, panels: [],
      } },
      { type: "media_text", isEnabled: true, data: {
        layout: "image_left", tone: "light", eyebrow: "Chúng tôi là ai", title: "Phần mềm gắn với cách cửa hàng vận hành mỗi ngày",
        description: "iOrder là nền tảng quản lý bán hàng dành cho chủ kinh doanh muốn nhìn rõ dữ liệu, giảm sai sót và mở rộng mà không đánh mất sự kiểm soát. Công ty TNHH IORDER vừa phát triển phần mềm, vừa cung cấp thiết bị và triển khai hạ tầng, nên phần mềm luôn bám sát cách cửa hàng vận hành thực tế.",
        bullets: ["POS tại quầy, gọi món, in bếp và thanh toán", "Tồn kho, khách hàng, nhân viên và phân quyền", "Báo cáo doanh thu theo thời gian thực"],
        mediaId: media(aboutMediaIds.posStation), extraMediaIds: [], primaryAction: null, secondaryAction: null,
      } },
      { type: "stats", isEnabled: true, data: {
        eyebrow: null, title: "iOrder trong một cái nhìn",
        items: [
          { value: "2", label: "Văn phòng", note: "TP. Hồ Chí Minh và Đà Nẵng" },
          { value: "3", label: "Nhóm giải pháp", note: "Phần mềm, thiết bị, hạ tầng" },
          { value: "15 ngày", label: "Dùng thử miễn phí", note: null },
          { value: "4", label: "Kênh hỗ trợ", note: "Hotline, Zalo, hỗ trợ từ xa, hướng dẫn trực tuyến" },
        ],
      } },
      { type: "features", isEnabled: true, appearance: { anchor: "dinh-huong" }, data: {
        cardStyle: "compact", eyebrow: "Định hướng", title: "Sứ mệnh, tầm nhìn và cam kết", description: null,
        items: [
          { title: "Sứ mệnh", icon: "target", href: null, description: "Giúp mọi cửa hàng vận hành gọn gàng hơn bằng công nghệ dễ dùng: sản phẩm được thiết kế theo công việc hằng ngày của thu ngân, phục vụ và người quản lý để nhân viên làm quen nhanh." },
          { title: "Tầm nhìn", icon: "rocket", href: null, description: "Trở thành đối tác công nghệ đáng tin cậy của cửa hàng Việt, từ cửa hàng đầu tiên đến chuỗi nhiều chi nhánh, với dữ liệu tập trung và quy trình thống nhất." },
          { title: "Cam kết", icon: "shield-check", href: null, description: "Triển khai được, dùng được và đo lường được: có hướng dẫn khi triển khai, có đội kỹ thuật hỗ trợ trong quá trình sử dụng và có số liệu rõ ràng để đánh giá hiệu quả." },
        ],
      } },
      { type: "features", isEnabled: true, appearance: { anchor: "cach-lam-viec" }, data: {
        cardStyle: "compact", eyebrow: "Điều làm iOrder khác biệt", title: "Bốn nguyên tắc trong mọi sản phẩm", description: "Bán hàng nhanh nhưng dữ liệu phải chính xác; mở thêm chi nhánh phải có quy trình thống nhất.",
        items: [
          { title: "Gắn với vận hành thực tế", icon: "store", href: null, description: "Không tách rời phần mềm khỏi cách cửa hàng bán hàng mỗi ngày, từ quầy, bếp đến kho." },
          { title: "Hai góc nhìn", icon: "users", href: null, description: "Thao tác đơn giản cho thu ngân và phục vụ; số liệu rõ ràng cho chủ cửa hàng và người quản lý." },
          { title: "Linh hoạt theo mô hình", icon: "settings", href: null, description: "Nhà hàng, cà phê, trà sữa, bán lẻ hay chuỗi cửa hàng: mỗi mô hình có nghiệp vụ riêng." },
          { title: "Đo lường được", icon: "chart-line", href: null, description: "Ưu tiên những gì triển khai được và dùng được ngay, kèm báo cáo để đánh giá hiệu quả." },
        ],
      } },
      { type: "features", isEnabled: true, appearance: { anchor: "he-sinh-thai" }, data: {
        cardStyle: "mosaic", eyebrow: "Hệ sinh thái iOrder", title: "Phần mềm, thiết bị và hạ tầng cho cửa hàng",
        description: "Chọn từng nhóm theo việc cần làm: bán hàng, kết nối thiết bị, lắp đặt hạ tầng hoặc nhận hỗ trợ kỹ thuật.",
        items: [
          { title: "Phần mềm", href: "/software", mediaId: media(aboutMediaIds.software), description: "Quản lý bán hàng iOrder\nBán hàng cho trạm dừng nghỉ\nQuản lý trạm sạc xe điện\nHóa đơn điện tử, chữ ký số" },
          { title: "Thiết bị bán hàng", href: "/equipment", mediaId: media(aboutMediaIds.equipment), description: "Máy POS, máy in hóa đơn, máy quét mã vạch và thiết bị hỗ trợ vận hành." },
          { title: "Giải pháp hạ tầng", href: "/solutions", mediaId: media(aboutMediaIds.network), description: "Mạng LAN, Wi-Fi, camera AI và giải pháp kết nối, giám sát." },
          { title: "Dịch vụ công nghệ", href: "/solutions", mediaId: media(aboutMediaIds.development), description: "Tư vấn, thiết kế, gia công và phát triển phần mềm theo yêu cầu." },
          { title: "Hỗ trợ khách hàng", href: "/support/setup", mediaId: media(aboutMediaIds.support), description: "Cài đặt, hướng dẫn sử dụng, bảo trì và hỗ trợ kỹ thuật." },
        ],
      } },
      { type: "process", isEnabled: true, appearance: { anchor: "dong-hanh" }, data: {
        eyebrow: "Đồng hành cùng cửa hàng", title: "Từ tư vấn đến vận hành ổn định", description: "Quy trình triển khai rõ ràng để cửa hàng bắt đầu nhanh và không bị gián đoạn khi đang kinh doanh.",
        items: [
          { title: "Tư vấn theo mô hình", href: "/contact", description: "Tìm hiểu mô hình kinh doanh và đề xuất cách bắt đầu phù hợp; dùng thử miễn phí 15 ngày." },
          { title: "Thiết lập và kết nối thiết bị", href: "/support/setup", description: "Tạo thực đơn hoặc danh mục hàng hóa, chi nhánh, phân quyền; kết nối máy POS, máy in và máy quét." },
          { title: "Hướng dẫn nhân viên", href: "/support/guides", description: "Hướng dẫn thu ngân, phục vụ và quản lý; nhân viên mới tự tra cứu trong trung tâm hướng dẫn sử dụng." },
          { title: "Hỗ trợ và mở rộng", href: "/support/remote", description: "Hỗ trợ kỹ thuật, kể cả từ xa; thêm chi nhánh, thiết bị và nhân viên khi cửa hàng lớn lên." },
        ],
      } },
      { type: "partners", isEnabled: true, data: { eyebrow: "Đối tác · Khách hàng", title: "Khách hàng và đối tác của iOrder", description: "Một số cửa hàng, doanh nghiệp và đối tác đang xuất hiện trong hệ sinh thái iOrder.", kind: "all", limit: 60 } },
      { type: "features", isEnabled: options.showCertificate, appearance: { anchor: "giay-chung-nhan" }, data: {
        cardStyle: "document", eyebrow: "Pháp lý và chứng nhận", title: "Giấy chứng nhận và giấy tờ pháp lý",
        description: "Các giấy chứng nhận do cơ quan nhà nước cấp cho iOrder và sản phẩm của chúng tôi. Bấm vào từng thẻ để xem bản chụp.",
        items: [{ title: "Giấy chứng nhận đăng ký quyền tác giả", description: "Số 0996/2026/QTG · Xem giấy chứng nhận", href: null, mediaId: options.certificateMediaId }],
      } },
      { type: "features", isEnabled: true, appearance: { anchor: "thong-tin-doanh-nghiep" }, data: {
        cardStyle: "compact", eyebrow: "Thông tin doanh nghiệp", title: "Thông tin pháp lý và liên hệ",
        description: "Thông tin đăng ký của công ty để đối tác và khách hàng đối chiếu khi ký kết và thanh toán.",
        items: [
          { title: "Tên công ty", icon: "building", href: null, description: "CÔNG TY TNHH IORDER\n(IORDER COMPANY LIMITED)" },
          { title: "Số đăng ký kinh doanh", icon: "briefcase", href: null, description: "0319027616, đăng ký ngày 27/06/2025" },
          { title: "Văn phòng Hồ Chí Minh", icon: "map-pin", href: null, description: "756A Âu Cơ, Phường Tân Bình, Thành phố Hồ Chí Minh" },
          { title: "Văn phòng Đà Nẵng", icon: "map-pin", href: null, description: "21 Phạm Nhữ Tăng, Phường Thanh Khê, Thành phố Đà Nẵng" },
          { title: "Hotline", icon: "headphones", href: null, description: "028 710 73 999\nKinh doanh: contact@iorder.vn\nHỗ trợ: support@iorder.vn" },
          { title: "Giờ làm việc", icon: "clock", href: null, description: "Thứ 2 - Thứ 6: 9:00 - 18:00" },
        ],
      } },
      { type: "cta", isEnabled: true, data: { id: null, eyebrow: "Cùng bắt đầu", title: "Sẵn sàng số hóa cửa hàng của bạn?", action: action("Nhận tư vấn miễn phí", "/contact") } },
    ],
  });
}
