import assert from "node:assert/strict";
import { test } from "node:test";

import { ogImagePath, ogTitle, ogTitleFontSize, signOgTitle, verifyOgTitle } from "./og-image";

test("Ảnh chia sẻ chỉ hợp lệ khi chữ ký khớp tiêu đề: sửa chữ, sửa chữ ký hoặc thiếu chữ ký đều bị từ chối", () => {
  const title = "Phần mềm quản lý nhà hàng";
  assert.equal(verifyOgTitle(title, signOgTitle(title)), true);
  assert.equal(verifyOgTitle("Tiêu đề khác", signOgTitle(title)), false);
  const signature = signOgTitle(title);
  assert.equal(verifyOgTitle(title, `${signature[0] === "0" ? "1" : "0"}${signature.slice(1)}`), false);
  assert.equal(verifyOgTitle(title, null), false);
  assert.equal(verifyOgTitle(title, "không-phải-hex"), false);
});

test("Đường dẫn ảnh có tiêu đề đã chuẩn hóa và chữ ký đúng; tiêu đề quá dài bị cắt có dấu …", () => {
  const params = new URL(`https://iorder.vn${ogImagePath("  Máy   in   nhiệt  ")}`).searchParams;
  assert.equal(params.get("title"), "Máy in nhiệt");
  assert.equal(verifyOgTitle(params.get("title") ?? "", params.get("sig")), true);
  const long = ogTitle("từ ".repeat(100));
  assert.ok(long.length <= 120 && long.endsWith("…"));
});

test("Cỡ chữ giảm dần theo độ dài tiêu đề", () => {
  assert.ok(ogTitleFontSize("a".repeat(20)) > ogTitleFontSize("a".repeat(50)));
  assert.ok(ogTitleFontSize("a".repeat(50)) > ogTitleFontSize("a".repeat(120)));
});
