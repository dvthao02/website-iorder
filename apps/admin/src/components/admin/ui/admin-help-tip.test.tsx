import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminEditorOutline, AdminEditorSection } from "./admin-editor-section";
import { AdminFormField } from "./admin-form-field";
import { AdminHelpTip, AdminHintedField } from "./admin-help-tip";
import { LayoutPicker } from "./layout-picker";

test("Chú thích đóng sẵn: chỉ có nút ⓘ có tên truy cập, nội dung không nằm trong HTML", () => {
  const html = renderToStaticMarkup(<AdminHelpTip>Nội dung giải thích dài</AdminHelpTip>);
  assert.match(html, /<button[^>]*aria-label="Xem giải thích"/);
  assert.match(html, /type="button"/);
  assert.doesNotMatch(html, /role="tooltip"/);
  assert.doesNotMatch(html, /Nội dung giải thích dài/);
  assert.doesNotMatch(html, /aria-describedby/);
});

test("Trường có hint: nhãn và ⓘ cùng hàng, hint không chiếm dòng riêng", () => {
  const html = renderToStaticMarkup(<AdminFormField hint="Chỉ dùng chữ thường" id="slug" label="Đường dẫn"><input id="slug" /></AdminFormField>);
  assert.match(html, /class="admin-label-row"><label for="slug">Đường dẫn<\/label><button/);
  assert.match(html, /aria-label="Giải thích: Đường dẫn"/);
  assert.doesNotMatch(html, /Chỉ dùng chữ thường/);
  assert.doesNotMatch(html, /class="admin-help"/);
});

test("Trường không có hint giữ nguyên cấu trúc cũ, không thêm nút", () => {
  const html = renderToStaticMarkup(<AdminFormField id="name" label="Tên"><input id="name" /></AdminFormField>);
  assert.doesNotMatch(html, /<button/);
  assert.match(html, /<label for="name">Tên<\/label>/);
});

test("Khối soạn thảo: mô tả chuyển vào ⓘ cạnh tiêu đề", () => {
  const html = renderToStaticMarkup(<AdminEditorSection description="Từ phần đầu trang đến các phần còn lại" step={1} title="Nội dung trang"><p>Thân</p></AdminEditorSection>);
  assert.match(html, /<h2>Nội dung trang<\/h2><button/);
  assert.match(html, /aria-label="Giải thích: Nội dung trang"/);
  assert.doesNotMatch(html, /Từ phần đầu trang đến các phần còn lại/);
  const plain = renderToStaticMarkup(<AdminEditorSection title="Không mô tả"><p>Thân</p></AdminEditorSection>);
  assert.doesNotMatch(plain, /<button/);
});

test("Mục lục khối: mô tả phụ nằm ở title (hover), không còn dòng chữ nhỏ", () => {
  const html = renderToStaticMarkup(<AdminEditorOutline items={[{ description: "Tên, tóm tắt, ảnh bìa", href: "#a", label: "Phần đầu trang", step: 1 }]} />);
  assert.match(html, /title="Phần đầu trang: Tên, tóm tắt, ảnh bìa"/);
  assert.doesNotMatch(html, /<small/);
});

test("Ô bọc chú thích: có hint thì có ⓘ ngoài label, không có hint thì giữ khung để không dựng lại ô nhập", () => {
  const withHint = renderToStaticMarkup(<AdminHintedField hint="Số nhỏ hiện trước." label="Thứ tự"><label className="admin-field">Thứ tự<input type="number" /></label></AdminHintedField>);
  assert.match(withHint, /^<div class="admin-field"><label class="admin-field">Thứ tự<input type="number"\/><\/label><button[^>]*admin-help-tip--corner/);
  assert.doesNotMatch(withHint, /Số nhỏ hiện trước/);
  const without = renderToStaticMarkup(<AdminHintedField label="Thứ tự"><label className="admin-field">Thứ tự<input type="number" /></label></AdminHintedField>);
  assert.equal(without, '<div class="admin-field"><label class="admin-field">Thứ tự<input type="number"/></label></div>');
});

test("Chọn kiểu bố cục: gợi ý của kiểu đang chọn nằm trong ⓘ, không còn dòng chữ", () => {
  const options = [{ value: "a", label: "Kiểu A", hint: "Gợi ý riêng của A", preview: null }, { value: "b", label: "Kiểu B", hint: "Gợi ý riêng của B", preview: null }] as const;
  const html = renderToStaticMarkup(<LayoutPicker label="Kiểu bố cục" name="layout" note="Lưu ý thêm" onChange={() => undefined} options={options} value="a" />);
  assert.match(html, /admin-help-tip--corner/);
  assert.doesNotMatch(html, /class="admin-help"/);
  assert.match(html, /aria-label="Giải thích: Kiểu bố cục"/);
  // Chữ gợi ý không còn là nội dung hiển thị; chỉ còn ở title của từng lựa chọn (rê chuột là thấy).
  assert.doesNotMatch(html, />Gợi ý riêng của A</);
  assert.doesNotMatch(html, /Lưu ý thêm/);
  assert.match(html, /title="Gợi ý riêng của A"/);
  assert.match(html, /title="Gợi ý riêng của B"/);
});
