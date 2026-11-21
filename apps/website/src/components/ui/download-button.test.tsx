import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DownloadButton } from "./download-button";

test("tệp trong thư viện tải thẳng bằng thuộc tính download, không mở tab mới", () => {
  const html = renderToStaticMarkup(<DownloadButton external={false} href="/media/uploads/goi-cai-dat.zip" />);
  assert.match(html, /href="\/media\/uploads\/goi-cai-dat\.zip"/);
  assert.match(html, /\sdownload(=""|\s|>)/);
  assert.doesNotMatch(html, /target=/);
  assert.match(html, />Tải xuống</);
});

test("link ngoài mở ở tab mới với rel an toàn và không gắn download", () => {
  const html = renderToStaticMarkup(<DownloadButton className="button button--primary shrink-0" external href="https://example.com/tai-ve/iOrder-Setup.exe" />);
  assert.match(html, /href="https:\/\/example\.com\/tai-ve\/iOrder-Setup\.exe"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /\sdownload(=""|\s|>)/);
  assert.match(html, /class="button button--primary shrink-0"/);
});

test("nhãn nút đổi được", () => {
  assert.match(renderToStaticMarkup(<DownloadButton external href="https://example.com/a.exe">Tải bản Windows</DownloadButton>), />Tải bản Windows</);
});
