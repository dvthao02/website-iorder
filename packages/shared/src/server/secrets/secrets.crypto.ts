import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Mã hóa giá trị khóa trước khi lưu database: AES-256-GCM (mã hóa có xác thực). Khóa chủ SECRETS_MASTER_KEY nằm ở môi trường máy chủ,
// KHÔNG nằm trong database nên bản sao lưu database một mình không đọc được khóa. Mỗi giá trị có nonce 96-bit ngẫu nhiên riêng, và tên khóa
// được ràng vào dữ liệu xác thực (AAD) để không thể hoán đổi bản mã giữa hai khóa. Dùng node:crypto có sẵn, không thêm thư viện.

export type SecretsErrorCode = "MASTER_KEY_MISSING" | "MASTER_KEY_INVALID" | "DECRYPT_FAILED" | "KEY_FILE_UNAVAILABLE";

export class SecretsError extends Error {
  constructor(readonly code: SecretsErrorCode, message: string) {
    super(message);
    this.name = "SecretsError";
  }
}

const formatVersion = "v1";
const keyDerivationInfo = "iorder-secrets-v1";

/** SECRETS_MASTER_KEY: base64 của đúng 32 byte ngẫu nhiên (openssl rand -base64 32). Không nhận mật khẩu tự đặt vì quá yếu để làm khóa. */
export function parseMasterKey(raw: string | undefined): Buffer {
  const value = raw?.trim();
  if (!value) throw new SecretsError("MASTER_KEY_MISSING", "Chưa đặt SECRETS_MASTER_KEY ở máy chủ nên chưa lưu được khóa trong CMS.");
  const bytes = /^[A-Za-z0-9+/_-]+={0,2}$/.test(value) ? Buffer.from(value, "base64") : Buffer.alloc(0);
  if (bytes.length !== 32) throw new SecretsError("MASTER_KEY_INVALID", "SECRETS_MASTER_KEY không hợp lệ: cần đúng 32 byte mã hóa base64 (tạo bằng lệnh openssl rand -base64 32).");
  return bytes;
}

function deriveKey(master: Buffer) {
  return Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), keyDerivationInfo, 32));
}

const encode = (bytes: Buffer) => bytes.toString("base64url");

/** Trả về chuỗi v1.nonce.tag.bảnmã (base64url, ngăn bằng dấu chấm). `name` là tên khóa, ràng vào bản mã. */
export function encryptSecret(plaintext: string, name: string, master: Buffer) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(master), nonce);
  cipher.setAAD(Buffer.from(name, "utf8"));
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [formatVersion, encode(nonce), encode(cipher.getAuthTag()), encode(encrypted)].join(".");
}

/** Sai khóa chủ, bản mã bị sửa hoặc đem sang khóa khác đều cho cùng một lỗi chung (không nêu lý do cụ thể). */
export function decryptSecret(payload: string, name: string, master: Buffer) {
  const [version, nonce, tag, encrypted] = payload.split(".");
  const failure = () => new SecretsError("DECRYPT_FAILED", "Không giải mã được khóa đã lưu (sai SECRETS_MASTER_KEY hoặc dữ liệu hỏng). Hãy nhập lại khóa.");
  if (version !== formatVersion || !nonce || !tag || encrypted === undefined) throw failure();
  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(master), Buffer.from(nonce, "base64url"));
    decipher.setAAD(Buffer.from(name, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw failure();
  }
}
