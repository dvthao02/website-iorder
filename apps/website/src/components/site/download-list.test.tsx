import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createTranslate } from "../../lib/translate";
import { DownloadList, type DownloadListItem } from "./download-list";

const item = (id: string, title: string, groupName: string | null, downloadUrl: string, extra: Partial<DownloadListItem> = {}): DownloadListItem => ({ id, title, groupName, meta: null, description: null, downloadUrl, external: downloadUrl.startsWith("https://"), ...extra });
const rows = (html: string) => html.match(/data-testid="download-row"/g)?.length ?? 0;

test("mỗi tệp một ô; link ngoài mở tab mới và ghi nguồn tải, tệp trong thư viện tải thẳng", () => {
  const html = renderToStaticMarkup(<DownloadList items={[item("1", "Driver Xprinter", null, "https://drive.google.com/uc?export=download&id=1", { meta: "Máy in hóa đơn" }), item("2", "Hướng dẫn", null, "/media/uploads/a.pdf", { description: "Tài liệu cài đặt" })]} />);
  assert.equal(rows(html), 2);
  assert.match(html, /Tải từ drive\.google\.com/);
  assert.match(html, /target="_blank"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*target="_blank"/);
  assert.match(html, /href="\/media\/uploads\/a\.pdf"/);
  assert.match(html, /\sdownload(=""|\s|>)/);
  assert.match(html, />PDF</);
  assert.match(html, /Tài liệu cài đặt/);
  assert.match(html, />Máy in hóa đơn</);
});

test("nút tải luôn có nhãn Tải xuống cho trình đọc màn hình (trên điện thoại chỉ ẩn bằng sr-only)", () => {
  const html = renderToStaticMarkup(<DownloadList items={[item("1", "A", null, "/media/uploads/a.zip")]} />);
  assert.match(html, /<span class="max-sm:sr-only">Tải xuống<\/span>/);
});

test("chia theo nhóm: mỗi nhóm một thẻ có tiêu đề kèm số tệp, tệp chưa có nhóm vào Khác ở cuối", () => {
  const html = renderToStaticMarkup(<DownloadList items={[
    item("1", "Máy in XPrinter", "Driver trên Windows", "/media/a.zip"), item("2", "Máy in ZyWell", "Driver trên Windows", "/media/b.zip"),
    item("3", "Máy in XPrinter", "Driver trên macOS", "/media/c.zip"), item("4", "Printer Anywhere", null, "/media/d.zip"),
  ]} />);
  assert.equal(rows(html), 4);
  assert.equal(html.match(/<section/g)?.length, 3);
  const headings = [...html.matchAll(/<h3[^>]*>[\s\S]*?<\/h3>/g)].map(match => match[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  assert.deepEqual(headings, ["Driver trên Windows (2)", "Driver trên macOS (1)", "Khác (1)"]);
});

test("không tệp nào có nhóm: một thẻ duy nhất, không tiêu đề", () => {
  const html = renderToStaticMarkup(<DownloadList items={[item("1", "A", null, "/media/a.zip"), item("2", "B", "  ", "/media/b.zip")]} />);
  assert.doesNotMatch(html, /<h3/);
  assert.equal(html.match(/<section/g)?.length, 1);
});

test("grouped=false không chia dù tệp có nhóm; cấp tiêu đề nhóm theo Heading", () => {
  const items = [item("1", "A", "X", "/media/a.zip"), item("2", "B", "Y", "/media/b.zip")];
  assert.doesNotMatch(renderToStaticMarkup(<DownloadList grouped={false} items={items} />), /<h3/);
  assert.match(renderToStaticMarkup(<DownloadList Heading="h2" items={items} />), /<h2[^>]*>/);
});

test("hai cột từ máy tính (ô lẻ cuối trải hết hàng); columns=1 là một cột", () => {
  const items = [item("1", "A", null, "/media/a.zip")];
  assert.match(renderToStaticMarkup(<DownloadList items={items} />), /lg:grid-cols-2/);
  assert.doesNotMatch(renderToStaticMarkup(<DownloadList columns={1} items={items} />), /lg:grid-cols-2/);
});

test("nhãn loại tệp bỏ đi khi thông tin phụ đã nêu loại tệp", () => {
  const html = renderToStaticMarkup(<DownloadList items={[item("1", "Bộ cài", null, "https://example.com/setup.exe", { meta: "EXE · 80 MB" })]} />);
  assert.match(html, />EXE · 80 MB</);
  assert.equal(html.match(/>EXE</g)?.length ?? 0, 0);
});

test("chữ cố định theo ngôn ngữ khách chọn: nhãn nút, nguồn tải, nhóm Khác và nhãn danh sách đều đi qua t (không còn chữ tiếng Việt viết cứng)", () => {
  const t = createTranslate({ "download.button": "Download", "download.from": "From {host}", "download.other": "Other", "download.listLabel": "Support files" });
  const html = renderToStaticMarkup(<DownloadList items={[item("1", "A", "Driver", "https://drive.google.com/uc?id=1"), item("2", "B", null, "/media/b.zip")]} t={t} />);
  assert.match(html, />Download</);
  assert.match(html, /From drive\.google\.com/);
  assert.match(html, /Other \(1\)|Other\s*<span[^>]*>\(1\)/);
  assert.match(html, /aria-label="Support files"/);
  assert.doesNotMatch(html, /Tải xuống|Tải từ|Khác|Tệp hỗ trợ/);
});
