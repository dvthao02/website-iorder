import { changeOwnPasswordSchema, CurrentPasswordMismatchError } from "./account.contract";
import { findActivePasswordHash, replaceOwnPassword } from "./auth.repository";
import { clearAdministratorLoginAttempt, consumeAdministratorLoginAttempt } from "./login-throttle";
import { hashPassword, verifyPassword } from "./password";

type AccountActor = { userId: string; username: string; sessionId: string };

/**
 * Tài khoản tự đổi mật khẩu. Sai mật khẩu hiện tại tính chung giới hạn thử với đăng nhập
 * (theo tên đăng nhập và IP) để phiên bị lộ không dò được mật khẩu. Trả về số phiên khác đã bị đăng xuất.
 */
export async function changeOwnPassword(actor: AccountActor, input: unknown, ipAddress: string | null) {
  const values = changeOwnPasswordSchema.parse(input);
  const attempt = { username: actor.username, password: values.currentPassword };
  await consumeAdministratorLoginAttempt(attempt, ipAddress);
  const storedHash = await findActivePasswordHash(actor.userId);
  if (!storedHash || !(await verifyPassword(values.currentPassword, storedHash))) throw new CurrentPasswordMismatchError();
  await clearAdministratorLoginAttempt(attempt, ipAddress);
  return replaceOwnPassword(actor.userId, actor.sessionId, await hashPassword(values.newPassword));
}
