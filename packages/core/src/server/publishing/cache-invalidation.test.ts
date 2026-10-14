import assert from "node:assert/strict";
import test from "node:test";

import { signPublicCacheInvalidation, verifyPublicCacheInvalidation } from "./cache-invalidation";

test("xac thuc chu ky HMAC cua invalidation cache public", () => {
  const secret = "kiem-thu-secret-du-dai-va-khong-dung-production";
  const timestamp = "1760414400000";
  const body = '{"tags":["public-content"]}';
  const signature = signPublicCacheInvalidation(secret, timestamp, body);

  assert.equal(verifyPublicCacheInvalidation(secret, timestamp, body, signature), true);
  assert.equal(verifyPublicCacheInvalidation(secret, timestamp, '{"tags":[]}', signature), false);
  assert.equal(verifyPublicCacheInvalidation(secret, timestamp, body, "not-a-signature"), false);
});
