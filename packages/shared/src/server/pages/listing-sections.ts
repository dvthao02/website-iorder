import type { z } from "zod";

import type { BlockIcon } from "../shared/block-icons";
import { pageBlockInputSchema, type ListingPageSlug } from "./pages.contract";

type BlockInput = z.input<typeof pageBlockInputSchema>;

/**
 * Các phần nội dung dựng sẵn cho các trang danh sách KHÔNG có mục con cùng kiểu: Thiết bị, Hướng dẫn, Hỗ trợ cài đặt. Xếp sau khối danh sách,
 * là khối trang bình thường: người vận hành sửa, tắt, sắp xếp lại hoặc xóa trong CMS › Trang website.
 *
 * Trang có mục con (Phần mềm, Giải pháp, Dịch vụ) KHÔNG nằm ở đây: nội dung của chúng sinh từ chính từng mục con, xem catalog-sections.ts.
 *
 * Nội dung bám dữ liệu thật đang có trong CMS: thông số từng thiết bị (CMS › Thiết bị), tên và đường dẫn các bài hướng dẫn, trang Hỗ trợ từ xa.
 * Thời hạn bảo hành ghi theo dữ liệu hiện có nên cần cập nhật khi dữ liệu đổi. Phần gợi ý ghép thiết bị theo mô hình và các bước
 * là cách diễn đạt của bản nháp, cần người vận hành xác nhận.
 *
 * Trang Thiết bị không có dải tư vấn tự động (khác các trang có mục con) nên có khối cta riêng.
 */
const card = (title: string, description: string, icon: BlockIcon, href: string | null = null) => ({ title, description, href, icon });
const step = (title: string, description: string, href: string | null = null) => ({ title, description, href });
const qa = (question: string, answer: string) => ({ question, answer });
const entry = (label: string, icon: BlockIcon, href: string | null = null) => ({ label, icon, href });

/** Đường dẫn bài hướng dẫn (CMS › Bài viết, loại Hướng dẫn). */
const guide = (slug: string) => `/ho-tro/huong-dan/${slug}`;
const device = (slug: string) => `/thiet-bi/${slug}`;

