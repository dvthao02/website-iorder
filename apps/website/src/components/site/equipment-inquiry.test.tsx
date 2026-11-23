import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { publicLeadInputSchema } from "@iorder/shared/server/leads/leads.contract";
import { EquipmentInquiry, InquiryDialog, type InquiryEquipment } from "./equipment-inquiry";

const equipment: InquiryEquipment = { slug: "pos-sunmi-d2-1-man-hinh-single", name: "POS cảm ứng 1 màn hình Sunmi D2 - Single", modelCode: "D2-Single", priceVnd: 5_590_000, availability: "out_of_stock" };

test("Nút Liên hệ mua hàng chỉ là nút mở hộp, chưa dựng hộp và không còn liên kết sang trang Liên hệ chung", () => {
  const html = renderToStaticMarkup(<EquipmentInquiry equipment={equipment} />);
  assert.match(html, /<button[^>]*data-testid="equipment-inquiry-open"[^>]*>Liên hệ mua hàng<\/button>/);
  assert.doesNotMatch(html, /href="\/contact"|role="dialog"/);
  assert.match(renderToStaticMarkup(<EquipmentInquiry equipment={equipment} field="primaryAction" label="Hỏi mua" />), /data-builder-field="primaryAction"[^>]*>Hỏi mua</);
});

test("Hộp hỏi mua nêu rõ thiết bị, giá, tình trạng hàng và ghi chú khi chưa bán được ngay", () => {
  const html = renderToStaticMarkup(<InquiryDialog close={() => undefined} equipment={equipment} hotline="028 710 73 999" />);
  for (const text of ["POS cảm ứng 1 màn hình Sunmi D2 - Single", "D2-Single", "5.590.000", "Hết hàng", "gợi ý thiết bị thay thế", "tel:0287107399"]) assert.ok(html.includes(text), text);
  const inStock = renderToStaticMarkup(<InquiryDialog close={() => undefined} equipment={{ ...equipment, availability: "in_stock" }} hotline={null} />);
  assert.doesNotMatch(inStock, /equipment-inquiry-note/);
  assert.doesNotMatch(inStock, /tel:/);
});

test("Biểu mẫu hỏi mua gửi đúng các trường mà API chấp nhận, kèm mã thiết bị, và chỉ họ tên/số điện thoại bắt buộc", () => {
  const html = renderToStaticMarkup(<InquiryDialog close={() => undefined} equipment={equipment} hotline={null} />);
  const names = [...html.matchAll(/<(?:input|select|textarea)\b[^>]*\sname="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual([...names].sort(), ["email", "message", "name", "phone", "website"]);
  // Các trường do mã thêm lúc gửi (nhu cầu, mã thiết bị) + giá trị người dùng nhập: phải qua hợp đồng của Backend.
  const payload = { ...Object.fromEntries(names.map((name) => [name, ""])), name: "Nguyễn Văn A", phone: "0971 234 567", need: `Mua thiết bị: ${equipment.name}`, equipmentSlug: equipment.slug, token: "1.abc" };
  const parsed = publicLeadInputSchema.safeParse(payload);
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  for (const field of ["name", "phone"]) assert.match(html, new RegExp(`<input[^>]*name="${field}"[^>]*required|<input[^>]*required[^>]*name="${field}"`));
  for (const field of ["email", "message"]) assert.doesNotMatch(html, new RegExp(`<(?:input|textarea)[^>]*required[^>]*name="${field}"|<(?:input|textarea)[^>]*name="${field}"[^>]*required`));
  // Ô bẫy bot ẩn khỏi người dùng.
  assert.match(html, /<label[^>]*aria-hidden="true"[^>]*class="hidden"[^>]*>Website<input[^>]*name="website"/);
});
