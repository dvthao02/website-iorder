import assert from "node:assert/strict";
import { test } from "node:test";

import { buildLlmsTxt } from "./llms-txt";

test("llms.txt có tiêu đề, tóm tắt, ghi chú và các mục liên kết theo đúng cú pháp Markdown", () => {
  const text = buildLlmsTxt({
    name: "iOrder",
    summary: "Phần mềm quản lý bán hàng.",
    notes: ["Hotline: 1900 0000"],
    sections: [{ title: "Phần mềm", links: [{ title: "iOrder POS", url: "https://iorder.vn/software/pos", description: "Bán hàng, kho, báo cáo." }, { title: "Không mô tả", url: "https://iorder.vn/software/khac" }] }],
  });
  assert.equal(text, [
    "# iOrder", "", "> Phần mềm quản lý bán hàng.", "", "Hotline: 1900 0000", "",
    "## Phần mềm", "", "- [iOrder POS](https://iorder.vn/software/pos): Bán hàng, kho, báo cáo.", "- [Không mô tả](https://iorder.vn/software/khac)", "",
  ].join("\n"));
});

test("Mục không có liên kết bị bỏ, URL trùng chỉ giữ ở mục đầu, tiêu đề rỗng bị loại", () => {
  const text = buildLlmsTxt({
    name: "iOrder", summary: null,
    sections: [
      { title: "Rỗng", links: [] },
      { title: "A", links: [{ title: "Trang", url: "https://iorder.vn/a" }, { title: "  ", url: "https://iorder.vn/b" }] },
      { title: "B", links: [{ title: "Trang lặp", url: "https://iorder.vn/a" }] },
    ],
  });
  assert.ok(!text.includes("## Rỗng") && !text.includes("## B") && !text.includes("Trang lặp") && !text.includes("/b)"));
  assert.ok(text.includes("## A") && !text.startsWith("\n") && text.endsWith("\n") && !text.endsWith("\n\n"));
});

test("Mô tả gọn về một dòng và cắt ở 220 ký tự; ngoặc vuông trong tiêu đề không làm gãy liên kết", () => {
  const text = buildLlmsTxt({ name: "iOrder", summary: null, sections: [{ title: "Tin", links: [{ title: "Bài [mới]\nnhất", url: "https://iorder.vn/x", description: `Dòng một\n\ndòng   hai ${"x".repeat(400)}` }] }] });
  const line = text.split("\n").find((entry) => entry.startsWith("- ["))!;
  assert.ok(line.startsWith("- [Bài mới nhất](https://iorder.vn/x): Dòng một dòng hai "));
  assert.ok(line.endsWith("…") && line.length < 300 && !line.includes("\n"));
});
