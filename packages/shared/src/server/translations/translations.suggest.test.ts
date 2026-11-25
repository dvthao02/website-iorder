import assert from "node:assert/strict";
import test from "node:test";

import { isTranslationGroupId, parseGroupSelection, postGroupId, translationGroupIds, translationGroups } from "./translations.groups";
import { adaptTranslation, createSuggester, foldSentence } from "./translations.suggest";

test("So sánh câu: bỏ hoa/thường, dấu câu cuối và khoảng trắng thừa, giữ nguyên dấu tiếng Việt", () => {
  assert.equal(foldSentence("Trang Chủ"), foldSentence("trang chủ"));
  assert.equal(foldSentence("Xem thêm,"), foldSentence("Xem thêm"));
  assert.equal(foldSentence("Email:"), foldSentence("Email"));
  assert.equal(foldSentence("Chức  năng :"), foldSentence("Chức năng"));
  assert.notEqual(foldSentence("Chu"), foldSentence("Chủ"), "khác dấu là câu khác");
  assert.notEqual(foldSentence("Liên hệ"), foldSentence("Liên hệ ngay"));
});

test("Đưa bản dịch về dạng của câu mới: dấu câu cuối, chữ cái đầu hoa/thường, câu viết hoa toàn bộ", () => {
  assert.equal(adaptTranslation("Xem thêm,", "Xem thêm", "View more"), "View more,");
  assert.equal(adaptTranslation("Email", "Email:", "Email:"), "Email");
  assert.equal(adaptTranslation("gửi yêu cầu hỗ trợ", "Gửi yêu cầu hỗ trợ", "Submit a support request"), "submit a support request");
  assert.equal(adaptTranslation("Trang chủ", "trang chủ", "home page"), "Home page");
  assert.equal(adaptTranslation("LIÊN HỆ", "Liên hệ", "Contact"), "CONTACT");
  assert.equal(adaptTranslation("Chức năng:", "Chức năng", "Features"), "Features:");
  // Bản dịch viết hoa có chủ ý (tên riêng, viết tắt) không bị hạ chữ.
  assert.equal(adaptTranslation("hóa đơn", "Hóa đơn", "VAT invoice"), "VAT invoice");
  assert.equal(adaptTranslation("quét qr", "Quét QR", "QR scan"), "QR scan");
  assert.equal(adaptTranslation("hóa đơn", "Hóa đơn", "Invoice"), "invoice");
  // Câu giống hệt: giữ nguyên, kể cả dấu câu trong bản dịch.
  assert.equal(adaptTranslation("Mã / quy cách:", "Mã / quy cách:", "Model / spec:"), "Model / spec:");
});

test("Bảng gợi ý: tìm theo dạng so sánh, ưu tiên bản dịch dùng nhiều nhất, không có câu giống thì không gợi ý", () => {
  const suggest = createSuggester([
    { text: "Trang Chủ", value: "Home" },
    { text: "Xem thêm", value: "See more" },
    { text: "xem thêm", value: "See more" },
    { text: "Xem thêm.", value: "Read more" },
  ]);
  assert.deepEqual(suggest("Trang chủ"), { value: "Home", from: "Trang Chủ" });
  assert.equal(suggest("Xem thêm,")?.value, "See more,", "hai nguồn cùng một bản dịch thắng nguồn chỉ có một");
  assert.equal(suggest("Liên hệ"), undefined);
  assert.equal(createSuggester([{ text: "Rỗng", value: "  " }])("Rỗng"), undefined, "bản dịch rỗng không làm nguồn");
});

test("Vùng nội dung: mã vùng hợp lệ, loại bài viết ánh xạ đúng và loại lạ rơi vào 'other', danh sách ?groups= đọc chặt", () => {
  assert.equal(new Set(translationGroupIds).size, translationGroupIds.length, "không trùng mã vùng");
  assert.ok(translationGroups.every((group) => group.label.trim().length > 0));
  assert.deepEqual(["news", "promotion", "case_study", "announcement", "guide", "moi-loai"].map(postGroupId), ["news", "promotion", "case-study", "announcement", "guide", "other"]);
  assert.equal(isTranslationGroupId("ui"), true);
  assert.equal(isTranslationGroupId("case_study"), false);
  assert.deepEqual(parseGroupSelection("ui, pages ,ui"), ["ui", "pages"]);
  assert.deepEqual(parseGroupSelection(""), [...translationGroupIds], "rỗng nghĩa là mọi vùng");
  assert.deepEqual(parseGroupSelection(null), [...translationGroupIds]);
  assert.equal(parseGroupSelection("ui,khong-co"), null, "mã lạ thì báo lỗi thay vì bỏ qua âm thầm");
});
