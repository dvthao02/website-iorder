import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { TranslationOverview } from "@iorder/shared/server/translations/translations.contract";
import { inSentence, nextOpenLocale, TranslationsView, visibleOpenLocale } from "./translations-manager";
import { AdminToastProvider } from "./ui/admin-feedback";
import { AdminPermissionsProvider } from "./ui/admin-permissions";

// Một số thành phần CMS dùng JSX kiểu cũ (không tự import React) nên test cần React toàn cục.
(globalThis as { React?: typeof React }).React = React;

type Locale = TranslationOverview["locales"][number];
const groups: TranslationOverview["groups"] = [{ id: "ui", label: "Chữ giao diện website", total: 9 }, { id: "pages", label: "Trang", total: 2000 }, { id: "news", label: "Bài viết: Tin tức", total: 800 }];
const available: TranslationOverview["available"] = [{ code: "ja", name: "日本語", label: "Tiếng Nhật" }, { code: "fr", name: "Français", label: "Tiếng Pháp" }];
const overview: TranslationOverview = { version: 3, available, total: 2754, uiTotal: 9, groups, locales: [{ code: "en", name: "English", label: "Tiếng Anh", visible: true, translated: 12, uiTranslated: 3, missing: 2742, unused: 3, missingByGroup: { ui: 6, pages: 1990, news: 760 }, suggestible: 12 }] };
const complete: TranslationOverview = { version: 3, available, total: 2754, uiTotal: 9, groups, locales: [{ code: "en", name: "English", label: "Tiếng Anh", visible: true, translated: 2754, uiTranslated: 9, missing: 0, unused: 0, missingByGroup: { ui: 0, pages: 0, news: 0 }, suggestible: 0 }] };
// Thẻ input của một lựa chọn phạm vi xuất (thứ tự thuộc tính do React quyết định nên đọc theo tên, không so chuỗi nguyên).
const scopeInput = (html: string, value: "all" | "missing") => new RegExp(`<input[^>]*name="translation-scope-en"[^>]*value="${value}"[^>]*/>`).exec(html)?.[0] ?? "";
const render = (permissions: string[], value: TranslationOverview | null = overview) => renderToStaticMarkup(
  <AdminToastProvider><AdminPermissionsProvider actor={{ role: "editor", permissions }}><TranslationsView onRefresh={() => undefined} overview={value} /></AdminPermissionsProvider></AdminToastProvider>,
);

test("Màn Đa ngôn ngữ: mỗi ngôn ngữ một thẻ, nói rõ đã dịch bao nhiêu (giao diện và nội dung), còn thiếu, bản dịch không còn câu gốc, và nói URL không đổi", () => {
  const html = render(["settings.view", "settings.update"]);
  assert.match(html, /English/);
  assert.match(html, /12\/2\.754 câu đã dịch \(0,4%\)/);
  assert.match(html, /Còn 2\.742 câu hiện tiếng Việt/);
  assert.match(html, /<dt>Giao diện website<\/dt><dd>3\/9<\/dd>/);
  assert.match(html, /<dt>Nội dung CMS<\/dt><dd>9\/2\.745<\/dd>/);
  assert.match(html, /<dt>Chưa dịch<\/dt><dd>2\.742<\/dd>/);
  assert.match(html, /3 bản dịch không còn câu gốc/);
  assert.match(html, /Đường dẫn và slug giữ nguyên/);
  assert.match(html, /aria-label="Giải thích: file xuất"/, "chữ cố định của giao diện và các cột trong file giải thích trong chú thích ⓘ, không chiếm chỗ");
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="0"/);
});

