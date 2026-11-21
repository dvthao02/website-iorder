import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AuthorByline } from "./author-byline";

const author = { name: "Nguyễn Văn An", jobTitle: "Chuyên viên triển khai", pagePath: null, profileUrl: null };

test("Không có tác giả hoặc tên trống thì không hiện gì", () => {
  assert.equal(renderToStaticMarkup(<AuthorByline author={null} />), "");
  assert.equal(renderToStaticMarkup(<AuthorByline author={{ ...author, name: "  " }} />), "");
});

test("Tác giả khách không có liên kết: 'Tác giả: tên, chức danh' là chữ thường", () => {
  const html = renderToStaticMarkup(<AuthorByline author={author} />);
  assert.match(html, /Tác giả: <strong[^>]*>Nguyễn Văn An<\/strong><span>, Chuyên viên triển khai<\/span>/);
  assert.doesNotMatch(html, /<a /);
  assert.doesNotMatch(renderToStaticMarkup(<AuthorByline author={{ ...author, jobTitle: null }} />), /, /);
});

test("Có hồ sơ ngoài thì tên là liên kết rel=author mở tab mới", () => {
  const html = renderToStaticMarkup(<AuthorByline author={{ ...author, profileUrl: "https://www.linkedin.com/in/an" }} />);
  assert.match(html, /<a [^>]*href="https:\/\/www\.linkedin\.com\/in\/an"[^>]*rel="author noopener"[^>]*target="_blank"[^>]*>Nguyễn Văn An<\/a>/);
});

test("Có trang riêng trên website thì tên là liên kết nội bộ (ưu tiên hơn hồ sơ ngoài), không mở tab mới", () => {
  const html = renderToStaticMarkup(<AuthorByline author={{ ...author, pagePath: "/tac-gia/nguyen-van-an", profileUrl: "https://www.linkedin.com/in/an" }} />);
  // Next Link xuất thuộc tính theo thứ tự riêng nên kiểm từng thuộc tính, không dựa vào thứ tự.
  const link = /<a ([^>]*)>Nguyễn Văn An<\/a>/.exec(html)?.[1] ?? "";
  assert.match(link, /href="\/tac-gia\/nguyen-van-an"/);
  assert.match(link, /rel="author"/);
  assert.doesNotMatch(html, /linkedin|_blank/);
});
