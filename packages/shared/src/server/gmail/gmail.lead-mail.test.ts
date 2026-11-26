import assert from "node:assert/strict";
import test from "node:test";

import { composeLeadMail, type LeadMailInput } from "./gmail.lead-mail";

const base: LeadMailInput = { id: "6f1c2a52-8a7e-4b8e-9c0d-3f2b1a4d5e60", name: "Nguyễn Văn A", phone: "0901 234 567", createdAt: new Date("2026-11-26T03:15:00Z") };
const options = { cmsOrigin: "https://cms.iorder.example/" };

test("Tiêu đề có tên và số điện thoại; thân có giờ Việt Nam và liên kết mở liên hệ trong CMS", () => {
  const mail = composeLeadMail(base, options);
  assert.equal(mail.subject, "[iOrder] Liên hệ mới: Nguyễn Văn A · 0901 234 567");
  assert.match(mail.text, /Họ tên: Nguyễn Văn A\nSố điện thoại: 0901 234 567/);
  assert.match(mail.text, /Thời gian: .*10:15.* \(giờ Việt Nam\)/);
  assert.ok(mail.text.endsWith("Mở trong CMS: https://cms.iorder.example/admin/leads?open=6f1c2a52-8a7e-4b8e-9c0d-3f2b1a4d5e60"));
});

test("Chỉ ghi các trường khách đã điền, kèm lời nhắn", () => {
  const mail = composeLeadMail({ ...base, email: "a@x.com", need: "Phần mềm bán hàng", businessModel: "  ", message: "Cần báo giá\ncho 3 chi nhánh" }, options);
  assert.match(mail.text, /Email: a@x\.com/);
  assert.match(mail.text, /Nhu cầu: Phần mềm bán hàng/);
  assert.ok(!/Mô hình kinh doanh/.test(mail.text), "trường trống bị bỏ");
  assert.match(mail.text, /Lời nhắn:\nCần báo giá\ncho 3 chi nhánh/);
});

test("Liên hệ hỏi mua thiết bị ghi tên, mã, giá và tình trạng hàng lúc gửi", () => {
  const mail = composeLeadMail({ ...base, context: { kind: "equipment", equipmentId: "0b9d8f3e-1c2d-4e5f-8a6b-7c8d9e0f1a2b", slug: "may-in", name: "Máy in hóa đơn K80", modelCode: "K80-01", brand: null, groupName: null, priceVnd: 1_850_000, availability: "limited", capturedAt: "2026-11-26T03:00:00.000Z" } }, options);
  assert.match(mail.subject, /· hỏi mua Máy in hóa đơn K80$/);
  assert.match(mail.text, /Thiết bị quan tâm: Máy in hóa đơn K80 \(mã K80-01 · 1\.850\.000 đ · Sắp hết hàng\)/);
});

test("Tên có xuống dòng không chèn được tiêu đề thư; lời nhắn quá dài bị cắt", () => {
  const mail = composeLeadMail({ ...base, name: "A\r\nBcc: ke-xau@x.com", message: "x".repeat(5000) }, options);
  assert.ok(!/[\r\n]/.test(mail.subject));
  assert.ok(mail.text.length < 2_000);
  assert.match(mail.text, /…\n/);
});

test("Không có địa chỉ CMS thì bỏ dòng liên kết", () => {
  assert.ok(!/Mở trong CMS/.test(composeLeadMail(base, { cmsOrigin: "" }).text));
});
