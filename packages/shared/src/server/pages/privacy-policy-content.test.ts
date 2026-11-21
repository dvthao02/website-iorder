import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeRichDocument, type RichDocument, type RichNode } from "../shared/rich-text";
import { privacyPolicyChangeNote, privacyPolicyDocument, privacyPolicyFootnote, privacyPolicySeoDescription } from "./privacy-policy-content";

function texts(node: RichNode | RichDocument): string[] {
  if ("text" in node) return [node.text];
  return ("content" in node ? node.content ?? [] : []).flatMap(texts);
}
const allText = () => texts(privacyPolicyDocument).join("\n");
const headings = (level: number) => privacyPolicyDocument.content.flatMap(node => node.type === "heading" && node.attrs.level === level ? [texts(node).join("")] : []);

test("nội dung qua được bộ lọc tài liệu của CMS (chỉ khối, định dạng và liên kết cho phép)", () => {
  const clean = sanitizeRichDocument(privacyPolicyDocument);
  assert.equal(clean.type, "doc");
  assert.equal(clean.content.length, privacyPolicyDocument.content.length);
});

test("đủ tám mục đánh số liên tục và ba mục con A, B, C trong mục 2", () => {
  assert.deepEqual(headings(2).map(title => title.split(".")[0]), ["1", "2", "3", "4", "5", "6", "7", "8"]);
  assert.deepEqual(headings(3).map(title => title.slice(0, 2)), ["A.", "B.", "C."]);
  assert.equal(headings(2)[7], "8. Cập nhật chính sách");
});

test("giữ các điểm then chốt của bản gốc về thu thập, lưu trữ, quyền khách hàng và cam kết", () => {
  const text = allText();
  for (const phrase of [
    "Công ty TNHH Công nghệ IOrder cam kết tôn trọng và bảo vệ thông tin cá nhân",
    "email, điện thoại, tên đăng nhập, mật khẩu đăng nhập, địa chỉ",
    "Zalo Official Account", "Trang (Fanpage) Facebook", "Lấy vị trí hiện tại của bạn",
    "tối đa 10 năm", "cơ quan nhà nước có thẩm quyền", "chỉ khi có sự đồng ý của khách hàng",
    "Khách hàng có quyền tự kiểm tra, cập nhật, điều chỉnh thông tin cá nhân",
    "Không sử dụng, không chuyển giao, cung cấp hay tiết lộ cho bên thứ ba",
    "Việc tiếp tục sử dụng dịch vụ sau khi có thay đổi đồng nghĩa với việc bạn đã chấp thuận chính sách mới.",
  ]) assert.ok(text.includes(phrase), phrase);
});

test("thông tin liên hệ ở mục 5 có địa chỉ, hotline và email dưới dạng liên kết bấm được", () => {
  const text = allText();
  assert.ok(text.includes("756A Đ. Âu Cơ, Phường 14, Q. Tân Bình, TP.HCM"));
  const links = JSON.stringify(privacyPolicyDocument).match(/"href":"[^"]+"/g) ?? [];
  assert.deepEqual(links, ['"href":"tel:02871073999"', '"href":"mailto:admin@iorder.vn"']);
});

test("văn bản sạch: không dấu cách thừa, không lỗi chính tả hiển nhiên của bản gốc, không còn chữ dữ liệu mẫu", () => {
  const text = allText();
  assert.ok(!/ {2,}/.test(text), "dấu cách kép");
  assert.ok(!/\( | \)/.test(text), "dấu cách trong ngoặc");
  assert.ok(!text.includes("rằng buộc"));
  assert.ok(!/Ã´|áº¡/.test(text), "lỗi mã hóa");
  assert.ok(!/mẫu/i.test(`${privacyPolicyFootnote} ${privacyPolicySeoDescription}`));
  for (const piece of texts(privacyPolicyDocument)) {
    // Dấu cách có chủ ý: câu liền sau "Lưu ý:" in đậm, và nhãn "Hotline: " / "Email: " đứng trước liên kết.
    if (piece.startsWith(" Tất cả các truy cập") || /^(Hotline|Email): $/.test(piece)) continue;
    assert.equal(piece, piece.trim(), piece.slice(0, 40));
  }
});

test("dòng cập nhật, mô tả SEO và ghi chú phiên bản đúng giới hạn của trang", () => {
  assert.match(privacyPolicyFootnote, /^Cập nhật lần cuối: \d{2}\/\d{2}\/\d{4}$/);
  assert.ok(privacyPolicyFootnote.length <= 220);
  assert.ok(privacyPolicySeoDescription.length <= 180);
  assert.ok(privacyPolicyChangeNote.length <= 500);
});
