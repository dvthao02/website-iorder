import { verifyPassword } from "../auth/password";
import { logger } from "../shared/logger";
import { secretsRepository } from "./secrets.repository";
import { createKeyFileStore, resolveKeyFilePath } from "./secrets.keyfile";
import { createSecretsService } from "./secrets.service";

export { InvalidPasswordError, isMissingTableError, MasterKeyExistsError, TooManyAttemptsError } from "./secrets.service";
export { SecretsError } from "./secrets.crypto";
export { SecretValidationError } from "./secrets.catalog";

// Kho khóa API ở CMS. Khóa chủ lấy từ SECRETS_MASTER_KEY (thắng) hoặc tệp khóa chủ trên máy chủ (SECRETS_KEY_FILE, CMS có thể tự tạo). Xem secrets.service.ts.
const service = createSecretsService({
  repository: secretsRepository,
  env: process.env,
  now: () => new Date(),
  verifyPassword,
  log: (message, context) => logger.warn(message, context),
  keyFile: createKeyFileStore(resolveKeyFilePath(process.env)),
});

/** Trạng thái các khóa cho màn CMS (không có giá trị rõ). */
export const getSecretsOverview = service.getOverview;
/** Giá trị khóa đã lưu ở CMS: CHỈ dành cho dịch vụ nội bộ cần dùng khóa, không bao giờ đưa ra API/giao diện. */
export const getCmsSecret = service.getCmsSecret;
export const setSecret = service.setSecret;
/** Lưu nhiều biến của một công cụ cùng lúc (một lần xác nhận mật khẩu, kiểm tra hết rồi mới ghi). */
export const setSecrets = service.setSecrets;
export const clearSecret = service.clearSecret;
/** Tạo khóa chủ ngẫu nhiên và cất trong tệp trên máy chủ (không ghi đè khóa đã có). */
export const createMasterKey = service.createMasterKey;
/** Ghi/xóa khóa do máy chủ sinh ra (token OAuth của Gmail), không hỏi mật khẩu: người gọi đã gọi verifyReauthentication trước đó. */
export const putServerSecret = service.putServerSecret;
export const removeServerSecret = service.removeServerSecret;
export const verifyReauthentication = service.verifyReauthentication;
