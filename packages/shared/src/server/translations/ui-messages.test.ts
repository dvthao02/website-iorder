import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { formatMessage, isUiMessageKey, messagePlaceholders, storedUiKey, uiKeyPrefix, uiMessageKeys, uiMessages, uiStoredKeyPattern } from "./ui-messages";

// Test chạy từ thư mục gốc của repo (pnpm test).
const websiteRoot = path.join(process.cwd(), "apps/website/src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

test("Danh mục chữ cố định: khóa hợp lệ để lưu cùng bản dịch, câu gốc không rỗng, tên nhóm.tên", () => {
  assert.ok(uiMessageKeys.length > 100, "danh mục phải có chữ của giao diện website");
  for (const key of uiMessageKeys) {
    assert.match(key, /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/, `${key}: tên phải dạng nhóm.tên`);
    assert.ok(uiStoredKeyPattern.test(storedUiKey(key)), `${key}: khóa lưu không hợp lệ`);
    assert.ok(storedUiKey(key).length <= 128, `${key}: dài quá cột source_key`);
    assert.ok(uiMessages[key].trim().length > 0, `${key}: câu gốc rỗng`);
    assert.ok(isUiMessageKey(key));
  }
  assert.equal(isUiMessageKey("khong.co"), false);
  assert.equal(isUiMessageKey("toString"), false, "không nhận thuộc tính của Object");
  assert.equal(storedUiKey("header.openMenu"), `${uiKeyPrefix}header.openMenu`);
});

test("Biến {ten} trong câu: liệt kê đúng, thay đúng, biến thiếu giữ nguyên để lỗi hiện rõ", () => {
  assert.deepEqual(messagePlaceholders("{a} và {b} và {a}"), ["a", "b"]);
  assert.deepEqual(messagePlaceholders("Không có biến"), []);
  assert.equal(formatMessage("Xin chào {name}, còn {count} mục", { name: "An", count: 3 }), "Xin chào An, còn 3 mục");
  assert.equal(formatMessage("Xin chào {name}", {}), "Xin chào {name}");
  assert.equal(formatMessage("Không biến"), "Không biến");
  assert.equal(formatMessage("{n} {n}", { n: 0 }), "0 0", "giá trị 0 vẫn được thay");
  // Mọi câu gốc có biến phải dùng tên biến đơn giản (chữ, số, gạch dưới) để người dịch giữ nguyên được.
  for (const key of uiMessageKeys) assert.ok(!/\{[^}A-Za-z0-9_]/.test(uiMessages[key]), `${key}: tên biến không hợp lệ`);
});

test("Mọi khóa t(...) trong mã website có trong danh mục, và mọi khóa trong danh mục đều được website dùng (không có khóa mồ côi)", () => {
  const source = sourceFiles(websiteRoot).map((file) => readFileSync(file, "utf8")).join("\n");
  // Chuỗi dạng "nhóm.tên" nằm ở bất cứ đâu trong mã (kể cả bảng khóa như emptyKeys, availabilityNoteKeys) và trùng tiền tố nhóm của danh mục.
  const groups = [...new Set(uiMessageKeys.map((key) => key.split(".")[0]))];
  const used = new Set([...source.matchAll(new RegExp(`"((?:${groups.join("|")})\\.[A-Za-z0-9.]+)"`, "g"))].map((match) => match[1]));
  const unknown = [...used].filter((key) => !isUiMessageKey(key));
  assert.deepEqual(unknown, [], `khóa dùng trong mã nhưng chưa có trong ui-messages.ts: ${unknown.join(", ")}`);
  const orphan = uiMessageKeys.filter((key) => !used.has(key));
  assert.deepEqual(orphan, [], `khóa có trong danh mục nhưng website không dùng: ${orphan.join(", ")}`);
});
