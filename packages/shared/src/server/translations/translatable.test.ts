import assert from "node:assert/strict";
import test from "node:test";

import { defaultEnabledLocales, defaultLocale, findTranslationLocale, isSiteLocale, isTranslationLocale, localeTags, siteLocaleName, sortLocaleCodes, translationLocales } from "./locales";
import { isTranslatableText, mapTranslatable, sourceKey, splitUnit } from "./translatable";

const dictionary = (entries: Record<string, string>) => (core: string) => entries[core];

test("Chỉ trường chữ được dịch: tiêu đề, mô tả, nhãn đổi; đường dẫn, slug, mã, kiểu khối giữ nguyên", () => {
  const block = { type: "hero", data: { title: "Phần mềm bán hàng", description: "Dễ dùng", href: "/software", slug: "phan-mem", icon: "book", layout: "split", mediaId: "d314550e-a8be-4631-901e-2e69acdde895" } };
  const result = mapTranslatable(block, dictionary({ "Phần mềm bán hàng": "Sales software", "Dễ dùng": "Easy to use", "/software": "KHÔNG ĐƯỢC ĐỔI", "phan-mem": "KHÔNG ĐƯỢC ĐỔI", book: "KHÔNG ĐƯỢC ĐỔI", split: "KHÔNG ĐƯỢC ĐỔI" }));
  assert.deepEqual(result, { type: "hero", data: { title: "Sales software", description: "Easy to use", href: "/software", slug: "phan-mem", icon: "book", layout: "split", mediaId: "d314550e-a8be-4631-901e-2e69acdde895" } });
});

test("Mảng kế thừa tên trường của cha: danh sách chữ và hỏi đáp dạng [hỏi, đáp] đều được dịch", () => {
  const body = { bullets: ["Gọi món bằng QR", "Báo cáo"], faq: [["Có dùng thử không?", "Có, 15 ngày."]], extraMediaIds: ["Không dịch được"] };
  const result = mapTranslatable(body, dictionary({ "Gọi món bằng QR": "QR ordering", "Báo cáo": "Reports", "Có dùng thử không?": "Is there a trial?", "Có, 15 ngày.": "Yes, 15 days.", "Không dịch được": "ĐỔI SAI" }));
  assert.deepEqual(result, { bullets: ["QR ordering", "Reports"], faq: [["Is there a trial?", "Yes, 15 days."]], extraMediaIds: ["Không dịch được"] });
});

test("Chuỗi không phải chữ người đọc không bao giờ vào danh sách dịch (đường dẫn, email, mã, tên tệp, số điện thoại)", () => {
  for (const text of ["/support/guides", "https://iorder.vn", "mailto:a@b.vn", "#tu-van", "support@iorder.vn", "028 710 73 999", "913d4a21-3cd9-4d3f-b26c-ad76fa11a540", "logo.png", "x", "", "   "]) assert.equal(isTranslatableText(text), false, JSON.stringify(text));
  for (const text of ["Có", "Xem thêm", "iOrder.vn", "Đà Nẵng: 21 Phạm Nhữ Tăng"]) assert.equal(isTranslatableText(text), true, text);
  // Đơn vị giá bắt đầu bằng "/" ("/Năm", "/3 Năm") là chữ người đọc thấy, không phải đường dẫn: có chữ có dấu hoặc khoảng trắng.
  for (const text of ["/Năm", "/3 Năm", "/tháng cho mỗi cửa hàng", "#Phổ biến"]) assert.equal(isTranslatableText(text), true, text);
  for (const text of ["/support/guides/ban-hang", "/media/uploads/a-b_c.png?x=1&y=2", "#phan-noi-dung-2", "/en/news#top"]) assert.equal(isTranslatableText(text), false, text);
  const seen: string[] = [];
  mapTranslatable({ title: "https://iorder.vn", label: "028 710 73 999", name: "Hóa đơn" }, (core) => { seen.push(core); return undefined; });
  assert.deepEqual(seen, ["Hóa đơn"]);
});

test("Khoảng trắng đầu/cuối được giữ: bản dịch gắn lại đúng chỗ, khóa không phụ thuộc khoảng trắng", () => {
  assert.deepEqual(splitUnit("  Bấm Lưu \n"), { lead: "  ", core: "Bấm Lưu", trail: " \n" });
  const result = mapTranslatable({ text: " và báo cáo " }, dictionary({ "và báo cáo": "and reports" }));
  assert.deepEqual(result, { text: " and reports " });
  assert.equal(sourceKey("Xem thêm"), sourceKey("Xem thêm"));
  assert.notEqual(sourceKey("Xem thêm"), sourceKey("Xem Thêm"));
  assert.match(sourceKey("Xem thêm"), /^[0-9a-f]{16}$/);
  // Cùng chữ dạng dựng sẵn và dạng tổ hợp (nhập từ Word/Mac) cho cùng một khóa.
  assert.equal(sourceKey("Tiếng Việt".normalize("NFC")), sourceKey("Tiếng Việt".normalize("NFD")));
});

