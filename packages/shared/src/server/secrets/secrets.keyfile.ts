import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Tệp khóa chủ (SECRETS_MASTER_KEY dạng tệp) để Super Admin bấm "Tạo khóa chủ" ở CMS thay vì sửa biến môi trường trên máy chủ.
// Tệp nằm NGOÀI database nên bản sao lưu database một mình không giải mã được khóa API. Tạo bằng cờ "wx" (không bao giờ ghi đè khóa đã có:
// ghi đè sẽ làm mọi khóa đã mã hóa không đọc được nữa) và quyền 0600 (chỉ tiến trình Backend đọc được; Windows bỏ qua quyền này).

export class MasterKeyFileExistsError extends Error {
  constructor() {
    super("Đã có khóa chủ nên không tạo lại. Tạo lại sẽ làm mọi khóa đã lưu ở CMS không đọc được nữa.");
    this.name = "MasterKeyFileExistsError";
  }
}

/** SECRETS_KEY_FILE nếu đặt; mặc định .data/secrets-master.key trong thư mục chạy Backend (thư mục .data đã được .gitignore). Production phải trỏ vào một volume bền. */
export function resolveKeyFilePath(env: Record<string, string | undefined>, cwd = process.cwd()) {
  const configured = env.SECRETS_KEY_FILE?.trim();
  return configured ? path.resolve(configured) : path.join(cwd, ".data", "secrets-master.key");
}

export type KeyFileStore = {
  path: string;
  /** Nội dung tệp (đã cắt khoảng trắng); undefined nếu chưa có tệp. Lỗi khác (thiếu quyền đọc…) được ném ra. */
  read(): Promise<string | undefined>;
  /** Tạo tệp với 32 byte ngẫu nhiên (base64). Ném MasterKeyFileExistsError nếu đã có. */
  create(): Promise<void>;
};

export function createKeyFileStore(filePath: string): KeyFileStore {
  return {
    path: filePath,
    async read() {
      try {
        return (await readFile(filePath, "utf8")).trim() || undefined;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    },
    async create() {
      await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
      try {
        await writeFile(filePath, `${randomBytes(32).toString("base64")}\n`, { flag: "wx", mode: 0o600 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new MasterKeyFileExistsError();
        throw error;
      }
    },
  };
}
