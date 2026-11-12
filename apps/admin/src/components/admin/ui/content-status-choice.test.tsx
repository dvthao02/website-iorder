import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ContentStatusChoice, contentSavedMessage, contentSubmitLabel } from "./content-status-choice";

const noop = () => undefined;

test("Thiếu quyền xuất bản: khóa Đăng ngay/Hẹn giờ nhưng giữ trạng thái đang hiển thị", () => {
  const html = renderToStaticMarkup(<ContentStatusChoice canPublish={false} noun="trang" onChange={noop} savedStatus="published" value="published" />);
  assert.match(html, /<input[^>]*disabled=""[^>]*value="scheduled"/);
  assert.doesNotMatch(html, /<input[^>]*disabled=""[^>]*value="published"/);
  assert.doesNotMatch(html, /<input[^>]*disabled=""[^>]*value="draft"/);
  assert.match(html, /cần quyền xuất bản/);
});

test("Có quyền xuất bản: mọi trạng thái đều chọn được, Lưu trữ chỉ hiện khi đang lưu trữ", () => {
  const html = renderToStaticMarkup(<ContentStatusChoice canPublish noun="trang" onChange={noop} savedStatus="draft" value="draft" />);
  assert.doesNotMatch(html, /disabled/);
  assert.doesNotMatch(html, /value="archived"/);
  assert.match(renderToStaticMarkup(<ContentStatusChoice canPublish noun="trang" onChange={noop} savedStatus="archived" value="archived" />), /value="archived"/);
});

test("Nút lưu và thông báo nói rõ hành động theo trạng thái", () => {
  assert.equal(contentSubmitLabel("published", "published", "sản phẩm"), "Cập nhật sản phẩm đã đăng");
  assert.equal(contentSubmitLabel("published", "draft", "sản phẩm"), "Xuất bản");
  assert.equal(contentSubmitLabel("draft", undefined, "sản phẩm"), "Lưu nháp");
  assert.equal(contentSavedMessage("draft", undefined, "thiết bị"), "Đã tạo bản nháp thiết bị.");
  assert.equal(contentSavedMessage("published", "published", "thiết bị"), "Đã cập nhật thiết bị trên website.");
});
