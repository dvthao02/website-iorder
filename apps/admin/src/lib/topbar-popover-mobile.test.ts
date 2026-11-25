import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// Test chạy từ thư mục gốc của repo (pnpm test).
const shell = readFileSync(path.join(process.cwd(), "apps/admin/src/styles/shell.css"), "utf8");

test("Điện thoại: khung thông báo ở thanh trên trải theo bề ngang màn hình, không bám theo chuông rồi lòi ra mép trái", () => {
  // Chuông nằm giữa thanh trên (trước nút tài khoản), nên khung rộng 300px neo vào chuông sẽ lệch ra ngoài ở màn hình ≤ 375px.
  const mobile = shell.slice(shell.lastIndexOf("@media (max-width: 680px) {"));
  const rule = mobile.match(/\.admin-notifications > \.admin-header-popover \{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /position:\s*fixed/);
  assert.match(rule, /left:\s*12px/);
  assert.match(rule, /right:\s*12px/);
  assert.match(rule, /width:\s*auto/);
});