test("Màn Đa ngôn ngữ: mỗi ngôn ngữ là một bảng gập, dòng tóm tắt đủ tên, tiến độ và số câu thiếu; chỉ bảng đầu mở sẵn, ngôn ngữ duy nhất thì mở luôn", () => {
  const panel = /<details class="admin-post-editor__panel admin-translation"( open="")?>/g;
  assert.deepEqual([...render(["settings.view", "settings.update"]).matchAll(panel)].map((match) => Boolean(match[1])), [true], "chỉ có một ngôn ngữ thì mở sẵn");
  const second: Locale = { code: "zh", name: "中文", label: "Tiếng Trung (giản thể)", visible: true, translated: 0, uiTranslated: 0, missing: 2754, unused: 0, missingByGroup: { ui: 9, pages: 2000, news: 800 }, suggestible: 0 };
  const html = render(["settings.view", "settings.update"], { ...overview, locales: [overview.locales[0], second] });
  assert.deepEqual([...html.matchAll(panel)].map((match) => Boolean(match[1])), [true, false], "chỉ bảng đầu mở sẵn");
  const summaries = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((match) => match[1]).filter((summary) => summary.includes("câu đã dịch"));
  assert.equal(summaries.length, 2, "bảng gập vẫn có dòng tóm tắt khi đóng");
  assert.match(summaries[1], /中文/);
  assert.match(summaries[1], /Tiếng Trung \(giản thể\) \(mã zh\)/);
  assert.match(summaries[1], /0\/2\.754 câu đã dịch \(0%\)/);
  assert.match(summaries[1], /role="progressbar"/);
  assert.match(summaries[1], /Còn 2\.754 câu hiện tiếng Việt/);
  assert.match(html, /name="translation-scope-zh"/, "mỗi ngôn ngữ có nhóm lựa chọn phạm vi riêng");
});

test("Màn Đa ngôn ngữ: chỉ một bảng mở một lúc (mở bảng nào thì bảng đó duy nhất mở, đóng bảng đang mở thì không còn bảng nào, bỏ qua sự kiện đóng của bảng bị gập)", () => {
  assert.equal(nextOpenLocale("en", "zh", true), "zh", "mở bảng khác: bảng mới thành bảng duy nhất mở");
  assert.equal(nextOpenLocale("en", "en", false), null, "đóng đúng bảng đang mở: không bảng nào mở");
  assert.equal(nextOpenLocale("zh", "en", false), "zh", "bảng en bị gập vì zh vừa mở: sự kiện đóng của en không làm gập zh");
  assert.equal(nextOpenLocale(null, "en", true), "en");
  assert.equal(nextOpenLocale(null, "en", false), null);
  assert.equal(visibleOpenLocale("zh", ["en"]), "en", "bảng đang mở vừa bị gỡ thì mở bảng đầu");
  assert.equal(visibleOpenLocale("zh", []), null, "hết ngôn ngữ thì không bảng nào");
  assert.equal(visibleOpenLocale(null, ["en", "zh"]), null, "người dùng tự đóng hết thì giữ nguyên");
  assert.equal(visibleOpenLocale("zh", ["en", "zh"]), "zh");
});

test("Màn Đa ngôn ngữ: tên ngôn ngữ giữa câu thông báo chỉ hạ chữ đầu, giữ tên riêng (tiếng Nhật, không phải tiếng nhật)", () => {
  assert.equal(inSentence("Tiếng Nhật"), "tiếng Nhật");
  assert.equal(inSentence("Tiếng Trung (giản thể)"), "tiếng Trung (giản thể)");
  assert.equal(inSentence("Đức"), "đức");
  assert.equal(inSentence(""), "");
});

test("Màn Đa ngôn ngữ: gọn một hàng đầu (lời nhắn và ô thêm ngôn ngữ) và hai cột xuất/nhập trong mỗi bảng", () => {
  const html = render(["settings.view", "settings.update"]);
  assert.match(html, /<div class="admin-translation-top">[\s\S]*?Đường dẫn và slug giữ nguyên[\s\S]*?<form class="admin-translation-add">/);
  assert.match(html, /<div class="admin-translation__columns"><section aria-label="Xuất file để dịch"[\s\S]*?<section aria-label="Nhập file đã dịch"/);
  assert.doesNotMatch(html, /khóa dạng ui/, "lời nhắn không nhắc chi tiết kỹ thuật của khóa");
});

