import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeLeadNote, mergedLeadStatus, type MergedLeadSource } from "./leads.merge";

const at = (hours: number) => new Date(Date.UTC(2026, 10, 23, 12, 0, 0) - hours * 3_600_000);
const source = (patch: Partial<MergedLeadSource> = {}): MergedLeadSource => ({ createdAt: at(1), status: "new", need: null, message: null, deviceName: null, ...patch });

test("Ghi chú gộp liệt kê liên hệ cũ (mới nhất trước) kèm thiết bị, lời nhắn và trạng thái; giờ theo Việt Nam", () => {
  const note = mergeLeadNote(null, [
    source({ createdAt: at(30), status: "closed", need: "Phần mềm bán hàng" }),
    source({ createdAt: at(2), status: "contacted", deviceName: "Máy POS X1", message: "Cần  báo giá\ngấp" }),
  ]);
  assert.equal(note, [
    "— Gộp từ 2 liên hệ cùng số điện thoại —",
    "• 17:00 23/11/26 · hỏi mua Máy POS X1 · “Cần báo giá gấp” · Đã liên hệ",
    "• 13:00 22/11/26 · Phần mềm bán hàng · Đã xử lý",
  ].join("\n"));
  // Liên hệ không có nhu cầu, thiết bị lẫn lời nhắn vẫn có một dòng.
  assert.match(mergeLeadNote(null, [source()]).split("\n")[1], /liên hệ chung · Mới$/);
});

test("Ghi chú cũ được giữ nguyên, khối gộp nằm sau một dòng trống", () => {
  const note = mergeLeadNote("  Đã gọi, hẹn chiều  ", [source()]);
  assert.ok(note.startsWith("Đã gọi, hẹn chiều\n\n— Gộp từ 1 liên hệ cùng số điện thoại —\n• "));
});

test("Dòng quá dài bị cắt, gộp nhiều liên hệ vẫn không vượt giới hạn và bớt dòng cũ nhất", () => {
  const long = "x".repeat(400);
  assert.ok(mergeLeadNote(null, [source({ message: long })]).split("\n")[1].length <= 220);
  const many = Array.from({ length: 20 }, (_, index) => source({ createdAt: at(index + 1), message: long }));
  const note = mergeLeadNote(null, many, 1_000);
  assert.ok(note.length <= 1_000, String(note.length));
  const lines = note.split("\n");
  assert.equal(lines[0], "— Gộp từ 20 liên hệ cùng số điện thoại —");
  assert.match(lines.at(-1)!, /^• … và \d+ liên hệ cũ hơn$/);
  // Giữ các liên hệ mới nhất: dòng đầu tiên là liên hệ cách đây 1 giờ.
  assert.equal(lines.length - 2 + Number(lines.at(-1)!.match(/\d+/)![0]), 20);
});

test("Ghi chú cũ gần đầy: không cắt ghi chú cũ, bớt hết phần gộp nếu không còn chỗ", () => {
  const existing = "g".repeat(1_990);
  assert.equal(mergeLeadNote(existing, [source()], 2_000), existing);
  const roomy = "g".repeat(1_900);
  const note = mergeLeadNote(roomy, [source({ message: "Lời nhắn" }), source()], 2_000);
  assert.ok(note.startsWith(roomy));
  assert.ok(note.length <= 2_000);
});

test("Trạng thái sau gộp lấy mức xử lý thấp nhất để không làm mất liên hệ chưa ai xử lý", () => {
  assert.equal(mergedLeadStatus(["closed", "closed"]), "closed");
  assert.equal(mergedLeadStatus(["closed", "contacted"]), "contacted");
  assert.equal(mergedLeadStatus(["closed", "new", "contacted"]), "new");
  assert.equal(mergedLeadStatus(["new"]), "new");
});