export const defaultListingSections: Partial<Record<ListingPageSlug, BlockInput[]>> = {
  // ───────────── /thiet-bi ─────────────
  "listing-equipment": [
    {
      type: "grouped_list", isEnabled: true, appearance: { anchor: "chon-theo-mo-hinh" },
      data: {
        eyebrow: "Chọn theo mô hình", title: "Bộ thiết bị gợi ý cho từng mô hình bán hàng",
        description: "Gợi ý ghép các thiết bị trong danh mục; iOrder tư vấn cấu hình cụ thể theo mặt bằng và cách bán của bạn.",
        groupLabel: "Mô hình", showCount: true,
        groups: [
          {
            title: "Quán cà phê, trà sữa", icon: "cup-soda",
            items: [
              entry("Máy in tem nhãn PD304: tem dán ly, tem mã vạch", "printer", device("may-in-tem-nhan-pd304")),
              entry("Máy in hóa đơn nhiệt 80mm: hóa đơn, phiếu bếp/bar", "receipt", device("may-in-hoa-don-nhiet-80mm")),
              entry("Két đựng tiền: tự mở khi in hóa đơn", "wallet", device("ket-dung-tien")),
            ],
            action: { label: "Tư vấn cấu hình", href: "/lien-he" },
          },
          {
            title: "Nhà hàng, quán ăn", icon: "utensils",
            items: [
              entry("Máy POS mini cầm tay: gọi món tại bàn, thanh toán ngay", "smartphone", device("may-pos-mini-cam-tay")),
              entry("Máy in hóa đơn nhiệt 80mm: in hóa đơn, báo bếp", "receipt", device("may-in-hoa-don-nhiet-80mm")),
              entry("Két đựng tiền: 5 ngăn giấy, 4 ngăn xu", "wallet", device("ket-dung-tien")),
            ],
            action: { label: "Tư vấn cấu hình", href: "/lien-he" },
          },
          {
            title: "Cửa hàng bán lẻ", icon: "store",
            items: [
              entry("Máy quét mã vạch: 1D, 2D, QR", "scan-barcode", device("may-quet-ma-vach")),
              entry("Máy in hóa đơn nhiệt 80mm: 250 mm/giây, tự cắt giấy", "receipt", device("may-in-hoa-don-nhiet-80mm")),
              entry("Két đựng tiền: thép sơn tĩnh điện", "wallet", device("ket-dung-tien")),
            ],
            action: { label: "Tư vấn cấu hình", href: "/lien-he" },
          },
        ],
      },
    },
    {
      type: "features", isEnabled: true, appearance: { anchor: "vi-sao-chon" },
      data: {
        eyebrow: "Mua thiết bị tại iOrder", title: "Không chỉ bán máy, iOrder lo trọn bộ",
        description: null,
        items: [
          card("Đã kiểm thử với iOrder", "Máy POS, máy in, máy quét và phụ kiện đều đã được kiểm thử với phần mềm iOrder.", "circle-check"),
          card("Bảo hành rõ ràng", "Thời gian bảo hành ghi ngay trên trang từng thiết bị; hiện các thiết bị trong danh mục bảo hành 12 tháng.", "shield-check"),
          card("Tư vấn cấu hình", "iOrder tư vấn cấu hình theo mô hình bán hàng của bạn trước khi mua.", "headphones"),
          card("Giao máy và cài đặt", "Giao máy, cài đặt và hướng dẫn sử dụng tại cửa hàng.", "truck"),
        ],
      },
    },
    {
      type: "process", isEnabled: true, appearance: { anchor: "quy-trinh" },
      data: {
        eyebrow: "Quy trình", title: "Từ chọn thiết bị đến bán hàng", description: null,
        items: [
          step("Chọn thiết bị", "Xem thông số, giá và thời gian bảo hành ngay trong danh mục."),
          step("Tư vấn cấu hình", "iOrder tư vấn bộ thiết bị phù hợp mô hình bán hàng."),
          step("Giao máy và cài đặt", "Giao máy, cài đặt và kết nối với phần mềm iOrder tại cửa hàng."),
          step("Hướng dẫn sử dụng", "Hướng dẫn nhân viên thao tác; bài hướng dẫn kết nối máy in có sẵn trong mục Hỗ trợ.", guide("huong-dan-cai-dat-may-in-hoa-don")),
        ],
      },
    },
    {
      type: "faq", isEnabled: true, appearance: { anchor: "hoi-dap" },
      data: {
        eyebrow: "Hỏi đáp", title: "Câu hỏi thường gặp về thiết bị",
        items: [
          qa("Máy in tem nhãn PD304 dùng để làm gì?", "In tem trà sữa, tem dán ly, tem mã vạch (barcode), QR Code và tem giá sản phẩm bằng in nhiệt, kết nối qua dây LAN hoặc USB."),
          qa("Máy POS mini cầm tay phù hợp khi nào?", "Khi cần gọi món tại bàn và thanh toán ngay tại chỗ: màn hình cảm ứng 5.5 inch, pin 5000 mAh, máy in tích hợp khổ 58mm, kết nối Wi-Fi, 4G và Bluetooth."),
          qa("Máy in hóa đơn nhiệt 80mm in nhanh cỡ nào?", "Khổ giấy 80mm, tốc độ 250 mm/giây, tự cắt giấy; kết nối USB và LAN, dùng cho in hóa đơn và in bếp."),
          qa("Máy quét mã vạch đọc được loại mã nào?", "Mã 1D, 2D và QR, trên giấy lẫn màn hình điện thoại; kết nối USB, dùng cầm tay hoặc tự động."),
          qa("Két đựng tiền hoạt động thế nào?", "Két có 5 ngăn tiền giấy và 4 ngăn tiền xu, kết nối RJ11 qua máy in và tự mở khi in hóa đơn."),
          qa("Thiết bị có bảo hành không?", "Có. Thời gian bảo hành được ghi rõ trên trang của từng thiết bị."),
          qa("Thiết bị có dùng được với phần mềm iOrder không?", "Các thiết bị trong danh mục đã được kiểm thử với phần mềm iOrder."),
          qa("Ai lắp đặt và cài đặt thiết bị?", "iOrder tư vấn cấu hình, giao máy, cài đặt và hướng dẫn sử dụng tại cửa hàng."),
        ],
      },
    },
    {
      type: "cta", isEnabled: true,
      data: { id: null, eyebrow: "Tư vấn", title: "Cần tư vấn chọn thiết bị?", action: { label: "Liên hệ mua hàng", href: "/lien-he" } },
    },
  ],

  // ───────────── /ho-tro/huong-dan ─────────────
  "listing-guides": [
    {
      type: "process", isEnabled: true, appearance: { anchor: "bat-dau" },
      data: {
        eyebrow: "Mới bắt đầu", title: "Nên đọc theo thứ tự nào", description: "Năm bài nền tảng để thiết lập và bán hàng ngày đầu tiên.",
        items: [
          step("Sản phẩm", "Tạo danh mục hàng hóa, dịch vụ và combo.", guide("san-pham")),
          step("Nhân viên", "Thêm nhân viên và gán vai trò.", guide("nhan-vien")),
          step("Bán hàng", "Thao tác trên màn hình bán hàng, thanh toán.", guide("ban-hang")),
          step("Kết ca và thu chi", "Chốt ca, ghi nhận tiền vào và tiền ra.", guide("ket-ca")),
          step("Báo cáo", "Xem doanh thu theo ngày, ca, nhân viên và món bán chạy.", guide("bao-cao")),
        ],
      },
    },
    {
      type: "features", isEnabled: true, appearance: { anchor: "can-ho-tro" },
      data: {
        eyebrow: "Cần hỗ trợ thêm", title: "Chưa tìm thấy điều bạn cần?",
        description: null,
        items: [
          card("Hỗ trợ cài đặt", "Tải driver, công cụ cài đặt và xem cách kết nối máy in.", "wrench", "/ho-tro/cai-dat"),
          card("Hỗ trợ từ xa", "Kỹ thuật viên kết nối vào máy để xử lý giúp bạn.", "headphones", "/ho-tro-tu-xa"),
          card("Gửi yêu cầu hỗ trợ", "Để lại thông tin, iOrder liên hệ lại trong giờ làm việc.", "users", "/lien-he"),
        ],
      },
    },
  ],

  // ───────────── /ho-tro/cai-dat ─────────────
  "listing-support": [
    {
      type: "process", isEnabled: true, appearance: { anchor: "cai-may-in" },
      data: {
        eyebrow: "Hướng dẫn nhanh", title: "Kết nối máy in hóa đơn trong ba bước",
        description: "iOrder hỗ trợ máy in nhiệt khổ 58mm và 80mm, kết nối qua USB, LAN hoặc Bluetooth.",
        items: [
          step("Cài driver", "Tải driver đúng dòng máy ở danh sách Tệp cài đặt và cài như phần mềm thông thường."),
          step("Thêm máy in trong iOrder", "Vào Thiết lập → Máy in → Thêm máy in, rồi chọn kiểu kết nối và khổ giấy."),
          step("In thử", "Bấm In thử để kiểm tra trước khi bán hàng.", guide("huong-dan-cai-dat-may-in-hoa-don")),
        ],
      },
    },
    {
      type: "features", isEnabled: true, appearance: { anchor: "can-ho-tro" },
      data: {
        eyebrow: "Cần hỗ trợ thêm", title: "Chưa tự cài được? Chọn cách nhận hỗ trợ",
        description: null,
        items: [
          card("Hướng dẫn sử dụng", "Cách dùng từng phần của iOrder: bán hàng, kho, hóa đơn, kết ca, báo cáo.", "book", "/ho-tro/huong-dan"),
          card("Hỗ trợ từ xa", "Kỹ thuật viên kết nối vào máy để xử lý giúp bạn.", "headphones", "/ho-tro-tu-xa"),
          card("Gửi yêu cầu hỗ trợ", "Để lại thông tin, iOrder liên hệ lại trong giờ làm việc.", "users", "/lien-he"),
        ],
      },
    },
    {
      type: "faq", isEnabled: true, appearance: { anchor: "hoi-dap" },
      data: {
        eyebrow: "Hỏi đáp", title: "Câu hỏi thường gặp khi cài đặt",
        items: [
          qa("iOrder hỗ trợ những máy in nào?", "Máy in nhiệt khổ 58mm và 80mm, kết nối qua USB, LAN và Bluetooth."),
          qa("Tôi tải driver ở đâu?", "Driver và công cụ cài đặt được đăng trong danh sách Tệp cài đặt ở trên. Nếu chưa thấy tệp phù hợp với máy của bạn, hãy liên hệ hỗ trợ."),
          qa("Cài xong làm sao biết máy in chạy đúng?", "Trong iOrder, vào Thiết lập → Máy in và bấm In thử. Nếu bản in ra đúng, máy đã sẵn sàng bán hàng."),
          qa("Tự cài không được thì làm thế nào?", "Bạn có thể nhờ kỹ thuật viên iOrder kết nối từ xa vào máy để xử lý, hoặc gửi yêu cầu để được liên hệ lại trong giờ làm việc."),
        ],
      },
    },
  ],
};