test("Màn Đa ngôn ngữ: bước 1 cho chọn xuất tất cả hoặc chỉ câu chưa dịch (mặc định chỉ câu chưa dịch khi còn thiếu), rồi tải Excel hoặc CSV", () => {
  const html = render(["settings.view", "settings.update"]);
  assert.match(html, /1\. Xuất file để dịch/);
  assert.match(scopeInput(html, "missing"), /checked=""/, "còn câu chưa dịch thì mặc định chọn chỉ câu chưa dịch");
  assert.doesNotMatch(scopeInput(html, "missing"), /disabled/);
  assert.ok(scopeInput(html, "all") && !/checked/.test(scopeInput(html, "all")), "tất cả không được chọn sẵn");
  assert.match(html, /Chỉ câu chưa dịch<\/strong> <em>2\.742 câu<\/em>/);
  assert.match(html, /Tất cả<\/strong> <em>2\.754 câu<\/em>/);
  assert.match(html, /6 chữ giao diện và 2\.736 câu nội dung/, "nói rõ trong số chưa dịch có bao nhiêu chữ giao diện và bao nhiêu nội dung");
  assert.match(html, /class="admin-button admin-button--export admin-file-tone--excel"[\s\S]*?Tải Excel \(\.xlsx\)/);
  assert.match(html, /class="admin-button admin-button--export admin-file-tone--csv"[\s\S]*?Tải CSV/);
  assert.doesNotMatch(html, /<a [^>]*download/, "tải bằng nút (bắt được lỗi), không phải liên kết dẫn tới trang JSON khi lỗi");
});

// Thẻ input của một vùng (theo tên vùng hiện trên nhãn).
const groupInput = (html: string, label: string) => new RegExp(`<label class="admin-translation__group"><input([^>]*)/><span>${label}</span><em>([^<]*)</em></label>`).exec(html);

test("Màn Đa ngôn ngữ: chọn vùng cần dịch, mặc định chọn mọi vùng, mỗi vùng ghi số câu theo phạm vi đang chọn (chưa dịch) và nói rõ một câu có thể thuộc nhiều vùng", () => {
  const html = render(["settings.view", "settings.update"]);
  assert.match(html, /Vùng cần dịch <small>\(3\/3 vùng đã chọn\)<\/small>/);
  for (const [label, count] of [["Chữ giao diện website", "6 câu"], ["Trang", "1\\.990 câu"], ["Bài viết: Tin tức", "760 câu"]]) {
    const match = groupInput(html, label);
    assert.ok(match, label);
    assert.match(match[1], /checked=""/, `${label} chọn sẵn`);
    assert.doesNotMatch(match[1], /disabled/);
    assert.match(match[2], new RegExp(`^${count}$`));
  }
  assert.match(html, /Chọn tất cả/);
  assert.match(html, /Bỏ chọn tất cả/);
  assert.match(html, /Một câu dùng ở nhiều vùng được tính ở mỗi vùng/);
  assert.match(html, /Cột “Vùng”/);
  assert.match(html, /<details class="admin-translation__groups"><summary>Vùng cần dịch/, "danh sách vùng gập sẵn trong phần tùy chọn, không chiếm chỗ khi không cần");
});

test("Màn Đa ngôn ngữ: gợi ý sẵn có ô chọn (bật sẵn) kèm số câu có gợi ý, lời giải thích nằm trong chú thích ⓘ; không có gợi ý nào thì không hiện ô", () => {
  const html = render(["settings.view", "settings.update"]);
  assert.match(html, /Điền sẵn gợi ý từ câu giống đã dịch \(12 câu\)/);
  assert.match(html, /<input[^>]*checked=""[^>]*\/>Điền sẵn gợi ý/, "bật sẵn");
  assert.match(html, /aria-label="Giải thích: gợi ý dịch"/);
  assert.doesNotMatch(html, /Kiểm tra cột Ghi chú/, "lời giải thích dài không chiếm chỗ trên màn hình");
  assert.doesNotMatch(render(["settings.view"], complete), /Điền sẵn gợi ý/);
});

test("Màn Đa ngôn ngữ: đã dịch đủ thì phạm vi tự về tất cả nên các vùng hiện tổng số câu và vẫn chọn được", () => {
  const html = render(["settings.view", "settings.update"], complete);
  assert.match(groupInput(html, "Trang")![2], /^2\.000 câu$/);
  assert.doesNotMatch(groupInput(html, "Trang")![1], /disabled/);
  assert.match(groupInput(html, "Trang")![1], /checked=""/);
});

