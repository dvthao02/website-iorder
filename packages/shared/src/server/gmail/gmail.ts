import { getCmsSecret, getSecretsOverview, putServerSecret, removeServerSecret, verifyReauthentication } from "../secrets/secrets";
import { logger } from "../shared/logger";
import { gmailRepository } from "./gmail.repository";
import { createGmailService } from "./gmail.service";

export { GmailError } from "./gmail.service";
export { GoogleOAuthError } from "./gmail.google";
export { InvalidPasswordError, SecretsError, TooManyAttemptsError } from "../secrets/secrets";
export { ContentVersionConflictError } from "../shared/content-version";

// Gmail báo liên hệ mới với phụ thuộc thật: kho cài đặt (site_settings), kho khóa mã hóa (secrets), fetch toàn cục và logger. Xem gmail.service.ts.
const service = createGmailService({
  repository: gmailRepository,
  secrets: {
    get: getCmsSecret,
    put: putServerSecret,
    remove: removeServerSecret,
    verifyPassword: ({ userId, password }) => verifyReauthentication({ userId, password, subject: "gmail_refresh_token" }),
    masterKeyState: async () => (await getSecretsOverview()).masterKey,
  },
  env: process.env,
  // Gọi qua globalThis.fetch mỗi lần để dùng bản fetch hiện hành (kể cả lớp giới hạn thời gian của website/Next).
  fetch: (input, init) => globalThis.fetch(input, init),
  now: () => new Date(),
  log: (message, context) => logger.warn(message, context),
});

export const getGmailStatus = service.getStatus;
export const startGmailConnect = service.startConnect;
export const finishGmailConnect = service.finishConnect;
export const disconnectGmail = service.disconnect;
export const sendGmailTest = service.sendTest;
export const updateGmailSettings = service.updateSettings;
/** Báo liên hệ mới qua Gmail; không bao giờ ném lỗi. */
export const notifyNewLeadByGmail = service.notifyNewLead;
