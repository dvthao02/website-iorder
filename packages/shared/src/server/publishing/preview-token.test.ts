import assert from "node:assert/strict";
import test from "node:test";

import { createPreviewToken, previewTokenTtlSeconds, verifyPreviewToken } from "./preview-token";

const id = "3f2b9c1e-1111-4a2b-9c3d-123456789abc";

test("token xem trước hợp lệ trả đúng loại và id", () => {
  const now = Date.UTC(2026, 9, 19, 3);
  const claims = verifyPreviewToken(createPreviewToken("post", id, now), now + 1000);
  assert.deepEqual(claims, { kind: "post", id, exp: now / 1000 + previewTokenTtlSeconds });
});

test("token hết hạn, bị sửa hoặc sai dạng đều bị từ chối", () => {
  const now = Date.UTC(2026, 9, 19, 3);
  const token = createPreviewToken("page", id, now);
  assert.equal(verifyPreviewToken(token, now + previewTokenTtlSeconds * 1000), null);
  const [version, payload, signature] = token.split(".");
  // Đổi id trong payload nhưng giữ chữ ký cũ.
  const forged = Buffer.from(JSON.stringify({ kind: "page", id: "00000000-0000-4000-8000-000000000000", exp: now / 1000 + 60 })).toString("base64url");
  assert.equal(verifyPreviewToken(`${version}.${forged}.${signature}`, now), null);
  assert.equal(verifyPreviewToken(`${version}.${payload}.${signature.slice(0, -2)}xx`, now), null);
  for (const value of [null, "", "v1", "v2.a.b", "x".repeat(600)]) assert.equal(verifyPreviewToken(value, now), null);
});
