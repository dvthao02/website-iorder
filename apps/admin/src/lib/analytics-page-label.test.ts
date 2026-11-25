import assert from "node:assert/strict";
import test from "node:test";

import { analyticsPageLabel } from "./analytics-page-label";

test("Báo cáo truy cập: trang chủ hiện là \"Trang chủ\" thay vì \"/\"", () => {
  assert.equal(analyticsPageLabel("/"), "Trang chủ");
});

test("Báo cáo truy cập: trang hệ thống lấy tên trong CMS, bỏ qua dấu gạch chéo cuối", () => {
  assert.equal(analyticsPageLabel("/about"), "Giới thiệu");
  assert.equal(analyticsPageLabel("/news/"), "Danh sách tin tức");
  assert.equal(analyticsPageLabel("/support/guides"), "Hướng dẫn sử dụng");
  assert.equal(analyticsPageLabel("/support"), "Trung tâm hỗ trợ");
});

test("Báo cáo truy cập: bài viết, sản phẩm và đường dẫn lạ giữ nguyên đường dẫn", () => {
  for (const path of ["/news/thuc-don-quan-ca-phe-size-topping", "/software/phan-mem-quan-ly-ban-hang-iorder", "/pages/khuyen-mai", "/khong-biet"]) assert.equal(analyticsPageLabel(path), path);
});
