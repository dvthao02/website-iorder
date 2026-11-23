import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
import { ArticleAuthorBox, ArticlePager, ArticleSummary } from "./article-extras";

const post = (n: number): PublicPostSummary => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, type: "news", title: `Bài viết số ${n}`, slug: `bai-viet-${n}`, excerpt: null,
  publishedAt: new Date("2026-11-01T03:00:00Z"), createdAt: new Date("2026-10-30T03:00:00Z"), updatedAt: new Date("2026-11-02T03:00:00Z"), cover: null, categories: [], tags: [],
});

test("Tóm tắt nhanh: mỗi ý là liên kết tới đúng phần (neo), có tiêu đề cho trình đọc màn hình; không có ý nào thì không vẽ gì", () => {
  const html = renderToStaticMarkup(<ArticleSummary points={[{ id: "vi-sao", heading: "Vì sao cần", text: "Chia ca giúp trách nhiệm rõ ràng." }, { id: "quy-trinh", heading: "Quy trình", text: "Đếm tiền mặt rồi so với hệ thống." }]} />);
  assert.match(html, /aria-labelledby="tom-tat-nhanh"/);
  assert.match(html, /id="tom-tat-nhanh"[^>]*>.*Tóm tắt nhanh/);
  assert.match(html, /<a href="#vi-sao"><strong>Vì sao cần<\/strong><span>Chia ca giúp trách nhiệm rõ ràng\.<\/span><\/a>/);
  assert.equal(renderToStaticMarkup(<ArticleSummary points={null} />), "");
  assert.equal(renderToStaticMarkup(<ArticleSummary points={[]} />), "");
});

test("Hộp tác giả: chữ cái đầu, tên là liên kết tới trang riêng (rel=author) hoặc hồ sơ ngoài, chức danh nếu có; không tên thì không vẽ", () => {
  const guest = renderToStaticMarkup(<ArticleAuthorBox author={{ name: "ngô văn an", jobTitle: "Chuyên viên triển khai", pagePath: null, profileUrl: null }} />);
  assert.match(guest, /article-author__avatar">N</);
  assert.match(guest, /<strong class="article-author__name">ngô văn an<\/strong>/);
  assert.match(guest, /Chuyên viên triển khai/);
  assert.doesNotMatch(guest, /<a /);
  const own = renderToStaticMarkup(<ArticleAuthorBox author={{ name: "An", jobTitle: null, pagePath: "/author/an", profileUrl: null }} />);
  assert.match(own, /<a class="article-author__name"[^>]*href="\/author\/an"[^>]*>An<\/a>/);
  assert.match(own, /rel="author"/);
  assert.match(renderToStaticMarkup(<ArticleAuthorBox author={{ name: "An", jobTitle: null, pagePath: null, profileUrl: "https://example.com/an" }} />), /href="https:\/\/example.com\/an" rel="author noopener" target="_blank"/);
  assert.equal(renderToStaticMarkup(<ArticleAuthorBox author={null} />), "");
  assert.equal(renderToStaticMarkup(<ArticleAuthorBox author={{ name: "  ", jobTitle: null, pagePath: null, profileUrl: null }} />), "");
});

test("Bài cũ hơn bên trái (rel prev), mới hơn bên phải (rel next); thiếu một phía thì chỉ hiện phía còn lại, không có phía nào thì không vẽ", () => {
  const both = renderToStaticMarkup(<ArticlePager newer={post(1)} older={post(3)} />);
  assert.ok(both.indexOf("Bài cũ hơn") < both.indexOf("Bài mới hơn"), "bài cũ hơn đứng trước (bên trái)");
  assert.match(both, /href="\/news\/bai-viet-3"[^>]*rel="prev"|rel="prev"[^>]*href="\/news\/bai-viet-3"/);
  assert.match(both, /href="\/news\/bai-viet-1"[^>]*rel="next"|rel="next"[^>]*href="\/news\/bai-viet-1"/);
  const onlyNewer = renderToStaticMarkup(<ArticlePager newer={post(1)} older={null} />);
  assert.doesNotMatch(onlyNewer, /Bài cũ hơn/);
  assert.match(onlyNewer, /Bài viết số 1/);
  assert.equal(renderToStaticMarkup(<ArticlePager newer={null} older={null} />), "");
});
