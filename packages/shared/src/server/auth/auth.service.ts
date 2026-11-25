import { createHash, randomBytes } from "node:crypto";

import { currentRequestContext } from "../shared/request-context";

import type { AdministratorLoginInput } from "./auth.schema";
import { InvalidAdministratorCredentialsError } from "./auth.errors";
import { clearAdministratorLoginAttempt, consumeAdministratorLoginAttempt } from "./login-throttle";
import {
  createSessionForUser,
  findActiveAdministratorByUsername,
  findActiveAdministratorSession,
  recordFailedLogin,
  revokeSessionByTokenHash,
} from "./auth.repository";
import { mediaPath } from "../media/media-path";
import { verifyPassword } from "./password";

export const administratorSessionCookieName = "iorder_admin_session";
export const administratorSessionMaxAgeSeconds = 60 * 60 * 24 * 7;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function signInAdministrator(input: AdministratorLoginInput, userAgent?: string, ipAddress: string | null = null) {
  await consumeAdministratorLoginAttempt(input, ipAddress);
  const user = await findActiveAdministratorByUsername(input.username);

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    if (user) await recordFailedLogin(user.id);
    throw new InvalidAdministratorCredentialsError();
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + administratorSessionMaxAgeSeconds * 1_000);

  await createSessionForUser({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
    userAgent,
  });
  await clearAdministratorLoginAttempt(input, ipAddress);

  return {
    token,
    expiresAt,
    user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
  };
}

export async function getCurrentAdministrator(token: string | undefined) {
  if (!token) {
    return undefined;
  }

  const session = await findActiveAdministratorSession(hashSessionToken(token), new Date());
  if (!session) return undefined;
  // Từ đây các truy vấn trong request biết ai đang xem, để che tài khoản ẩn khỏi người khác (users/hidden-users.ts).
  const context = currentRequestContext();
  if (context) context.viewerId = session.userId;
  const { avatarStorageKey, ...administrator } = session;
  return { ...administrator, avatarUrl: avatarStorageKey ? mediaPath(avatarStorageKey) : null };
}

export async function signOutAdministrator(token: string | undefined) {
  if (token) {
    await revokeSessionByTokenHash(hashSessionToken(token));
  }
}
