import { createHmac, timingSafeEqual } from "node:crypto";

export const publicContentCacheTag = "public-content";

export function signPublicCacheInvalidation(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyPublicCacheInvalidation(secret: string, timestamp: string, body: string, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = Buffer.from(signPublicCacheInvalidation(secret, timestamp, body), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