test("Màn Đa ngôn ngữ: vùng đã dịch đủ trong khi ngôn ngữ còn thiếu ở vùng khác thì bị khóa và ghi 'đã dịch đủ'", () => {
  const partial: TranslationOverview = { ...overview, locales: [{ ...overview.locales[0], missingByGroup: { ui: 0, pages: 1990, news: 752 } }] };
  const html = render(["settings.view", "settings.update"], partial);
  assert.match(groupInput(html, "Chữ giao diện website")![1], /disabled=""/);
  assert.doesNotMatch(groupInput(html, "Chữ giao diện website")![1], /checked/);
  assert.equal(groupInput(html, "Chữ giao diện website")![2], "đã dịch đủ");
  assert.match(html, /Vùng cần dịch <small>\(2\/2 vùng đã chọn\)<\/small>/, "chỉ đếm vùng còn câu để xuất");
});

test("Màn Đa ngôn ngữ: đã dịch đủ thì khóa lựa chọn chỉ câu chưa dịch và chọn sẵn tất cả", () => {
  const html = render(["settings.view", "settings.update"], complete);
  assert.match(html, /Đã dịch đủ/);
  assert.match(scopeInput(html, "missing"), /disabled=""/);
  assert.doesNotMatch(scopeInput(html, "missing"), /checked/);
  assert.match(scopeInput(html, "all"), /checked=""/);
  assert.match(html, /Đã dịch đủ, không còn câu nào để xuất/);
});

test("Màn Đa ngôn ngữ: người có quyền sửa cài đặt thấy bước 2 với ô chọn file, nút kiểm tra và tùy chọn cập nhật bản đã có", () => {
  const html = render(["settings.view", "settings.update"]);
  assert.match(html, /2\. Nhập file đã dịch/);
  assert.match(html, /type="file"/);
  assert.match(html, /Kiểm tra file/);
  assert.match(html, /Cập nhật cả bản dịch đã có/);
  assert.match(html, /file chỉ có câu chưa dịch đều nhập được/);
});

test("Màn Đa ngôn ngữ: chỉ có quyền xem thì xuất được file nhưng không có chỗ nhập", () => {
  const html = render(["settings.view"]);
  assert.match(html, /Tải Excel/);
  assert.doesNotMatch(html, /type="file"/);
  assert.match(html, /nhập bản dịch cần quyền sửa cài đặt/);
});

test("Màn Đa ngôn ngữ: người có quyền sửa cài đặt chọn thêm ngôn ngữ từ danh mục (chưa chọn thì nút thêm bị khóa); người chỉ xem không thấy khung này", () => {
  const html = render(["settings.view", "settings.update"]);
  assert.match(html, /<form class="admin-translation-add">/, "ô thêm ngôn ngữ gọn một hàng, không còn thẻ riêng có tiêu đề và mô tả");
  assert.doesNotMatch(html, /<h2>/);
  assert.match(html, /<option value=""[^>]*>Chọn ngôn ngữ để thêm…<\/option>/);
  assert.ok(html.includes('<option value="ja">日本語 · Tiếng Nhật (ja)</option>'));
  assert.ok(html.includes('<option value="fr">Français · Tiếng Pháp (fr)</option>'));
  assert.doesNotMatch(html, /<option value="en"/, "ngôn ngữ đã thêm không nằm trong danh sách chọn");
  const submit = /<button[^>]*type="submit"[^>]*>/.exec(html)?.[0] ?? "";
  assert.ok(submit.includes("disabled"), "chưa chọn gì thì không thêm được");
  assert.ok(html.includes(">Thêm ngôn ngữ</button>"));
  assert.match(html, /khi ngôn ngữ đó đã có bản dịch/, "lời nhắn nói khách chỉ thấy ngôn ngữ sau khi đã có bản dịch");
  const viewOnly = render(["settings.view"]);
  assert.doesNotMatch(viewOnly, /Thêm ngôn ngữ/);
  assert.doesNotMatch(viewOnly, /translation-add-locale/);
});

