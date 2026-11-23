import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WebsiteOriginProvider } from "../website-origin-context";
import { SeoAssistant } from "./seo-assistant";

const good = { title: "Phần mềm quản lý nhà hàng cho chủ quán bận rộn", seoTitle: "", seoDescription: "", excerpt: "Hướng dẫn chọn phần mềm quản lý nhà hàng phù hợp quy mô, theo dõi doanh thu và kho theo thời gian thực.", slug: "phan-mem-quan-ly-nha-hang", path: "/news/phan-mem-quan-ly-nha-hang", hasCover: true, content: { blocks: [{ type: "paragraph", text: "từ ".repeat(320) }] }, onChange: () => undefined };

test("Đủ mục thì hiện 'Sẵn sàng lên Google', không có danh sách việc nên làm", () => {
  const html = renderToStaticMarkup(<SeoAssistant {...good} />);
  assert.match(html, /admin-seo__score admin-seo__score--ready/);
  assert.match(html, /Sẵn sàng lên Google/);
  assert.match(html, /role="progressbar"[^>]*>|aria-valuenow="6"/);
  assert.doesNotMatch(html, /admin-seo__todo"/);
  assert.match(html, /<details class="admin-seo__checks admin-seo__all"><summary>Tất cả mục kiểm tra \(6\/6 đạt\)/);
});

test("Còn thiếu thì hiện điểm vàng, tối đa ba việc nên làm kèm nút sửa nhanh khi có, và số việc còn lại", () => {
  const html = renderToStaticMarkup(<SeoAssistant {...good} content={{ blocks: [] }} excerpt="" hasCover={false} seoTitle="Tiêu đề SEO rất dài cho trang phần mềm quản lý nhà hàng của iOrder năm 2026" />);
  assert.match(html, /admin-seo__score admin-seo__score--needs/);
  assert.match(html, /việc nên làm trước/);
  assert.match(html, /Rút gọn giúp tôi/);
  assert.equal(html.match(/<li><span>/g)?.length, 3);
  assert.match(html, /Còn \d việc nhỏ khác/);
});

test("Ô cụm từ khách hay gõ chỉ hiện khi truyền onFocusKeywordChange; gợi ý từ tiêu đề khi còn trống; ⓘ nằm ngoài nhãn", () => {
  assert.doesNotMatch(renderToStaticMarkup(<SeoAssistant {...good} focusKeyword="phần mềm" />), /Khách hay gõ cụm từ nào/);
  const empty = renderToStaticMarkup(<SeoAssistant {...good} focusKeyword="" onFocusKeywordChange={() => undefined} />);
  assert.match(empty, /Khách hay gõ cụm từ nào để tìm nội dung này\?/);
  assert.match(empty, /Gợi ý từ tiêu đề:<\/small><button[^>]*>phần mềm quản lý nhà hàng<\/button>/);
  assert.match(empty, /<\/label>(?:<div class="admin-seo__actions">.*?<\/div>)?<button[^>]*admin-help-tip--corner/);
  const filled = renderToStaticMarkup(<SeoAssistant {...good} focusKeyword="máy in bếp" onFocusKeywordChange={() => undefined} />);
  assert.doesNotMatch(filled, /Gợi ý từ tiêu đề/);
  assert.doesNotMatch(filled, /giúp tôi/, "Thiếu từ khóa trong tiêu đề cần người viết, không có nút tự ghép");
  assert.match(filled, /Tiêu đề chưa có cụm “máy in bếp”\. Sửa ở ô “Tiêu đề SEO”/);
});

test("checkIds giới hạn mục tính điểm (Trang chỉ chấm tiêu đề, mô tả, đường dẫn)", () => {
  const html = renderToStaticMarkup(<SeoAssistant {...good} checkIds={["title", "description"]} hasCover={false} />);
  assert.match(html, /Sẵn sàng lên Google/);
  assert.match(html, /Tất cả mục kiểm tra \(2\/2 đạt\)/);
});

test("Xem trước Google dùng đúng quy tắc của website: chỉ thêm | iOrder khi tiêu đề chưa có thương hiệu", () => {
  const without = renderToStaticMarkup(<SeoAssistant {...good} title="Giới thiệu" />);
  assert.match(without, /<strong>Giới thiệu \| iOrder<\/strong>/);
  const withBrandInTitle = renderToStaticMarkup(<SeoAssistant {...good} seoTitle="Trang chủ: iOrder - Phần mềm bán hàng" />);
  assert.match(withBrandInTitle, /<strong>Trang chủ: iOrder - Phần mềm bán hàng<\/strong>/);
  assert.doesNotMatch(withBrandInTitle, /\| iOrder/);
});

test("Trang hệ thống tắt gợi ý cụm từ từ tiêu đề (\"Trang chủ\" không phải cụm khách tìm)", () => {
  const html = renderToStaticMarkup(<SeoAssistant {...good} focusKeyword="" onFocusKeywordChange={() => undefined} suggestKeyword={false} title="Trang chủ" />);
  assert.match(html, /Khách hay gõ cụm từ nào/);
  assert.doesNotMatch(html, /Gợi ý từ tiêu đề/);
});

test("Ô cụm từ liên quan chỉ hiện khi nơi dùng truyền onRelatedKeywordsChange; có các cụm đã lưu", () => {
  assert.doesNotMatch(renderToStaticMarkup(<SeoAssistant {...good} relatedKeywords={["phần mềm POS"]} />), /Cụm từ liên quan/);
  const html = renderToStaticMarkup(<SeoAssistant {...good} relatedKeywords={["phần mềm POS", "máy in bếp"]} onRelatedKeywordsChange={() => undefined} />);
  assert.match(html, /Cụm từ liên quan \(tùy chọn, tối đa 4\)/);
  assert.match(html, /value="phần mềm POS, máy in bếp"/);
  assert.match(html, /<\/label><button[^>]*admin-help-tip--corner/, "ⓘ nằm ngoài nhãn");
});

test("Gần khớp từ khóa: vẫn 'Sẵn sàng', hiện mục 'Làm thêm cho tốt hơn' và đánh dấu mục nhạt (không phải lỗi); cụm liên quan chưa có thì thành việc nên làm", () => {
  const long = { blocks: [{ type: "paragraph", text: `Phần mềm quản lý bán hàng cho quán. ${"từ ".repeat(300)}` }] };
  const nearlyExact = { ...good, title: "Phần mềm quản lý bán hàng iOrder cho nhà hàng", slug: "phan-mem-quan-ly-ban-hang", seoDescription: "Phần mềm bán hàng cho nhà hàng, cà phê và bán lẻ: gọi món, thu ngân, kho, nhân viên và báo cáo trên một nền tảng.", content: long, focusKeyword: "phần mềm quản lý bán hàng", onFocusKeywordChange: () => undefined };
  const html = renderToStaticMarkup(<SeoAssistant {...nearlyExact} />);
  assert.match(html, /admin-seo__score--ready/);
  assert.match(html, /Làm thêm cho tốt hơn \(không bắt buộc\)/);
  assert.match(html, /admin-seo__hints"><li>Mô tả mới có một số từ của cụm “phần mềm quản lý bán hàng”\. Nếu tự nhiên, viết đủ cả cụm một lần ở ô “Mô tả SEO”/);
  assert.match(html, /admin-seo__check admin-seo__check--soft/);
  const withRelated = renderToStaticMarkup(<SeoAssistant {...nearlyExact} relatedKeywords={["máy in bếp"]} onRelatedKeywordsChange={() => undefined} />);
  assert.match(withRelated, /Cụm liên quan “máy in bếp” chưa xuất hiện trong bài/);
  assert.match(withRelated, /admin-seo__score--almost/);
});

test("Mục 'Khách đang tìm gì' không hiện sẵn: chỉ hiện sau khi backend báo đã nối Search Console, để chưa nối thì không làm rối", () => {
  const html = renderToStaticMarkup(<SeoAssistant {...good} onFocusKeywordChange={() => undefined} searchConsolePath="/news/bai-viet" />);
  assert.doesNotMatch(html, /Khách đang tìm gì/);
  assert.doesNotMatch(html, /Chưa nối Google Search Console/);
});

test("Đường dẫn thiếu cụm chỉ là gợi ý (không tính là việc phải làm), nói rõ bài đã đăng thì để nguyên", () => {
  const content = { blocks: [{ type: "paragraph", text: `Phần mềm quản lý nhà hàng giúp chủ quán bớt việc. ${"từ ".repeat(320)}` }] };
  const html = renderToStaticMarkup(<SeoAssistant {...good} content={content} focusKeyword="phần mềm quản lý nhà hàng" onFocusKeywordChange={() => undefined} slug="gioi-thieu" />);
  assert.match(html, /admin-seo__score--ready/);
  assert.match(html, /admin-seo__hints"><li>Đường dẫn chưa có cụm “phần mềm quản lý nhà hàng”\./);
  assert.match(html, /Bài đã đăng: cứ để nguyên/);
});

test("guideKind hiện hướng dẫn SEO theo loại trang: việc website tự làm và việc nên làm; không truyền thì không hiện", () => {
  assert.doesNotMatch(renderToStaticMarkup(<SeoAssistant {...good} />), /Hướng dẫn SEO cho/);
  const software = renderToStaticMarkup(<SeoAssistant {...good} guideKind="software" />);
  assert.match(software, /Hướng dẫn SEO cho trang phần mềm/);
  assert.match(software, /Website đã tự làm giúp bạn/);
  assert.match(software, /SoftwareApplication/);
  assert.match(software, /lời kêu gọi/);
  assert.match(renderToStaticMarkup(<SeoAssistant {...good} guideKind="equipment" />), /Hướng dẫn SEO cho trang thiết bị/);
});

test("Xem trước Google hiện địa chỉ khách thấy (Địa chỉ website ở Cài đặt), không phải địa chỉ LAN dùng để mở trang", () => {
  const html = renderToStaticMarkup(<WebsiteOriginProvider origin="http://192.168.1.5:3000" publicOrigin="https://iorder.vn"><SeoAssistant {...good} /></WebsiteOriginProvider>);
  assert.ok(html.includes("<small>iorder.vn › news › phan-mem-quan-ly-nha-hang</small>"));
  assert.ok(!html.includes("192.168"));
});