/** Khối "đầu trang" và "danh sách" của trang danh sách; mọi khối khác coi là người vận hành đã chỉnh trang. */
export const listingBaseBlockTypes: ReadonlyArray<string> = ["hero", "collection_list"];

/**
 * Ghi chú phiên bản lưu bởi lệnh seed. Bản lưu gần nhất của trang mang ghi chú này nghĩa là chưa ai sửa trang kể từ lần seed,
 * nên lệnh được phép thay các phần dựng sẵn cũ bằng bản mới; ghi chú khác (người vận hành đã lưu) thì giữ nguyên trang.
 * - `listingSectionsNote`: trang Thiết bị / Hướng dẫn / Hỗ trợ cài đặt (nội dung ở file này).
 * - `catalogSectionsNote`: trang Phần mềm / Giải pháp / Dịch vụ (sinh từ các mục con, catalog-sections.ts).
 * Mỗi bản cũ giữ lại ghi chú trong `legacy…` để nhận ra và thay được.
 */
export const listingSectionsNote = "Thêm các phần nội dung dựng sẵn cho trang danh sách (bản chi tiết theo từng trang)";
export const legacyListingSectionsNotes: ReadonlyArray<string> = ["Thêm các phần nội dung dựng sẵn cho trang danh sách"];
export const catalogSectionsNote = "Tạo phần nội dung của trang cha từ các mục con (mỗi phần mềm, giải pháp, dịch vụ một phần)";
export const legacyCatalogSectionsNotes: ReadonlyArray<string> = [...legacyListingSectionsNotes, listingSectionsNote];
