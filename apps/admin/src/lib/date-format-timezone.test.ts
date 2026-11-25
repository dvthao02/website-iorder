import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// Máy chủ chạy trong Docker theo giờ UTC còn trình duyệt theo giờ người dùng: Intl.DateTimeFormat không đặt múi giờ sẽ cho chữ khác nhau
// ở hai nơi, làm React báo lỗi hydration (#418) trên gần như mọi trang CMS và hiện sai ngày/giờ lúc tải. Mọi bộ định dạng ngày giờ phải
// nêu múi giờ rõ ràng (giờ Việt Nam, hoặc UTC cho ngày thuần như "2026-11-24").

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === ".next" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** Phần đối số của lời gọi `new Intl.DateTimeFormat(...)` bắt đầu ở `open` (vị trí dấu mở ngoặc). */
function callArguments(text: string, open: number) {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if (text[index] === "(") depth++;
    if (text[index] === ")" && --depth === 0) return text.slice(open, index + 1);
  }
  return text.slice(open);
}

test("Mọi Intl.DateTimeFormat trong CMS, website và mã dùng chung đều đặt múi giờ", () => {
  const offenders: string[] = [];
  for (const root of ["apps/admin/src", "apps/website/src", "packages/shared/src"]) {
    for (const file of sourceFiles(path.resolve(process.cwd(), root))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/new Intl\.DateTimeFormat\(/g)) {
        if (!/timeZone/.test(callArguments(text, match.index + match[0].length - 1))) {
          offenders.push(`${path.relative(process.cwd(), file)}:${text.slice(0, match.index).split("\n").length}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], "thiếu timeZone: máy chủ (UTC) và trình duyệt sẽ hiện ngày giờ khác nhau");
});
