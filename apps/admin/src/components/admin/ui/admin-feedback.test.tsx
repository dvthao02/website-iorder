import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminNotice, toastDurationMs } from "./admin-feedback";

// Một số thành phần CMS dùng JSX kiểu cũ (không tự import React) nên test cần React toàn cục.
(globalThis as { React?: typeof React }).React = React;

// Test chạy từ thư mục gốc của repo (pnpm test).
const adminRoot = path.join(process.cwd(), "apps/admin/src");

test("Thông báo nổi: thời gian hiện đủ đọc câu dài, lỗi/cảnh báo lâu hơn, có trần", () => {
  assert.equal(toastDurationMs("Đã lưu.", "success"), 4_000);
  assert.equal(toastDurationMs("Đã lưu.", "info"), 4_000);
  assert.equal(toastDurationMs("Không lưu được.", "error"), 6_000);
  assert.equal(toastDurationMs("Hãy lưu trước khi xóa.", "warning"), 6_000);
  // 200 ký tự: 2,5 giây + 45 ms mỗi ký tự = 11,5 giây (trước đây cố định 4 giây nên câu dài tắt khi chưa kịp đọc).
  assert.equal(toastDurationMs("x".repeat(200), "success"), 11_500);
  assert.equal(toastDurationMs("x".repeat(5_000), "error"), 15_000, "tối đa 15 giây");
  assert.ok(toastDurationMs("x".repeat(100), "success") > toastDurationMs("x".repeat(10), "success"));
});

test("AdminNotice: lỗi báo role=alert, còn lại role=status; thông báo nổi dùng silent để không bị trình đọc màn hình đọc hai lần", () => {
  assert.match(renderToStaticMarkup(<AdminNotice tone="error">Lỗi</AdminNotice>), /role="alert"/);
  assert.match(renderToStaticMarkup(<AdminNotice tone="success">Xong</AdminNotice>), /role="status"/);
  assert.match(renderToStaticMarkup(<AdminNotice>Mặc định</AdminNotice>), /role="status"/);
  const silent = renderToStaticMarkup(<AdminNotice silent tone="error">Lỗi</AdminNotice>);
  assert.doesNotMatch(silent, /role=/);
  assert.match(silent, /admin-notice--error/);
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

test("Mọi thông báo nổi có chữ cố định kết thúc bằng dấu câu và dùng \"sao chép\" (không dùng \"chép\" trơn) cho thao tác sao chép", () => {
  const call = /\b(?:show|showToast|toast\.show)\(\s*(`[^`]*`|"(?:[^"\\]|\\.)*")\s*,\s*"(?:success|error|warning|info)"/g;
  const messages: Array<{ file: string; message: string }> = [];
  for (const file of sourceFiles(adminRoot)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(call)) messages.push({ file: path.relative(adminRoot, file), message: match[1].slice(1, -1) });
  }
  assert.ok(messages.length > 80, "phải quét được các thông báo nổi trong CMS");
  const noPunctuation = messages.filter(({ message }) => !/[.…?!]$/.test(message.replace(/\$\{[^}]*\}/g, "X").trim()));
  assert.deepEqual(noPunctuation, [], "thông báo nổi phải kết thúc bằng dấu câu");
  const bareCopy = messages.filter(({ message }) => /(^|[^o ])\bchép\b|(^| )chép\b/.test(message.replace(/sao chép/g, "")));
  assert.deepEqual(bareCopy, [], "dùng \"sao chép\" thống nhất");
});
