import { createHmac, timingSafeEqual } from "node:crypto";

export const publicContentCacheTag = "public-content";
export const serverOriginSecretHeader = "x-iorder-origin-secret";

export function serverOriginHeaders(secret: string | undefined) {
  const value = secret?.trim();
  return value ? { [serverOriginSecretHeader]: value } : undefined;
}

export function verifyServerOriginSecret(secret: string | undefined, received: string | null) {
  const expected = secret?.trim();
  const actual = received?.trim();
  if (!expected || !actual) return false;

  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export function signPublicCacheInvalidation(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyPublicCacheInvalidation(secret: string, timestamp: string, body: string, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = Buffer.from(signPublicCacheInvalidation(secret, timestamp, body), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
