import { decryptSecret, encryptSecret, parseMasterKey, SecretsError } from "./secrets.crypto";
import { normalizeSecret, SecretValidationError } from "./secrets.catalog";
import { MasterKeyFileExistsError, type KeyFileStore } from "./secrets.keyfile";
import { secretKeys, secretMetas, type SecretKey, type SecretStatus, type SecretsOverview } from "./secrets.contract";

// Kho khóa API trong CMS. Nguyên tắc:
// - Chỉ ghi, không đọc lại: không có hàm nào trả giá trị rõ ra ngoài tiến trình Backend (getCmsSecret chỉ dành cho dịch vụ nội bộ dùng khóa).
// - Mọi thay đổi (đặt, thay, xóa khóa; tạo khóa chủ) phải nhập lại mật khẩu của chính người đang đăng nhập; sai nhiều lần thì bị chặn tạm.
// - Biến môi trường luôn thắng: nếu đã đặt trên máy chủ thì giá trị ở CMS chưa có hiệu lực (màn hình nói rõ). Khóa chủ cũng vậy:
//   SECRETS_MASTER_KEY thắng tệp khóa chủ.
// - Nhật ký hoạt động chỉ ghi "ai đặt/xóa khóa nào", không bao giờ ghi giá trị.

export class InvalidPasswordError extends Error {
  constructor() {
    super("Mật khẩu không đúng.");
    this.name = "InvalidPasswordError";
  }
}

