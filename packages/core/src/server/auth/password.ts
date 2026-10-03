import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const keyLength = 64;
const algorithm = "scrypt";

/**
 * Băm mật khẩu kèm salt để lưu an toàn trong database.
 * Mật khẩu gốc không được trả về hoặc lưu lại.
 */
export async function hashPassword(password: string) {
  if (!password) {
    throw new Error("Mật khẩu không được để trống.");
  }

  const salt = randomBytes(16);
  const derivedKey = (await scryptAsync(password, salt, keyLength)) as Buffer;

  return `${algorithm}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

/**
 * Đối chiếu mật khẩu đăng nhập với giá trị do hashPassword() tạo ra.
 */
export async function verifyPassword(password: string, storedHash: string) {
  const [storedAlgorithm, encodedSalt, encodedKey] = storedHash.split("$");

  if (storedAlgorithm !== algorithm || !encodedSalt || !encodedKey || !password) {
    return false;
  }

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedKey = Buffer.from(encodedKey, "base64url");
    const actualKey = (await scryptAsync(password, salt, keyLength)) as Buffer;

    return expectedKey.length === actualKey.length && timingSafeEqual(expectedKey, actualKey);
  } catch {
    return false;
  }
}
