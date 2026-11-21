import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
import { PostRows, PostSpotlight } from "./post-collection";

const post = (n: number, patch: Partial<PublicPostSummary> = {}): PublicPostSummary => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, type: "news", title: `Bài viết số ${n}`, slug: `bai-viet-${n}`, excerpt: `Tóm tắt bài ${n}`,
  publishedAt: new Date("2026-11-01T03:00:00Z"), createdAt: new Date("2026-10-30T03:00:00Z"), updatedAt: new Date("2026-11-02T03:00:00Z"),
  cover: { url: `/media/uploads/${n}.jpg`, altText: `Ảnh bài ${n}` }, categories: [{ id: "00000000-0000-4000-8000-0000000000aa", name: "Kinh nghiệm kinh doanh", slug: "kinh-nghiem-kinh-doanh" }], tags: [], ...patch,
});

test("Bố cục nổi bật: bài đầu to có ảnh có alt, nhãn chủ đề, tóm tắt và 'Đọc tiếp'; các bài sau thành danh sách gọn", () => {
  const html = renderToStaticMarkup(<PostSpotlight posts={[post(1), post(2), post(3)]} />);
  assert.match(html, /href="\/tin-tuc\/bai-viet-1"/);
  assert.match(html, /alt="Ảnh bài 1"/);
  assert.match(html, /<h3[^>]*>Bài viết số 1<\/h3>/);
  assert.match(html, /Tóm tắt bài 1/);
  assert.match(html, /Đọc tiếp/);
  assert.match(html, /<time dateTime="2026-11-01T03:00:00.000Z">/);
  // Bài phụ: ảnh trang trí (alt rỗng) vì tiêu đề đã nằm cạnh; có tóm tắt ngắn (CSS ẩn trên điện thoại).
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
  assert.match(html, /post-side__excerpt">Tóm tắt bài 2</);
  assert.match(html, /<img alt=""/);
});

test("Bố cục nổi bật: một bài thì không có danh sách bên phải; không bài thì không vẽ gì; cấp tiêu đề theo khối", () => {
  assert.doesNotMatch(renderToStaticMarkup(<PostSpotlight posts={[post(1)]} />), /post-spotlight__side/);
  assert.equal(renderToStaticMarkup(<PostSpotlight posts={[]} />), "");
  assert.match(renderToStaticMarkup(<PostSpotlight Heading="h2" posts={[post(1), post(2)]} />), /<h2[^>]*>Bài viết số 2<\/h2>/);
});

test("Bài chưa có ảnh bìa vẫn hiển thị đủ chữ và liên kết, không có thẻ img", () => {
  const bare = (n: number) => post(n, { cover: null });
  const spotlight = renderToStaticMarkup(<PostSpotlight posts={[bare(1), bare(2)]} />);
  assert.doesNotMatch(spotlight, /<img/);
  assert.match(spotlight, /href="\/tin-tuc\/bai-viet-2"/);
  const rows = renderToStaticMarkup(<PostRows posts={[bare(1)]} />);
  assert.doesNotMatch(rows, /<img/);
  assert.match(rows, /Bài viết số 1/);
});

test("Danh sách ngang: mỗi bài một hàng có nhãn, ngày, tiêu đề, tóm tắt; bài khuyến mãi dùng nhãn loại khi chưa có chuyên mục", () => {
  const html = renderToStaticMarkup(<PostRows posts={[post(1), post(2, { type: "promotion", categories: [] })]} />);
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
  assert.match(html, /Kinh nghiệm kinh doanh/);
  assert.match(html, /Khuyến mãi/);
  assert.match(html, /Tóm tắt bài 2/);
});
