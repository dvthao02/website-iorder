import { hasDatabaseErrorCode } from "../shared/database-error";
import { logger } from "../shared/logger";
import { avatarUploadOptions, deleteAdminMedia, uploadAdminMedia } from "../media/media.service";
import { AccountUnavailableError, changeOwnPasswordSchema, CurrentPasswordMismatchError, ProfileEmailInUseError, updateOwnProfileSchema } from "./account.contract";
import { findActivePasswordHash, replaceOwnAvatar, replaceOwnPassword, updateOwnProfile as saveOwnProfile } from "./auth.repository";
import { clearAdministratorLoginAttempt, consumeAdministratorLoginAttempt } from "./login-throttle";
import { hashPassword, verifyPassword } from "./password";

type AccountActor = { userId: string; username: string; sessionId: string };

/** Họ tên, email, số điện thoại của chính tài khoản. Email trùng tài khoản khác báo lỗi tiếng Việt, không lộ lỗi PostgreSQL. */
export async function updateOwnProfile(actor: Pick<AccountActor, "userId">, input: unknown) {
  const values = updateOwnProfileSchema.parse(input);
  try {
    const saved = await saveOwnProfile(actor.userId, values);
    if (!saved) throw new AccountUnavailableError();
    return saved;
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23505")) throw new ProfileEmailInUseError();
    throw error;
  }
}

// Ảnh đại diện cũ đã thay hoặc bỏ thì chuyển vào hàng đợi xóa của thư viện media. Ảnh còn được nơi khác dùng (MediaInUseError)
// hoặc lỗi dọn dẹp không được làm hỏng thao tác chính, nên chỉ ghi log.
async function discardAvatarMedia(mediaId: string | null, userId: string) {
  if (!mediaId) return;
  try {
    await deleteAdminMedia(mediaId, userId);
  } catch (error) {
    logger.warn("Không dọn được ảnh đại diện cũ khỏi thư viện media.", { mediaId, error });
  }
}

/** Tải ảnh đại diện mới lên (chỉ PNG/JPEG/WebP, tối đa 2 MB) và gắn vào tài khoản; ảnh cũ được dọn. */
export async function setOwnAvatar(actor: Pick<AccountActor, "userId">, file: File) {
  const asset = await uploadAdminMedia(file, actor.userId, avatarUploadOptions);
  let replaced: Awaited<ReturnType<typeof replaceOwnAvatar>>;
  try {
    replaced = await replaceOwnAvatar(actor.userId, asset.id);
  } catch (error) {
    await discardAvatarMedia(asset.id, actor.userId);
    throw error;
  }
  if (!replaced) {
    await discardAvatarMedia(asset.id, actor.userId);
    throw new AccountUnavailableError();
  }
  await discardAvatarMedia(replaced.previousMediaId, actor.userId);
  return { avatarUrl: asset.url };
}

export async function removeOwnAvatar(actor: Pick<AccountActor, "userId">) {
  const replaced = await replaceOwnAvatar(actor.userId, null);
  if (!replaced) throw new AccountUnavailableError();
  await discardAvatarMedia(replaced.previousMediaId, actor.userId);
}

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
