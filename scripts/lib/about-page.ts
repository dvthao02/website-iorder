import { pageInputSchema, type PageInput } from "../../packages/shared/src/server/pages/pages.contract";

// Nội dung trang "Về chúng tôi" (/about) cho scripts/rebuild-about-page.ts. Toàn bộ là khối CMS chuẩn (thư viện khối trong CMS › Trang tĩnh), website vẽ bằng đúng các
// thành phần dùng ở trang chủ và trang sản phẩm: không có bố cục riêng cho trang này. Phần nào có dữ liệu trong CMS thì lấy từ đó thay vì gõ lại:
//   - Phần mềm, giải pháp: khối "Danh sách nội dung" tự lấy các sản phẩm đã xuất bản ở CMS › Sản phẩm & Giải pháp;
//   - Logo khách hàng và đối tác: khối "Logo đối tác" lấy từ CMS › Đối tác & Đánh giá;
//   - Ảnh: thư viện media; nút "Liên hệ"/"Xem sản phẩm" dẫn tới trang đã có.
// Trang giữ gọn: mở đầu, hai hàng "Ảnh + chữ" xen kẽ tự động (chúng tôi là ai, sứ mệnh), logo đối tác, thông tin doanh nghiệp và lời kêu gọi liên hệ. Không nhắc lại danh sách sản phẩm,
// quy trình hay ảnh cửa hàng đã có ở trang chủ và trang sản phẩm; muốn thêm thì thêm khối trong CMS (ví dụ "Danh sách nội dung" tự lấy sản phẩm, hàng "Ảnh + chữ" có ô giữ chỗ ảnh).
// Còn lại là nội dung riêng của trang giới thiệu (người vận hành sửa trong CMS): lấy từ những gì iOrder đã công bố (trang chủ, nội dung giới thiệu V1, mục sứ mệnh cũ,
// giấy chứng nhận); không có số liệu về năm thành lập, số khách hàng hay nhân sự. Tầm nhìn là câu định hướng do người soạn đề xuất: người vận hành đọc lại trước khi giữ.
// Không dùng khối "Cảm nhận khách hàng": các đánh giá hiện có trong CMS là dữ liệu mẫu (ghi "Dữ liệu mẫu"), đưa lên trang công khai sẽ gây hiểu lầm.

// Tiêu đề phần mở đầu là dấu nhận biết "trang đã là bản này" của script (xem rebuild-about-page.ts); thêm --force để ghi đè khi chỉ đổi bố cục.
export const aboutPageTitle = "Đối tác công nghệ cho cửa hàng Việt";

// Ảnh dùng trong trang (đã có sẵn trong thư viện media của hệ thống đang chạy). Mã không còn trong thư viện thì script bỏ ảnh đó, trang vẫn lưu được.
export const aboutMediaIds = {
  // Quầy cà phê của khách hàng, bán hàng bằng iOrder.
  hero: "2304f978-1dd5-43ec-9e30-91db934955ff",
  // Nhân viên iOrder hướng dẫn thao tác trên màn hình bán hàng tại quầy pha chế của một khách hàng.
  onSite: "26ea1a69-01c0-4c65-a94f-f32c1a9e2dc1",
  // Máy POS, máy in và phần mềm iOrder tại quầy của một khách hàng.
  system: "8ea85cb4-1154-4552-8db8-4f1090ab1ee0",
} as const;

