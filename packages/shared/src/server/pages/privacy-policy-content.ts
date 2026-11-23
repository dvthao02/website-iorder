import type { RichDocument, RichNode } from "../shared/rich-text";

/**
 * Nội dung trang "Chính sách bảo mật" (slug `privacy-policy`, /privacy-policy), theo bản công bố tại https://app.iorder.vn/privacy-policy.
 * Giữ nguyên lời văn của bản gốc; chỉ chuẩn hóa dấu cách/dấu câu, sửa lỗi chính tả hiển nhiên ("rằng buộc" → "ràng buộc"),
 * tách các tiêu đề dài ở mục 2 thành tiêu đề ngắn + câu dẫn (để mục lục gọn, không đổi nghĩa) và định dạng lại phần liên hệ ở mục 5.
 * Bản gốc có vài câu diễn đạt chưa rõ nghĩa (mục 6); giữ nguyên để chủ sở hữu văn bản rà soát, không tự sửa nội dung pháp lý.
 */

const text = (value: string): RichNode => ({ type: "text", text: value });
const bold = (value: string): RichNode => ({ type: "text", text: value, marks: [{ type: "bold" }] });
const link = (value: string, href: string): RichNode => ({ type: "text", text: value, marks: [{ type: "link", attrs: { href, target: null } }] });

type Part = string | RichNode;
const parts = (items: Part[]): RichNode[] => items.map(item => typeof item === "string" ? text(item) : item);
const paragraph = (...items: Part[]): RichNode => ({ type: "paragraph", content: parts(items) });
const heading = (level: 2 | 3, value: string): RichNode => ({ type: "heading", attrs: { level }, content: [text(value)] });
const listItem = (item: Part | Part[]): RichNode => ({ type: "listItem", content: [paragraph(...(Array.isArray(item) ? item : [item]))] });
const bullets = (items: Array<Part | Part[]>): RichNode => ({ type: "bulletList", content: items.map(listItem) });
const numbered = (items: Array<Part | Part[]>): RichNode => ({ type: "orderedList", attrs: { start: 1 }, content: items.map(listItem) });