export class TooManyAttemptsError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Nhập sai mật khẩu quá nhiều lần. Thử lại sau ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} phút.`);
    this.name = "TooManyAttemptsError";
  }
}

export class MasterKeyExistsError extends Error {
  constructor() {
    super("Máy chủ đã có khóa chủ nên không tạo lại. Tạo lại sẽ làm mọi khóa đã lưu ở CMS không đọc được nữa.");
    this.name = "MasterKeyExistsError";
  }
}

export type StoredSecretRow = { key: string; hint: string | null; version: number; updatedAt: Date; updatedByName: string | null };

export type SecretsRepository = {
  list(): Promise<StoredSecretRow[]>;
  /** Bản mã của một khóa (chỉ dùng nội bộ để giải mã). */
  findPayload(key: SecretKey): Promise<string | undefined>;
  /** Ném ContentVersionConflictError nếu expectedVersion không khớp. */
  upsert(input: { key: SecretKey; payload: string; hint: string; userId: string; expectedVersion?: number }): Promise<void>;
  remove(input: { key: SecretKey; userId: string }): Promise<boolean>;
  passwordHash(userId: string): Promise<string | undefined>;
  recordFailedReauth(input: { userId: string; key: SecretKey | "master_key" }): Promise<void>;
  recordMasterKeyCreated(input: { userId: string }): Promise<void>;
};

export type SecretsDependencies = {
  repository: SecretsRepository;
  env: Record<string, string | undefined>;
  now: () => Date;
  verifyPassword: (password: string, hash: string) => Promise<boolean>;
  log: (message: string, context?: Record<string, unknown>) => void;
  /** Tệp khóa chủ trên máy chủ (do CMS tạo hoặc đặt sẵn). Không truyền thì chỉ dùng SECRETS_MASTER_KEY. */
  keyFile?: KeyFileStore;
};

/** PostgreSQL 42P01 (bảng chưa tồn tại: chưa chạy migration 0025). Drizzle bọc lỗi gốc trong `cause`, nên xét cả hai. */
export function isMissingTableError(error: unknown) {
  const direct = (error as { code?: unknown } | null)?.code;
  const wrapped = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  return direct === "42P01" || wrapped === "42P01";
}

const cacheMilliseconds = 30_000;
const maxFailures = 5;
const failureWindowMilliseconds = 15 * 60_000;

type MasterKeyState = { source: "env" | "file" | "none"; state: SecretsOverview["masterKey"]; key?: Buffer; error?: SecretsError };

export function createSecretsService({ repository, env, now, verifyPassword, log, keyFile }: SecretsDependencies) {
  const cache = new Map<SecretKey, { value: string | undefined; at: number }>();
  const failures = new Map<string, number[]>();

  /** Khóa chủ hiện có: SECRETS_MASTER_KEY thắng, rồi đến tệp khóa chủ. Đọc lại mỗi lần (tệp nhỏ) để tạo xong là dùng được ngay, không cần khởi động lại. */
  async function loadMasterKey(): Promise<MasterKeyState> {
    const fromEnv = env.SECRETS_MASTER_KEY?.trim();
    let text = fromEnv;
    let source: MasterKeyState["source"] = fromEnv ? "env" : "none";
    if (!text && keyFile) {
      try { text = await keyFile.read(); } catch { return { source: "file", state: "invalid", error: new SecretsError("MASTER_KEY_INVALID", "Không đọc được tệp khóa chủ trên máy chủ (kiểm tra quyền truy cập tệp).") }; }
      if (text) source = "file";
    }
    if (!text) return { source: "none", state: "missing", error: new SecretsError("MASTER_KEY_MISSING", "Chưa có khóa chủ nên chưa lưu được khóa trong CMS. Bấm “Tạo khóa chủ” hoặc đặt SECRETS_MASTER_KEY ở máy chủ.") };
    try { return { source, state: "ok", key: parseMasterKey(text) }; } catch (error) { return { source, state: "invalid", error: error as SecretsError }; }
  }

  const envOverrides = (key: SecretKey) => secretMetas[key].envNames.some((name) => Boolean(env[name]?.trim()));

  function statusOf(key: SecretKey, row: StoredSecretRow | undefined): SecretStatus {
    const meta = secretMetas[key];
    const overridden = envOverrides(key);
    return {
      key, label: meta.label, description: meta.description, input: meta.input, exposeValue: meta.exposeValue, ...(meta.placeholder ? { placeholder: meta.placeholder } : {}),
      state: overridden ? "env" : row ? "cms" : "none",
      storedInCms: Boolean(row), envOverrides: overridden,
      hint: row?.hint ?? null, version: row?.version ?? 0,
      updatedAt: row ? row.updatedAt.toISOString() : null, updatedByName: row?.updatedByName ?? null,
    };
  }

  /** Trạng thái các khóa cho màn CMS và màn Tình trạng hệ thống. Không có giá trị rõ trong kết quả. */
  async function getOverview(): Promise<SecretsOverview> {
    const [rows, master] = await Promise.all([repository.list(), loadMasterKey()]);
    return {
      masterKey: master.state, masterKeySource: master.source,
      canCreateMasterKey: Boolean(keyFile) && master.state === "missing",
      keyFilePath: keyFile?.path ?? null,
      secrets: secretKeys.map((key) => statusOf(key, rows.find((row) => row.key === key))),
    };
  }

  /**
   * Giá trị khóa đã lưu ở CMS, CHỈ cho dịch vụ nội bộ cần dùng (gọi Google, Umami). Biến môi trường do từng dịch vụ tự xét trước.
   * Chưa có khóa chủ hoặc không giải mã được thì trả undefined (dịch vụ coi như chưa cấu hình) và ghi cảnh báo, không ném lỗi.
   */
  async function getCmsSecret(key: SecretKey): Promise<string | undefined> {
    const cached = cache.get(key);
    if (cached && now().getTime() - cached.at < cacheMilliseconds) return cached.value;
    let value: string | undefined;
    try {
      const payload = await repository.findPayload(key);
      if (payload) {
        const master = await loadMasterKey();
        if (!master.key) throw master.error ?? new SecretsError("MASTER_KEY_MISSING", "Chưa có khóa chủ.");
        value = decryptSecret(payload, key, master.key);
      }
    } catch (error) {
      log("Kho khóa: không đọc được khóa đã lưu ở CMS.", { key, code: error instanceof SecretsError ? error.code : "UNKNOWN" });
      value = undefined;
    }
    cache.set(key, { value, at: now().getTime() });
    return value;
  }

  /** Nhập lại mật khẩu của chính người thao tác. Sai quá nhiều lần thì chặn tạm (theo từng người, trong bộ nhớ của tiến trình Backend). */
  async function assertPassword(userId: string, password: string, subject: SecretKey | "master_key") {
    const at = now().getTime();
    const recent = (failures.get(userId) ?? []).filter((time) => at - time < failureWindowMilliseconds);
    if (recent.length >= maxFailures) throw new TooManyAttemptsError((recent[0] + failureWindowMilliseconds - at) / 1000);
    const hash = await repository.passwordHash(userId);
    const valid = hash ? await verifyPassword(password, hash) : false;
    if (!valid) {
      failures.set(userId, [...recent, at]);
      await repository.recordFailedReauth({ userId, key: subject }).catch(() => undefined);
      throw new InvalidPasswordError();
    }
    failures.delete(userId);
  }

  async function statusFor(key: SecretKey) {
    return (await getOverview()).secrets.find((item) => item.key === key)!;
  }

  /**
   * Đặt hoặc thay nhiều biến cùng lúc (thẻ công cụ có nhiều biến), một lần xác nhận mật khẩu. Kiểm tra định dạng TẤT CẢ trước khi ghi nên một biến sai
   * thì không biến nào được lưu. (Va chạm phiên bản giữa chừng vẫn có thể làm các biến đứng trước đã được lưu: tải lại trang là thấy.)
   */
  async function setSecrets(input: { userId: string; items: Array<{ key: SecretKey; value: string; expectedVersion?: number }>; password: string }) {
    const master = await loadMasterKey();
    if (!master.key) throw master.error ?? new SecretsError("MASTER_KEY_MISSING", "Chưa có khóa chủ.");
    await assertPassword(input.userId, input.password, input.items[0]?.key ?? "master_key");
    const prepared = input.items.map((item) => {
      try { return { ...item, normalized: normalizeSecret(item.key, item.value) }; } catch (error) {
        throw error instanceof SecretValidationError ? new SecretValidationError(error.message, item.key) : error;
      }
    });
    for (const item of prepared) {
      await repository.upsert({ key: item.key, payload: encryptSecret(item.normalized.value, item.key, master.key), hint: item.normalized.hint, userId: input.userId, expectedVersion: item.expectedVersion });
      cache.delete(item.key);
    }
    const overview = await getOverview();
    return input.items.map((item) => overview.secrets.find((secret) => secret.key === item.key)!);
  }

  async function setSecret(input: { userId: string; key: SecretKey; value: string; password: string; expectedVersion?: number }) {
    const [status] = await setSecrets({ userId: input.userId, items: [{ key: input.key, value: input.value, expectedVersion: input.expectedVersion }], password: input.password });
    return status;
  }

  async function clearSecret(input: { userId: string; key: SecretKey; password: string }) {
    await assertPassword(input.userId, input.password, input.key);
    await repository.remove({ key: input.key, userId: input.userId });
    cache.delete(input.key);
    return statusFor(input.key);
  }

  /**
   * Tạo khóa chủ ngẫu nhiên và cất trong tệp riêng trên máy chủ (thay cho việc sửa SECRETS_MASTER_KEY bằng tay). Không bao giờ ghi đè khóa
   * đã có (kể cả tệp sai định dạng: người quản trị phải xử lý tay). Khóa chủ không trả về cho ai; dùng được ngay, không cần khởi động lại.
   */
  async function createMasterKey(input: { userId: string; password: string }) {
    if (!keyFile) throw new SecretsError("KEY_FILE_UNAVAILABLE", "Máy chủ này không cho CMS tạo khóa chủ. Người quản trị đặt SECRETS_MASTER_KEY.");
    if ((await loadMasterKey()).state !== "missing") throw new MasterKeyExistsError();
    await assertPassword(input.userId, input.password, "master_key");
    try {
      await keyFile.create();
    } catch (error) {
      if (error instanceof MasterKeyFileExistsError) throw new MasterKeyExistsError();
      log("Kho khóa: không tạo được tệp khóa chủ.", { code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" });
      throw new SecretsError("KEY_FILE_UNAVAILABLE", "Không tạo được tệp khóa chủ trên máy chủ (thư mục không ghi được). Người quản trị đặt SECRETS_MASTER_KEY hoặc cấp quyền ghi cho thư mục chứa tệp khóa.");
    }
    await repository.recordMasterKeyCreated({ userId: input.userId });
    cache.clear();
    return getOverview();
  }

  return { getOverview, getCmsSecret, setSecret, setSecrets, clearSecret, createMasterKey };
}
