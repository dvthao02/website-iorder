import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PublishStatusOptions } from "./publish-status-options";

test("Thiếu quyền xuất bản: khóa Hẹn giờ/Xuất bản nhưng giữ trạng thái đang chọn", () => {
  const html = renderToStaticMarkup(<select defaultValue="published"><PublishStatusOptions canPublish={false} current="published" /></select>);
  assert.match(html, /<option disabled="" value="scheduled">Hẹn giờ \(cần quyền xuất bản\)<\/option>/);
  assert.match(html, /<option value="published"[^>]*>Xuất bản<\/option>/);
  assert.doesNotMatch(html, /<option disabled="" value="draft">/);
});

test("Có quyền xuất bản: mọi trạng thái đều chọn được", () => {
  assert.doesNotMatch(renderToStaticMarkup(<select><PublishStatusOptions canPublish current="draft" /></select>), /disabled/);
});
