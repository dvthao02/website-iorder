import assert from "node:assert/strict";
import test from "node:test";

import { exportFileName, exportRows } from "./translations.export";
import type { SourceUnit } from "./translations.source";

const unit = (key: string, text: string, groups: SourceUnit["groups"], uses = 1, places: string[] = ["Nơi dùng"]): SourceUnit => ({ key, text, places, uses, groups });
const units: SourceUnit[] = [
  unit("ui.header.openMenu", "Mở menu", ["ui"], 1, ["Giao diện website"]),
  unit("a1", "Phần mềm bán hàng", ["pages", "software"], 5, ["page:home.title", "offering:pos.title", "post:a.title"]),
  unit("b2", "Liên hệ", ["navigation"], 17, ["navigation.header", "page:home", "page:about"]),
  unit("c3", "Giá mới", ["news"]),
  unit("d4", "Trang chủ", ["navigation"]),
  unit("zz", "Trang Chủ", ["pages"]),
];
const stored = new Map([
  ["ui.header.openMenu", { sourceText: "Mở menu", value: "Open menu" }],
  ["a1", { sourceText: "Phần mềm bán hàng", value: "Sales software" }],
  // Câu gốc đã sửa sau khi dịch: bản dịch cũ không còn hiệu lực, coi như chưa dịch.
  ["c3", { sourceText: "Giá cũ", value: "Old price" }],
  ["zz", { sourceText: "Trang Chủ", value: "Home" }],
]);
const keysOf = (result: { rows: Array<string | number>[] }) => result.rows.map((row) => row[0]);

test("Xuất tất cả: mọi câu theo thứ tự, bản dịch còn hiệu lực điền sẵn, câu gốc đã sửa thì ô dịch trống; có số nơi dùng và vùng", () => {
  const { rows, suggested } = exportRows(units, stored, { scope: "all" });
  assert.equal(suggested, 0);
  assert.deepEqual(rows[0], ["ui.header.openMenu", "Mở menu", "Open menu", "Giao diện website", 1, "Chữ giao diện website", ""]);
  assert.deepEqual(rows[1], ["a1", "Phần mềm bán hàng", "Sales software", "page:home.title  |  offering:pos.title  |  post:a.title  | …", 5, "Trang, Phần mềm", ""]);
  // Dùng nhiều hơn số nơi được ghi (3): có dấu … để biết còn nhiều nơi nữa.
  assert.equal(rows[2][3], "navigation.header  |  page:home  |  page:about  | …");
  assert.equal(rows[2][4], 17);
  assert.equal(rows[3][2], "", "câu gốc đã sửa thì chưa dịch");
  assert.equal(rows.length, 6);
});

test("Xuất chỉ câu chưa dịch: bỏ câu đã có bản dịch còn hiệu lực, giữ câu chưa dịch và câu có bản dịch đã lỗi thời", () => {
  assert.deepEqual(keysOf(exportRows(units, stored, { scope: "missing" })), ["b2", "c3", "d4"]);
  const allDone = new Map(units.map((item) => [item.key, { sourceText: item.text, value: "x" }]));
  assert.deepEqual(exportRows(units, allDone, { scope: "missing" }).rows, []);
});

test("Xuất theo vùng: chỉ câu có dùng ở một trong các vùng đã chọn (câu dùng ở nhiều vùng vào cả hai); đủ mọi vùng thì không lọc", () => {
  assert.deepEqual(keysOf(exportRows(units, stored, { scope: "all", groups: ["software"] })), ["a1"]);
  assert.deepEqual(keysOf(exportRows(units, stored, { scope: "all", groups: ["pages"] })), ["a1", "zz"]);
  assert.deepEqual(keysOf(exportRows(units, stored, { scope: "all", groups: ["navigation", "news"] })), ["b2", "c3", "d4"]);
  assert.deepEqual(keysOf(exportRows(units, stored, { scope: "missing", groups: ["navigation", "ui"] })), ["b2", "d4"], "kết hợp với phạm vi chưa dịch");
  assert.deepEqual(exportRows(units, stored, { scope: "all", groups: ["guide"] }).rows, []);
  const everyGroup = ["ui", "site", "navigation", "pages", "software", "solutions", "equipment", "news", "promotion", "case-study", "announcement", "guide", "taxonomy", "other"] as const;
  assert.equal(exportRows(units, stored, { scope: "all", groups: everyGroup }).rows.length, 6);
});

test("Gợi ý: câu chưa dịch chỉ khác hoa/thường hoặc dấu câu cuối được điền sẵn bản dịch của câu đã dịch kèm ghi chú nguồn; không có thì giữ trống; câu đã dịch không bị ghi đè", () => {
  const { rows, suggested } = exportRows(units, stored, { scope: "missing", suggest: true });
  assert.equal(suggested, 1);
  const home = rows.find((row) => row[0] === "d4")!;
  assert.equal(home[2], "Home", "“Trang Chủ” đã dịch → “Trang chủ” gợi ý “Home”");
  assert.match(String(home[6]), /Gợi ý từ câu “Trang Chủ”/);
  assert.equal(rows.find((row) => row[0] === "b2")![2], "");
  assert.equal(rows.find((row) => row[0] === "b2")![6], "");
  // Tắt gợi ý thì ô dịch trống.
  assert.equal(exportRows(units, stored, { scope: "missing", suggest: false }).rows.find((row) => row[0] === "d4")![2], "");
  // Câu đã có bản dịch riêng không bị gợi ý đè lên.
  const own = new Map(stored).set("d4", { sourceText: "Trang chủ", value: "Homepage" });
  assert.equal(exportRows(units, own, { scope: "all", suggest: true }).rows.find((row) => row[0] === "d4")![2], "Homepage");
});

test("Gợi ý lấy cả từ chữ giao diện (ui.*) cho nội dung CMS trùng chữ, vì hai bên là hai khóa khác nhau", () => {
  const items: SourceUnit[] = [unit("ui.catalog.software", "Phần mềm", ["ui"]), unit("e5", "Phần mềm", ["navigation"])];
  const translated = new Map([["ui.catalog.software", { sourceText: "Phần mềm", value: "Software" }]]);
  const { rows, suggested } = exportRows(items, translated, { scope: "missing", suggest: true });
  assert.equal(suggested, 1);
  assert.equal(rows[0][2], "Software");
});

test("Tên file: chua-dich cho file chỉ có câu chưa dịch; mã vùng (hoặc số vùng khi nhiều) cho file theo vùng", () => {
  assert.equal(exportFileName("en", { scope: "all" }, "2026-11-25", "xlsx"), "ban-dich-en-2026-11-25.xlsx");
  assert.equal(exportFileName("en", { scope: "missing" }, "2026-11-25", "csv"), "ban-dich-en-chua-dich-2026-11-25.csv");
  assert.equal(exportFileName("en", { scope: "all", groups: ["ui", "pages"] }, "2026-11-25", "xlsx"), "ban-dich-en-ui-pages-2026-11-25.xlsx");
  assert.equal(exportFileName("en", { scope: "missing", groups: ["news"] }, "2026-11-25", "xlsx"), "ban-dich-en-chua-dich-news-2026-11-25.xlsx");
  assert.equal(exportFileName("en", { scope: "all", groups: ["ui", "pages", "news", "guide"] }, "2026-11-25", "xlsx"), "ban-dich-en-4-vung-2026-11-25.xlsx");
});