const action = (label: string, href: string) => ({ label, href });
// Chiều cao theo màn hình của các hàng xen kẽ: tối thiểu nửa vùng nhìn dưới đầu trang (máy tính), nội dung căn giữa theo chiều dọc. Đổi ở CMS › Bố cục khối › Chiều cao.
const rowHeight = { height: "half", verticalAlign: "center" } as const;

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
    seoTitle: "Về iOrder - Công ty TNHH IORDER, đối tác công nghệ cho cửa hàng",
    seoDescription: "Công ty TNHH IORDER phát triển phần mềm quản lý bán hàng, cung cấp thiết bị và triển khai hạ tầng cho nhà hàng, cà phê, bán lẻ và chuỗi cửa hàng. Văn phòng tại TP.HCM và Đà Nẵng.",
    blocks: [
      { type: "hero", isEnabled: true, appearance: { adminLabel: "01 · Mở đầu" }, data: {
        eyebrow: "Về chúng tôi", title: aboutPageTitle,
        description: "Công ty TNHH IORDER phát triển phần mềm quản lý bán hàng, cung cấp thiết bị và triển khai hạ tầng cho nhà hàng, quán cà phê, cửa hàng bán lẻ và chuỗi.",
        primaryAction: action("Liên hệ", "/contact"), secondaryAction: action("Xem sản phẩm", "/software"),
        mediaId: media(aboutMediaIds.hero), layout: "split", highlights: [], footnote: null, slides: [], extraMediaIds: [], tone: null, panels: [],
      } },
      // Hai hàng "Ảnh + chữ" xen kẽ tự động (ảnh trái rồi ảnh phải), đều có ảnh thật; chiều cao tối thiểu nửa màn hình (đổi ở CMS › Bố cục khối › Chiều cao).
      { type: "media_text", isEnabled: true, appearance: { anchor: "chung-toi-la-ai", adminLabel: "02 · Chúng tôi là ai", ...rowHeight }, data: {
        layout: "auto", tone: "light", eyebrow: "Chúng tôi là ai", title: "Làm công nghệ từ thực tế vận hành của cửa hàng",
        description: "iOrder dành cho chủ kinh doanh muốn nhìn rõ dữ liệu, giảm sai sót và mở rộng mà không đánh mất sự kiểm soát. Chúng tôi làm cả phần mềm, thiết bị lẫn hạ tầng ngay tại cửa hàng.",
        bullets: ["Phần mềm, thiết bị và hạ tầng từ một đầu mối", "Văn phòng tại TP. Hồ Chí Minh và Đà Nẵng"],
        mediaId: media(aboutMediaIds.onSite), extraMediaIds: [], primaryAction: null, secondaryAction: null,
      } },
      { type: "media_text", isEnabled: true, appearance: { anchor: "su-menh", adminLabel: "03 · Sứ mệnh và cam kết", ...rowHeight }, data: {
        layout: "auto", tone: "tinted", eyebrow: "Sứ mệnh", title: "Công nghệ dễ dùng cho mọi cửa hàng",
        description: "Sản phẩm được thiết kế theo công việc hằng ngày của thu ngân, phục vụ và người quản lý để nhân viên làm quen nhanh, kèm đội kỹ thuật hỗ trợ từ lúc triển khai đến khi vận hành.",
        bullets: ["Thao tác rõ ràng, ít sai sót", "Hướng dẫn và hỗ trợ kỹ thuật, kể cả từ xa", "Báo cáo để đánh giá hiệu quả"],
        mediaId: media(aboutMediaIds.system), extraMediaIds: [], primaryAction: null, secondaryAction: null,
      } },
      // Logo lấy từ CMS › Đối tác & Đánh giá.
      { type: "partners", isEnabled: true, appearance: { anchor: "doi-tac", adminLabel: "04 · Logo đối tác (tự lấy từ CMS)" }, data: { eyebrow: "Đối tác · Khách hàng", title: "Khách hàng và đối tác của iOrder", description: null, kind: "all", limit: 60 } },
      { type: "features", isEnabled: true, appearance: { anchor: "phap-ly", adminLabel: "05 · Thông tin doanh nghiệp" }, data: {
        cardStyle: "compact", eyebrow: "Pháp lý và văn phòng", title: "Thông tin doanh nghiệp", description: null,
        items: [
          { title: "Pháp nhân", icon: "building", href: null, description: "CÔNG TY TNHH IORDER\n(IORDER COMPANY LIMITED)\nSố ĐKKD 0319027616, đăng ký ngày 27/06/2025" },
          { title: "Văn phòng Hồ Chí Minh", icon: "map-pin", href: "/contact", description: "756A Âu Cơ, Phường Tân Bình, Thành phố Hồ Chí Minh" },
          { title: "Văn phòng Đà Nẵng", icon: "map-pin", href: "/contact", description: "21 Phạm Nhữ Tăng, Phường Thanh Khê, Thành phố Đà Nẵng" },
        ],
      } },
      { type: "features", isEnabled: options.showCertificate, appearance: { anchor: "giay-chung-nhan", adminLabel: "06 · Giấy chứng nhận" }, data: {
        cardStyle: "document", eyebrow: "Chứng nhận", title: "Giấy chứng nhận và giấy tờ pháp lý", description: null,
        items: [{ title: "Giấy chứng nhận đăng ký quyền tác giả", description: "Số 0996/2026/QTG · Xem giấy chứng nhận", href: null, mediaId: options.certificateMediaId }],
      } },
      { type: "cta", isEnabled: true, appearance: { adminLabel: "07 · Kêu gọi liên hệ" }, data: { id: null, eyebrow: "Liên hệ", title: "Cần trao đổi cùng đội ngũ iOrder?", action: action("Liên hệ với chúng tôi", "/contact") } },
    ],
  });
}
