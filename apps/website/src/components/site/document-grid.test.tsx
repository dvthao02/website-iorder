import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DocumentGrid, type DocumentCard } from "./document-grid";

const image = (url: string) => ({ url, alt: "Bản chụp", width: 1800, height: 2546 });
const card = (extra: Partial<DocumentCard> = {}): DocumentCard => ({ title: "Giấy chứng nhận", caption: "Xem giấy chứng nhận", href: null, image: image("/media/uploads/a.jpg"), ...extra });

test("Giấy tờ có ảnh là nút mở hộp thoại, tên đọc được bằng trình đọc màn hình, tiêu đề và dòng mô tả hiện trên thẻ", () => {
  const html = renderToStaticMarkup(<DocumentGrid cards={[card()]} />);
  assert.match(html, /<button[^>]*aria-haspopup="dialog"[^>]*aria-label="Xem Giấy chứng nhận"/);
  assert.match(html, /data-builder-item="items:0"/);
  assert.match(html, /data-builder-field="title">Giấy chứng nhận</);
  assert.match(html, /data-builder-field="description">Xem giấy chứng nhận</);
  assert.match(html, /<dialog[^>]*aria-labelledby=/);
});

test("Hộp thoại ảnh lớn đóng sẵn nên chưa tải ảnh lớn và chưa có nút chuyển giấy tờ", () => {
  const html = renderToStaticMarkup(<DocumentGrid cards={[card(), card({ title: "Giấy phép" })]} />);
  assert.doesNotMatch(html, /document-viewer__panel/);
  assert.doesNotMatch(html, /document-viewer__nav/);
});

test("Thẻ có đường dẫn ngoài là liên kết mở tab mới (không mở hộp thoại); đường dẫn trong trang là liên kết thường", () => {
  const external = renderToStaticMarkup(<DocumentGrid cards={[card({ href: "https://example.com/giay-phep.pdf" })]} />);
  assert.match(external, /<a[^>]*href="https:\/\/example\.com\/giay-phep\.pdf"[^>]*rel="noopener noreferrer"[^>]*target="_blank"/);
  assert.doesNotMatch(external, /<button/);
  const internal = renderToStaticMarkup(<DocumentGrid cards={[card({ href: "/contact" })]} />);
  assert.match(internal, /<a[^>]*class="document-card__open"[^>]*href="\/contact"/);
  assert.doesNotMatch(internal, /target="_blank"/);
});

test("Thẻ chưa có ảnh vẫn hiện nhưng không bấm được", () => {
  const html = renderToStaticMarkup(<DocumentGrid cards={[card({ image: null })]} />);
  assert.match(html, /document-card__open--static/);
  assert.match(html, /document-card__empty/);
  assert.doesNotMatch(html, /<button/);
  assert.doesNotMatch(html, /<img/);
});

test("Mô tả để trống thì không dựng dòng mô tả", () => {
  const html = renderToStaticMarkup(<DocumentGrid cards={[card({ caption: null })]} />);
  assert.doesNotMatch(html, /document-card__caption/);
});