export const privacyPolicyDocument: RichDocument = {
  type: "doc",
  content: [
    paragraph("Công ty TNHH Công nghệ IOrder cam kết tôn trọng và bảo vệ thông tin cá nhân của khách hàng sử dụng ứng dụng và dịch vụ của chúng tôi. Việc truy cập và sử dụng IOrder đồng nghĩa với việc bạn đồng ý với các điều khoản trong Chính sách bảo mật này."),

    heading(2, "1. Mục đích và phạm vi thu thập"),
    paragraph("IOrder yêu cầu khách hàng cung cấp các thông tin cơ bản bao gồm: email, điện thoại, tên đăng nhập, mật khẩu đăng nhập, địa chỉ (khi đăng ký sử dụng dịch vụ của IOrder) và một số thông tin bắt buộc khác khi khách hàng muốn tương tác với một số nội dung trên website và ứng dụng IOrder."),
    paragraph("IOrder thu thập thông tin khách hàng cho các mục đích sau:"),
    bullets([
      "Đăng ký tài khoản và xác thực người dùng",
      "Cung cấp dịch vụ và hỗ trợ kỹ thuật",
      "Tăng cường trải nghiệm người dùng và cải thiện ứng dụng",
      "Đảm bảo quyền lợi của Khách hàng",
    ]),
    paragraph("Việc bạn truy cập, đăng ký, sử dụng IOrder có nghĩa rằng bạn đồng ý và chấp nhận ràng buộc bởi các quy định trong chính sách bảo mật của chúng tôi. Khách hàng sẽ tự chịu trách nhiệm về bảo mật và lưu giữ mọi hoạt động sử dụng dịch vụ dưới tên đăng ký, mật khẩu và hộp thư điện tử và/hoặc số điện thoại của mình. IOrder không chịu trách nhiệm liên đới về các thất thoát dữ liệu, bí mật thông tin của khách hàng do khách hàng vô tình hoặc cố ý gây ra."),
    paragraph("Ngoài ra, Khách hàng có trách nhiệm thông báo kịp thời cho IOrder về những hành vi sử dụng trái phép, lạm dụng, vi phạm bảo mật, lưu giữ tên đăng ký và mật khẩu của bên thứ ba để có biện pháp giải quyết phù hợp."),

    heading(2, "2. Dịch vụ, ứng dụng liên kết với IOrder"),
    paragraph("Để đảm bảo quyền lợi và trải nghiệm tốt nhất cho Khách hàng, IOrder áp dụng một số điều khoản riêng khi Khách hàng sử dụng các dịch vụ, ứng dụng do IOrder cung cấp hoặc có liên kết với IOrder:"),

    heading(3, "A. Ứng dụng IOrder trên Apple App Store hoặc Google Play"),
    paragraph("Đối với khách hàng sử dụng Ứng dụng IOrder từ Apple App Store hoặc GooglePlay, bạn hiểu và chấp nhận rằng IOrder có quyền:"),
    numbered([
      "Lấy vị trí hiện tại của bạn;",
      "Ghi dữ liệu của Ứng dụng IOrder lên thẻ nhớ;",
      "Truy cập vào Internet từ thiết bị của bạn.",
    ]),
    paragraph(bold("Lưu ý:"), " Tất cả các truy cập này chỉ được chúng tôi thực hiện khi có sự đồng ý của bạn. Bạn hiểu và chấp nhận rằng, khi bạn đã cấp quyền cho chúng tôi, bạn sẽ không có bất kỳ khiếu nại nào đối với việc truy cập này. Việc từ chối quyền có thể ảnh hưởng đến một số tính năng của IOrder."),

    heading(3, "B. Tài khoản Facebook liên kết với IOrder"),
    paragraph("Đối với tài khoản Facebook của Khách hàng khi liên kết IOrder, IOrder sẽ yêu cầu quyền truy cập các thông tin sau:"),
    numbered([
      "Quyền truy cập vào địa chỉ email của Trang (Fanpage) Facebook sử dụng để tích hợp với IOrder;",
      "Quyền truy cập vào tập hợp các mục công khai trên Trang Facebook đã tích hợp với IOrder;",
      "Cho phép truy cập vào tập hợp các mục công khai trên Tài khoản cá nhân của người dùng có tương tác với Trang Facebook tích hợp với IOrder;",
      "Cho phép gửi và nhận tin nhắn, bình luận trên Trang Facebook tích hợp với IOrder thông qua IOrder.",
    ]),

    heading(3, "C. Tài khoản Zalo liên kết với IOrder"),
    paragraph("Đối với tài khoản Zalo của Khách hàng khi liên kết với IOrder, IOrder sẽ yêu cầu quyền truy cập các thông tin sau:"),
    numbered([
      "Quyền truy cập vào ảnh đại diện, tên, ảnh bìa của tài khoản Zalo Official Account sử dụng để tích hợp với IOrder;",
      "Quyền truy cập vào thông tin tên, số điện thoại của tài khoản Zalo Official account sử dụng tích hợp với IOrder;",
      "Cho phép gửi và nhận tin nhắn từ tài khoản Zalo Official Account tích hợp với IOrder thông qua IOrder.",
    ]),

    heading(2, "3. Phạm vi sử dụng thông tin"),
    paragraph("IOrder sử dụng thông tin Khách hàng cung cấp để:"),
    bullets([
      "Cung cấp các dịch vụ đến Khách hàng.",
      "Gửi các thông báo về các hoạt động trao đổi thông tin giữa Khách hàng và đơn vị Hỗ trợ kĩ thuật của IOrder.",
      "Ngăn ngừa các hoạt động phá huỷ tài khoản của người dùng của Khách hàng hoặc các hoạt động giả mạo Khách hàng.",
      "Gửi các thông báo, khuyến mãi (chỉ khi có sự đồng ý của khách hàng).",
      "Liên lạc và giải quyết với khách hàng trong những trường hợp đặc biệt.",
      "IOrder có trách nhiệm hợp tác cung cấp thông tin cá nhân Khách hàng khi có yêu cầu từ cơ quan nhà nước có thẩm quyền.",
      "Chia sẻ dữ liệu với đối tác tích hợp hoặc bên thứ ba (chỉ khi có sự đồng ý của khách hàng).",
    ]),

    heading(2, "4. Thời gian lưu trữ thông tin"),
    paragraph("Trong mọi trường hợp thông tin cá nhân Khách hàng sẽ được bảo mật hoàn toàn trên máy chủ của IOrder. Khách hàng có quyền cập nhật, sửa đổi và xoá thông tin của các Dữ liệu cá nhân này. Tuy nhiên, trong một số trường hợp, IOrder vẫn có thể khôi phục những thông tin đó từ cơ sở dữ liệu của chúng tôi để giải quyết các tranh chấp, thi hành điều khoản, hay vì các yêu cầu kỹ thuật, pháp lý liên quan đến sự an toàn và những hoạt động của IOrder."),
    paragraph("Thông tin của Khách hàng được lưu trữ trên hệ thống bảo mật của IOrder và:"),
    bullets([
      "Được lưu trong suốt thời gian sử dụng của Dịch vụ",
      "Sau khi ngưng sử dụng dịch vụ, dữ liệu sẽ được lưu trữ tối đa 10 năm, trừ khi có yêu cầu khác từ Pháp luật hoặc vì lý do tranh chấp",
    ]),

    heading(2, "5. Địa chỉ của đơn vị thu thập, quản lý thông tin hỗ trợ Khách hàng"),
    paragraph(bold("Công ty TNHH Công nghệ IOrder")),
    bullets([
      "Địa chỉ: 756A Đ. Âu Cơ, Phường 14, Q. Tân Bình, TP.HCM",
      ["Hotline: ", link("028 710 73 999", "tel:02871073999")],
      ["Email: ", link("admin@iorder.vn", "mailto:admin@iorder.vn")],
    ]),
    paragraph("Chúng tôi có trách nhiệm tiếp nhận, xác minh và phản hồi mọi yêu cầu liên quan đến bảo mật thông tin."),

    heading(2, "6. Phương tiện và công cụ để Khách hàng tiếp cận và chỉnh sửa dữ liệu của mình"),
    paragraph("Khách hàng có quyền tự kiểm tra, cập nhật, điều chỉnh thông tin cá nhân của mình bằng cách đăng nhập vào tài khoản và chỉnh sửa thông tin cá nhân hoặc yêu cầu IOrder thực hiện việc này."),
    paragraph("Khách hàng có quyền gửi khiếu nại nếu phát hiện bị các nhân cho bên thứ ba đến Ban quản trị của IOrder. Khi tiếp nhận những phản hồi này, IOrder sẽ xác nhận lại thông tin, triệt để những trường hợp trả lời lý do và hướng dẫn Khách hàng khôi phục và bảo mật lại thông tin."),

    heading(2, "7. Cam kết bảo mật thông tin cá nhân Khách hàng"),
    paragraph("Thông tin của Khách hàng trên IOrder được IOrder cam kết bảo mật tuyệt đối theo chính sách bảo vệ thông tin cá nhân của IOrder. Việc thu thập và sử dụng thông tin của mỗi Khách hàng chỉ được thực hiện khi có sự đồng ý của Khách hàng đó, trừ những trường hợp pháp luật có quy định khác."),
    paragraph("IOrder cam kết:"),
    bullets([
      "Không sử dụng, không chuyển giao, cung cấp hay tiết lộ cho bên thứ ba về thông tin cá nhân của Khách hàng khi không có sự cho phép hoặc đồng ý từ Khách hàng, trừ những trường hợp theo quy định khác.",
      "Bảo mật tuyệt đối mọi thông tin giao dịch trực tuyến của Khách hàng bao gồm thông tin hóa đơn, chứng từ kế toán số hóa tại khu vực dữ liệu trung tâm an toàn của IOrder.",
      "Chủ động phòng tránh truy cập trái phép, tấn công dữ liệu và mất mát thông tin.",
    ]),

    heading(2, "8. Cập nhật chính sách"),
    paragraph("Chính sách này có thể được cập nhật theo thời gian. Chúng tôi sẽ thông báo rõ ràng thông qua ứng dụng hoặc website nếu có bất kỳ thay đổi nào. Việc tiếp tục sử dụng dịch vụ sau khi có thay đổi đồng nghĩa với việc bạn đã chấp thuận chính sách mới."),
  ],
};

/** Dòng "Cập nhật" ở phần đầu trang. */
export const privacyPolicyUpdatedAt = "17/11/2026";
export const privacyPolicyFootnote = `Cập nhật lần cuối: ${privacyPolicyUpdatedAt}`;
export const privacyPolicySeoDescription = "Chính sách bảo mật của iOrder: mục đích và phạm vi thu thập, thời gian lưu trữ, quyền của khách hàng và cam kết bảo mật thông tin cá nhân.";
export const privacyPolicyChangeNote = "Cập nhật chính sách bảo mật theo bản công bố trên app.iorder.vn";
