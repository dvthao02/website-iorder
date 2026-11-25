import assert from "node:assert/strict";
import test from "node:test";

import {
  serverOriginHeaders,
  serverOriginSecretHeader,
  signPublicCacheInvalidation,
  verifyPublicCacheInvalidation,
  verifyServerOriginSecret,
} from "./cache-invalidation";

test("xac thuc chu ky HMAC cua invalidation cache public", () => {
  const secret = "kiem-thu-secret-du-dai-va-khong-dung-production";
  const timestamp = "1760414400000";
  const body = '{"tags":["public-content"]}';
  const signature = signPublicCacheInvalidation(secret, timestamp, body);

  assert.equal(verifyPublicCacheInvalidation(secret, timestamp, body, signature), true);
  assert.equal(verifyPublicCacheInvalidation(secret, timestamp, '{"tags":[]}', signature), false);
  assert.equal(verifyPublicCacheInvalidation(secret, timestamp, body, "not-a-signature"), false);
});

test("xac thuc secret giua website va Backend bang so sanh constant-time", () => {
  const secret = "secret-noi-bo-chi-dung-o-may-chu";

  assert.deepEqual(serverOriginHeaders(`  ${secret}  `), { [serverOriginSecretHeader]: secret });
  assert.equal(serverOriginHeaders("  "), undefined);
  assert.equal(verifyServerOriginSecret(secret, secret), true);
  assert.equal(verifyServerOriginSecret(secret, "secret-sai"), false);
  assert.equal(verifyServerOriginSecret(secret, "x"), false);
  assert.equal(verifyServerOriginSecret(undefined, secret), false);
});
