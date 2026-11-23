import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminSlugField } from "./admin-slug-field";

const base = { currentStatus: "draft", editing: false, id: "x-slug", onEditingChange: () => undefined, onValueChange: () => undefined, publicPath: "/news/bai-moi", publishedLead: "Bài đã xuất bản", savedStatus: undefined, sourceNoun: "tiêu đề", sourceText: "Bài mới", touched: false, value: "bai-moi" };

test("Chưa mở: một dòng đường dẫn + nút Sửa, nhắc đường dẫn tự tạo theo nguồn khi chưa chỉnh tay", () => {
  const html = renderToStaticMarkup(<AdminSlugField {...base} />);
  assert.match(html, /admin-post-editor__slug-line/);
  assert.match(html, /\/news\/bai-moi/);
  assert.match(html, /tự tạo theo tiêu đề/);
  assert.ok(!html.includes("<input"));
  assert.ok(!renderToStaticMarkup(<AdminSlugField {...base} touched />).includes("tự tạo theo"));
});

test("Mở ra: ô nhập đúng mẫu slug, nút tạo từ nguồn bị khóa khi nguồn trống hoặc đã trùng", () => {
  const html = renderToStaticMarkup(<AdminSlugField {...base} editing />);
  assert.match(html, /id="x-slug"/);
  assert.match(html, /pattern="\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*"/);
  assert.match(html, /Tạo từ tiêu đề/);
  assert.match(html, /Chỉ dùng chữ thường không dấu/);
  assert.match(renderToStaticMarkup(<AdminSlugField {...base} editing sourceText="  " />), /disabled=""[^>]*>Tạo từ tiêu đề/);
  assert.match(renderToStaticMarkup(<AdminSlugField {...base} editing sourceText="Bài mới" value="bai-moi" />), /disabled=""[^>]*>Tạo từ tiêu đề/, "đã đúng bằng slug sinh ra");
  assert.doesNotMatch(renderToStaticMarkup(<AdminSlugField {...base} editing sourceText="Bài khác" />), /disabled=""[^>]*>Tạo từ tiêu đề/);
});

test("Lời nhắc chuyển hướng 301: đang hiển thị thì báo sẽ chuyển hướng; đã lưu hiển thị nhưng đang sửa sang trạng thái khác thì cảnh báo không chuyển", () => {
  const live = renderToStaticMarkup(<AdminSlugField {...base} currentStatus="published" editing savedStatus="published" />);
  assert.match(live, /Bài đã xuất bản: khi lưu với đường dẫn mới, đường dẫn cũ tự chuyển hướng \(301\)/);
  const unpublishing = renderToStaticMarkup(<AdminSlugField {...base} currentStatus="draft" editing savedStatus="published" />);
  assert.match(unpublishing, /admin-text-warning/);
  assert.match(unpublishing, /sẽ không tạo chuyển hướng/);
});
