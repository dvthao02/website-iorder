import assert from "node:assert/strict";
import test from "node:test";

import { seoChecks, suggestSeoDescription, suggestSeoTitle, truncateAtWord } from "./seo";

test("cắt ở ranh giới từ và thêm dấu …", () => {
  assert.equal(truncateAtWord("Ngắn gọn", 60), "Ngắn gọn");
  const cut = truncateAtWord("Phần mềm quản lý nhà hàng giúp chủ quán theo dõi doanh thu từng ca làm việc", 40);
  assert.ok(cut.length <= 40, cut);
  assert.ok(cut.endsWith("…"));
  assert.ok(!cut.includes("  "));
  assert.equal(suggestSeoTitle("  Tiêu   đề  "), "Tiêu đề");
});

test("mô tả gợi ý ưu tiên tóm tắt, rồi đoạn văn đầu tiên", () => {
  const content = { blocks: [{ type: "checklist", heading: "Danh sách", items: ["A"] }, { type: "paragraph", text: "  Đoạn   đầu tiên. " }] };
  assert.equal(suggestSeoDescription("Tóm tắt bài", content), "Tóm tắt bài");
  assert.equal(suggestSeoDescription("   ", content), "Đoạn đầu tiên.");
  assert.equal(suggestSeoDescription(null, { blocks: [] }), null);
  assert.ok((suggestSeoDescription("x ".repeat(200)) ?? "").length <= 155);
});

test("kiểm tra SEO báo đúng điểm thiếu", () => {
  const checks = Object.fromEntries(seoChecks({ title: "Ngắn", seoTitle: "", seoDescription: "", excerpt: "", slug: "mot-hai-ba-bon-nam-sau-bay-tam-chin", hasCover: false, content: { blocks: [{ type: "paragraph", text: "ít chữ" }] } }).map((check) => [check.id, check.ok]));
  assert.deepEqual(checks, { title: false, description: false, excerpt: false, cover: false, length: false, slug: false });
  const good = seoChecks({ title: "Phần mềm quản lý nhà hàng cho chủ quán bận rộn", seoTitle: "", seoDescription: "", excerpt: "Hướng dẫn chọn phần mềm quản lý nhà hàng phù hợp quy mô, theo dõi doanh thu và kho theo thời gian thực.", slug: "phan-mem-quan-ly-nha-hang", hasCover: true, content: { blocks: [{ type: "paragraph", text: "từ ".repeat(320) }] } });
  assert.ok(good.every((check) => check.ok), JSON.stringify(good.filter((check) => !check.ok)));
});