test("Bài viết: đoạn chỉ có chữ trơn được dịch cả đoạn; đoạn có đậm/liên kết thì dịch từng mảnh và giữ nguyên định dạng", () => {
  const doc = { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Chọn " }, { type: "text", text: "Lưu thay đổi" }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Giới thiệu" }] },
    { type: "paragraph", content: [{ type: "text", text: "Bấm " }, { type: "text", text: "Lưu", marks: [{ type: "bold" }] }, { type: "text", text: " để hoàn tất" }] },
    { type: "image", attrs: { src: "/media/uploads/a.png", alt: "Màn hình bán hàng" } },
  ] };
  const result = mapTranslatable(doc, dictionary({
    "Chọn Lưu thay đổi": "Choose Save changes", "Giới thiệu": "Introduction", "Bấm": "Click", "Lưu": "Save", "để hoàn tất": "to finish", "Màn hình bán hàng": "Sales screen",
  }));
  assert.deepEqual(result, { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Choose Save changes" }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Introduction" }] },
    { type: "paragraph", content: [{ type: "text", text: "Click " }, { type: "text", text: "Save", marks: [{ type: "bold" }] }, { type: "text", text: " to finish" }] },
    { type: "image", attrs: { src: "/media/uploads/a.png", alt: "Sales screen" } },
  ] });
});

test("Câu chưa có bản dịch giữ tiếng Việt; không sửa dữ liệu gốc; ngày giờ và đối tượng lạ giữ nguyên", () => {
  const when = new Date("2026-11-25T00:00:00Z");
  const body = { title: "Chưa dịch", updatedAt: when, nested: { name: "Đã dịch" } };
  const snapshot = JSON.stringify(body);
  const result = mapTranslatable(body, dictionary({ "Đã dịch": "Translated" }));
  assert.equal(result.title, "Chưa dịch");
  assert.equal(result.nested.name, "Translated");
  assert.equal(result.updatedAt, when, "Date giữ nguyên là đối tượng Date");
  assert.equal(JSON.stringify(body), snapshot, "không sửa dữ liệu đầu vào");
});

test("Đường dẫn của chuỗi gồm tên nội dung và vị trí, để file xuất cho biết câu dùng ở đâu", () => {
  const places: string[] = [];
  mapTranslatable({ blocks: [{ data: { title: "Tiêu đề khối" } }] }, (_core, place) => { places.push(place); return undefined; }, "page:home");
  assert.deepEqual(places, ["page:home.blocks.0.data.title"]);
});

test("Ngôn ngữ: tiếng Việt là gốc, tiếng Anh là bản dịch, mã lạ bị từ chối", () => {
  assert.equal(defaultLocale, "vi");
  assert.equal(isSiteLocale("vi"), true);
  assert.equal(isSiteLocale("en"), true);
  assert.equal(isTranslationLocale("vi"), false, "tiếng Việt không phải bản dịch");
  assert.equal(isTranslationLocale("en"), true);
  for (const value of ["xx", "EN", "", null, undefined, 1, "ar"]) assert.equal(isSiteLocale(value), false, String(value));
});

test("Danh mục ngôn ngữ: nhiều ngôn ngữ để người vận hành chọn thêm, mã không trùng, mỗi ngôn ngữ đủ tên, thẻ html và og:locale", () => {
  assert.ok(translationLocales.length > 10, "có nhiều ngôn ngữ để chọn");
  assert.equal(new Set(translationLocales.map((locale) => locale.code)).size, translationLocales.length, "mã không trùng");
  for (const locale of translationLocales) {
    assert.match(locale.code, /^[a-z]{2,3}$/, locale.code);
    assert.ok(locale.name && locale.label, locale.code);
    assert.match(locale.openGraph, /^[a-z]{2,3}_[A-Z]{2}$/, locale.code);
    assert.equal(isTranslationLocale(locale.code), true);
    assert.deepEqual(localeTags[locale.code], { html: locale.html, openGraph: locale.openGraph });
    assert.ok(locale.code.length <= 12, "vừa cột locale varchar(12) của bảng bản dịch");
  }
  assert.deepEqual(localeTags.vi, { html: "vi", openGraph: "vi_VN" });
  assert.deepEqual(localeTags.en, { html: "en", openGraph: "en_US" });
  assert.equal(localeTags.zh.html, "zh-Hans");
  assert.deepEqual(defaultEnabledLocales, ["en"], "website đang chạy tiếng Anh nên giữ làm mặc định khi chưa chọn gì");
});

test("Danh mục ngôn ngữ: tên hiện cho khách và thứ tự danh sách đã chọn", () => {
  assert.equal(siteLocaleName("vi"), "Tiếng Việt");
  assert.equal(siteLocaleName("ja"), "日本語");
  assert.equal(siteLocaleName("xx"), "xx", "mã lạ trả lại chính mã");
  assert.equal(findTranslationLocale("fr")?.label, "Tiếng Pháp");
  assert.equal(findTranslationLocale("vi"), undefined, "tiếng Việt là bản gốc, không nằm trong danh mục bản dịch");
  // Theo thứ tự danh mục, bỏ trùng và bỏ mã không có trong danh mục.
  assert.deepEqual(sortLocaleCodes(["ja", "en", "ja", "xx", "fr"]), ["en", "ja", "fr"]);
  assert.deepEqual(sortLocaleCodes([]), []);
});
