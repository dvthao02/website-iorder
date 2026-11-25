import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { equipmentAvailabilityLabels, equipmentAvailabilityValues } from "@iorder/shared/server/equipment/equipment-availability";
import { createTranslate } from "../../lib/translate";
import { availabilityLabelKeys, AvailabilityBadge } from "./availability-badge";

test("Danh sách: Còn hàng và chưa đặt thì không hiện gì; trạng thái khác hiện nhãn đúng", () => {
  assert.equal(renderToStaticMarkup(<AvailabilityBadge availability="in_stock" />), "");
  assert.equal(renderToStaticMarkup(<AvailabilityBadge />), "");
  assert.equal(renderToStaticMarkup(<AvailabilityBadge availability={null} />), "");
  for (const [value, label] of [["limited", "Sắp hết hàng"], ["pre_order", "Đặt trước"], ["out_of_stock", "Hết hàng"], ["discontinued", "Ngừng kinh doanh"]] as const) {
    const html = renderToStaticMarkup(<AvailabilityBadge availability={value} />);
    assert.match(html, new RegExp(`data-availability="${value}"[^>]*>${label}</span>`));
  }
});

test("Trang chi tiết (always): luôn nói rõ kể cả Còn hàng, mặc định là Còn hàng", () => {
  assert.match(renderToStaticMarkup(<AvailabilityBadge always availability="in_stock" />), />Còn hàng<\/span>/);
  assert.match(renderToStaticMarkup(<AvailabilityBadge always />), />Còn hàng<\/span>/);
  assert.match(renderToStaticMarkup(<AvailabilityBadge always availability="out_of_stock" className="mt-2" />), /class="[^"]*mt-2[^"]*"[^>]*>Hết hàng/);
});

test("Nhãn theo ngôn ngữ khách chọn: truyền t thì đổi chữ, khóa chưa dịch giữ tiếng Việt; chữ gốc website khớp với nhãn của CMS", () => {
  for (const value of equipmentAvailabilityValues) assert.equal(createTranslate()(availabilityLabelKeys[value]), equipmentAvailabilityLabels[value], `${value}: chữ gốc của website khác nhãn trong CMS`);
  const t = createTranslate({ "availability.outOfStock": "Out of stock", "availability.inStock": "In stock" });
  assert.match(renderToStaticMarkup(<AvailabilityBadge availability="out_of_stock" t={t} />), />Out of stock<\/span>/);
  assert.match(renderToStaticMarkup(<AvailabilityBadge always availability="in_stock" t={t} />), />In stock<\/span>/);
  assert.match(renderToStaticMarkup(<AvailabilityBadge availability="limited" t={t} />), />Sắp hết hàng<\/span>/);
});
