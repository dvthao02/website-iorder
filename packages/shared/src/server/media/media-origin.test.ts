import assert from "node:assert/strict";
import { test } from "node:test";
import { getOriginalRequestHost, isMediaUploadOriginAllowed } from "./media-origin";

test("Origin sai định dạng không ném lỗi và bị từ chối", () => {
  for (const origin of ["null", "khong-phai-url", "http://[", "https://"]) {
    assert.equal(isMediaUploadOriginAllowed(origin, "localhost:3002"), false);
  }
});
test("Host khác, port khác hoặc thiếu Host bị từ chối", () => {
  assert.equal(isMediaUploadOriginAllowed("http://localhost:3001", "localhost:3002"), false);
  assert.equal(isMediaUploadOriginAllowed("https://khac.example", "cms.example"), false);
  assert.equal(isMediaUploadOriginAllowed("http://localhost:3002", null), false);
});
test("Giữ hành vi cùng host và request không có Origin", () => {
  assert.equal(isMediaUploadOriginAllowed("http://localhost:3002", "localhost:3002"), true);
  assert.equal(isMediaUploadOriginAllowed("https://cms.example", "cms.example"), true);
  assert.equal(isMediaUploadOriginAllowed(null, "localhost:3002"), true);
});

test("Dùng host gốc Caddy chuyển tiếp trước host nội bộ của backend", () => {
  assert.equal(getOriginalRequestHost(new Headers({ host: "backend:3000", "x-forwarded-host": "cms.example" })), "cms.example");
  assert.equal(getOriginalRequestHost(new Headers({ host: "backend:3000" })), "backend:3000");
});
