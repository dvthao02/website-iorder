import assert from "node:assert/strict";
import { test } from "node:test";

import { robotsDirectives } from "./robots-meta";

test("Trang cho lập chỉ mục khai báo ảnh lớn, đoạn trích và video xem trước không giới hạn cho Googlebot", () => {
  assert.deepEqual(robotsDirectives(true, true), { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } });
  assert.deepEqual(robotsDirectives(true, false), { index: true, follow: false, googleBot: { index: true, follow: false, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } });
});

test("Trang không lập chỉ mục (nháp, xem trước, tắt trong CMS) không thêm chỉ thị nào khác", () => {
  assert.deepEqual(robotsDirectives(false, false), { index: false, follow: false });
  assert.deepEqual(robotsDirectives(false, true), { index: false, follow: true });
});
