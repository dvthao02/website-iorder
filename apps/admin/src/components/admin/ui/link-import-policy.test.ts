import assert from "node:assert/strict";
import test from "node:test";

import { interpretLinkImport, shouldAutoImportLink, titleFromLink } from "./link-import-policy";

const asset = { id: "11111111-1111-4111-8111-111111111111", originalName: "iOrder-Setup.zip", mimeType: "application/zip", fileSize: 1024, altText: null, caption: null, url: "/media/uploads/abc.zip", version: 0 };

test("phản hồi đã vào thư viện cho ra tệp; thiếu hoặc sai dạng coi là giữ link", () => {
  assert.deepEqual(interpretLinkImport({ result: "imported", asset }), { kind: "imported", asset });
});

test("giữ nguyên dạng link kèm lý do của máy chủ, có lý do dự phòng khi phản hồi lạ", () => {
  assert.deepEqual(interpretLinkImport({ result: "kept_as_link", reason: "unsupported_type", message: "  Chỉ lưu được PDF và ZIP.  " }), { kind: "link", message: "Chỉ lưu được PDF và ZIP." });
  for (const payload of [null, undefined, 5, "x", {}, { result: "imported" }, { result: "imported", asset: { id: "không hợp lệ" } }, { result: "kept_as_link", message: "   " }]) {
    const outcome = interpretLinkImport(payload);
    assert.equal(outcome.kind, "link");
    assert.ok(outcome.kind === "link" && outcome.message.length > 0);
  }
});

test("chỉ tự tải khi bật tự tải, link hợp lệ và chưa thử link đó", () => {
  const base = { autoImport: true, url: "https://example.com/iOrder-Setup.zip", lastTried: "" };
  assert.equal(shouldAutoImportLink(base), true);
  assert.equal(shouldAutoImportLink({ ...base, url: "  https://example.com/a.zip  " }), true);
  assert.equal(shouldAutoImportLink({ ...base, autoImport: false }), false);
  assert.equal(shouldAutoImportLink({ ...base, lastTried: base.url }), false);
  for (const url of ["", "   ", "http://example.com/a.zip", "javascript:alert(1)", "example.com/a.zip", "https://user:pass@example.com/a.zip", "htt"]) {
    assert.equal(shouldAutoImportLink({ ...base, url }), false, url);
  }
});

test("tên hiển thị gợi ý từ tên tệp trong link", () => {
  assert.equal(titleFromLink("https://example.com/tai-ve/iOrder_Setup-v2.exe"), "iOrder Setup v2");
  assert.equal(titleFromLink("https://example.com/C%C3%A0i%20%C4%91%E1%BA%B7t.zip"), "Cài đặt");
  assert.equal(titleFromLink("https://example.com/"), "");
  assert.equal(titleFromLink("không phải link"), "");
});
