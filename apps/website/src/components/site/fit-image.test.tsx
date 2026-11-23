import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CoverPhoto } from "./cover-photo";
import { FitImage } from "./fit-image";

const imageTags = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);

test("FitImage: ảnh chính object-contain hiện đủ, phía sau là bản mờ cỡ nhỏ ẩn với trình đọc màn hình", () => {
  const [backdrop, main, ...rest] = imageTags(renderToStaticMarkup(<FitImage alt="Trạm sạc" builderField="image" className="transition" sizes="50vw" url="/anh.png" />));
  assert.equal(rest.length, 0);
  assert.match(main, /alt="Trạm sạc"/);
  assert.match(main, /class="[^"]*object-contain[^"]*"/);
  assert.match(main, /class="[^"]*transition[^"]*"/);
  assert.doesNotMatch(main, /object-cover/);
  assert.match(main, /data-builder-field="image"/);
  assert.match(backdrop, /alt=""/);
  assert.match(backdrop, /aria-hidden="true"/);
  assert.match(backdrop, /blur-2xl/);
  assert.match(backdrop, /sizes="96px"/);
  assert.doesNotMatch(backdrop, /data-builder-field/);
});

test("CoverPhoto: mặc định phủ kín khung (một ảnh, giữ nguyên cách cũ); fit=contain hiện đủ ảnh bằng FitImage", () => {
  const photos = [{ url: "/a.png", altText: null }];
  const cover = imageTags(renderToStaticMarkup(<CoverPhoto alt="Thẻ" className="object-cover" photos={photos} sizes="50vw" />));
  assert.equal(cover.length, 1);
  assert.match(cover[0], /object-cover/);
  const contain = imageTags(renderToStaticMarkup(<CoverPhoto alt="Thẻ" className="transition" fit="contain" photos={photos} sizes="50vw" />));
  assert.equal(contain.length, 2);
  assert.match(contain[0], /aria-hidden="true"/);
  assert.match(contain[1], /alt="Thẻ"/);
  assert.match(contain[1], /object-contain/);
  assert.doesNotMatch(contain[1], /object-cover/);
});

test("CoverPhoto: nhiều ảnh với fit=contain, mỗi ảnh hiện đủ (bản chính và bản mờ); alt riêng của ảnh được ưu tiên", () => {
  const photos = [{ url: "/a.png", altText: "Ảnh một" }, { url: "/b.png", altText: null }];
  const html = renderToStaticMarkup(<CoverPhoto alt="Thẻ" className="transition" fit="contain" photos={photos} sizes="50vw" />);
  const tags = imageTags(html);
  assert.equal(tags.length, 4);
  assert.equal(tags.filter(tag => /object-contain/.test(tag)).length, 2);
  assert.equal(tags.filter(tag => /aria-hidden="true"/.test(tag)).length, 2);
  assert.match(html, /alt="Ảnh một"/);
  assert.match(html, /alt="Thẻ"/);
  assert.doesNotMatch(html, /object-cover[^"]*"[^>]*alt="(Ảnh một|Thẻ)"/);
});

test("CoverPhoto: không có ảnh thì không vẽ gì", () => {
  assert.equal(renderToStaticMarkup(<CoverPhoto alt="Thẻ" className="" fit="contain" photos={[]} sizes="50vw" />), "");
});
