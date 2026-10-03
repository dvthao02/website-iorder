import { createHash, randomBytes } from "node:crypto";

import type { AdministratorLoginInput } from "./auth.schema";
import { InvalidAdministratorCredentialsError } from "./auth.errors";
import {
  createSessionForUser,
  findActiveAdministratorByUsername,
  findActiveAdministratorSession,
  revokeSessionByTokenHash,
} from "./auth.repository";
import { verifyPassword } from "./password";

export const administratorSessionCookieName = "iorder_admin_session";
export const administratorSessionMaxAgeSeconds = 60 * 60 * 24 * 7;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function signInAdministrator(input: AdministratorLoginInput, userAgent?: string) {
  const user = await findActiveAdministratorByUsername(input.username);

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
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

  return findActiveAdministratorSession(hashSessionToken(token), new Date());
}

export async function signOutAdministrator(token: string | undefined) {
  if (token) {
    await revokeSessionByTokenHash(hashSessionToken(token));
  }
}