test("Màn Đa ngôn ngữ: đã thêm mọi ngôn ngữ trong danh mục thì khung thêm báo vậy; chưa thêm ngôn ngữ nào thì hướng dẫn chọn", () => {
  assert.match(render(["settings.view", "settings.update"], { ...overview, available: [] }), /Đã thêm mọi ngôn ngữ trong danh mục/);
  const none = render(["settings.view", "settings.update"], { ...overview, locales: [], available });
  assert.match(none, /Chưa thêm ngôn ngữ nào/);
  assert.doesNotMatch(none, /<details/, "không có bảng ngôn ngữ nào");
});

test("Màn Đa ngôn ngữ: chỉ ngôn ngữ chưa có bản dịch nào mới có nút Gỡ, và chỉ người có quyền sửa cài đặt thấy", () => {
  const empty: TranslationOverview = { ...overview, locales: [{ ...overview.locales[0], visible: true, translated: 0, uiTranslated: 0, unused: 0, missing: 2754, missingByGroup: { ui: 9, pages: 2000, news: 800 }, suggestible: 0 }] };
  assert.ok(render(["settings.view", "settings.update"], empty).includes(">Gỡ ngôn ngữ</button>"));
  assert.doesNotMatch(render(["settings.view"], empty), /Gỡ ngôn ngữ/);
  assert.doesNotMatch(render(["settings.view", "settings.update"]), /Gỡ ngôn ngữ/, "đã có bản dịch thì không gỡ");
  const onlyOld: TranslationOverview = { ...empty, locales: [{ ...empty.locales[0], unused: 2 }] };
  assert.doesNotMatch(render(["settings.view", "settings.update"], onlyOld), /Gỡ ngôn ngữ/, "bản dịch cũ không còn dùng vẫn là bản dịch đã nhập");
});

test("Màn Đa ngôn ngữ: không tải được tổng quan thì báo lỗi thay vì hiện số sai", () => {
  const html = render(["settings.view"], null);
  assert.match(html, /Không tải được tổng quan bản dịch/);
  assert.doesNotMatch(html, /câu đã dịch/);
});

test("Màn Đa ngôn ngữ: mỗi ngôn ngữ có công tắc hiện cho khách; tắt thì có nhãn ở dòng tóm tắt và nói rõ bản dịch vẫn được giữ; chỉ người có quyền sửa cài đặt bật/tắt được", () => {
  const hidden: TranslationOverview = { ...overview, locales: [overview.locales[0], { ...overview.locales[0], code: "ja", name: "日本語", label: "Tiếng Nhật", visible: false }] };
  const html = render(["settings.view", "settings.update"], hidden);
  assert.equal((html.match(/role="switch"/g) ?? []).length, 2, "mỗi ngôn ngữ một công tắc");
  assert.equal((html.match(/aria-label="Hiện cho khách trên website"/g) ?? []).length, 2);
  assert.equal((html.match(/<input[^>]*role="switch"[^>]*checked=""/g) ?? []).length, 1, "chỉ công tắc của ngôn ngữ đang bật có tích");
  assert.match(html, /Khách thấy nút chọn English ở đầu website\./);
  assert.match(html, /Đang tắt: khách không thấy ngôn ngữ này\. Bản dịch vẫn được giữ, bật lại là hiện ngay\./);
  assert.equal((html.match(/Đang tắt với khách/g) ?? []).length, 1, "nhãn ở dòng tóm tắt chỉ cho ngôn ngữ đang tắt");
  assert.doesNotMatch(render(["settings.view", "settings.update"]), /Đang tắt với khách/, "đang bật hết thì không có nhãn");

  const readOnly = render(["settings.view"], hidden);
  assert.equal((readOnly.match(/role="switch"[^>]*disabled=""|disabled=""[^>]*role="switch"/g) ?? []).length, 2, "chỉ có quyền xem thì công tắc bị khóa");

  const noTranslation: TranslationOverview = { ...overview, locales: [{ ...overview.locales[0], translated: 0, uiTranslated: 0, unused: 0, missing: 2754, missingByGroup: { ui: 9, pages: 2000, news: 800 }, suggestible: 0 }] };
  assert.match(render(["settings.view", "settings.update"], noTranslation), /Nút chọn ngôn ngữ chỉ hiện khi đã có ít nhất một bản dịch\./, "chưa có bản dịch nào thì giải thích vì sao khách chưa thấy");
});
