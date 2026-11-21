import { createHmac } from "node:crypto";

import type { AdministratorLoginInput } from "./auth.schema";
import { clearLoginThrottle, consumeLoginThrottle, type LoginThrottleKey } from "./login-throttle.repository";

const windowMilliseconds = 15 * 60 * 1_000;
const ipAttemptLimit = 10;
const usernameAttemptLimit = 5;

function throttleSalt() {
  return process.env.LEAD_IP_HASH_SALT ?? "iorder-v2-development-login-throttle-salt";
}

function fingerprint(scope: LoginThrottleKey["scope"], value: string) {
  return createHmac("sha256", throttleSalt()).update(`${scope}:${value}`).digest("hex");
}

export function loginThrottleKeys(input: AdministratorLoginInput, ipAddress: string | null): LoginThrottleKey[] {
  const keys: LoginThrottleKey[] = [{ scope: "username", hash: fingerprint("username", input.username.toLocaleLowerCase("en-US")), limit: usernameAttemptLimit }];
  if (ipAddress) keys.push({ scope: "ip", hash: fingerprint("ip", ipAddress), limit: ipAttemptLimit });
  return keys;
}

export class LoginRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Đăng nhập bị giới hạn tạm thời.");
    this.name = "LoginRateLimitError";
  }
}

export async function consumeAdministratorLoginAttempt(input: AdministratorLoginInput, ipAddress: string | null) {
  const result = await consumeLoginThrottle(loginThrottleKeys(input, ipAddress), new Date(), windowMilliseconds);
  if (!result.allowed) throw new LoginRateLimitError(result.retryAfterSeconds);
}

export async function clearAdministratorLoginAttempt(input: AdministratorLoginInput, ipAddress: string | null) {
  await clearLoginThrottle(loginThrottleKeys(input, ipAddress));
}
