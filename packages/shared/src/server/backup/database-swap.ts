// Phục hồi bằng cách dựng bản mới ở database tạm rồi ĐỔI TÊN: database thật chỉ ngừng nhận kết nối trong vài
// lệnh (thay vì suốt thời gian pg_restore), và database cũ vẫn còn nguyên cho tới khi bản mới đã vào vị trí,
// nên lỗi giữa chừng chỉ cần đổi tên lại thay vì nạp lại cả bản dump.

// Tên database đi vào lệnh shell và SQL ở dạng nguyên văn, nên chỉ nhận ký tự an toàn.
const databaseNamePattern = /^[A-Za-z0-9_-]{1,63}$/;

export function assertDatabaseName(name: string): string {
  if (!databaseNamePattern.test(name)) throw new Error(`Tên database "${name}" chỉ được gồm chữ, số, dấu gạch dưới hoặc gạch ngang (tối đa 63 ký tự) để sao lưu/phục hồi một cú bấm.`);
  return name;
}

export class DatabaseSwapError extends Error {
  /** true: database cũ đã về đúng chỗ, dữ liệu như trước khi bấm. false: cần người quản trị kiểm tra (xem message). */
  readonly rolledBack: boolean;
  constructor(message: string, rolledBack: boolean, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatabaseSwapError";
    this.rolledBack = rolledBack;
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function retryAsync<T>(task: () => Promise<T>, attempts: number, delayMs: number, sleep: (ms: number) => Promise<void> = wait): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await sleep(delayMs);
    }
  }
}

export type DatabaseSwap = {
  /** Chạy một câu SQL trên database bảo trì (postgres), không phải database đang đổi. */
  run: (sql: string) => Promise<void>;
  live: string;
  staging: string;
  previous: string;
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** live → previous, staging → live. Lỗi ở bất kỳ bước nào đều cố đưa mọi thứ về như cũ. */
export async function swapDatabases({ run, live, staging, previous, attempts = 5, delayMs = 400, sleep = wait }: DatabaseSwap): Promise<void> {
  for (const name of [live, staging, previous]) assertDatabaseName(name);
  const allowConnections = (value: boolean) => run(`ALTER DATABASE "${live}" WITH ALLOW_CONNECTIONS ${value}`);
  let livePutAside = false;
  try {
    // Chặn kết nối mới rồi ngắt kết nối đang có (kể cả của chính Backend): đổi tên database đòi hỏi không còn phiên nào.
    await allowConnections(false);
    await retryAsync(async () => {
      await run(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $$${live}$$ AND pid <> pg_backend_pid()`);
      await run(`ALTER DATABASE "${live}" RENAME TO "${previous}"`);
    }, attempts, delayMs, sleep);
    livePutAside = true;
    await run(`ALTER DATABASE "${staging}" RENAME TO "${live}"`);
  } catch (error) {
    try {
      if (livePutAside) await retryAsync(() => run(`ALTER DATABASE "${previous}" RENAME TO "${live}"`), attempts, delayMs, sleep);
      await allowConnections(true);
    } catch (rollbackError) {
      throw new DatabaseSwapError(`Đổi database lỗi (${message(error)}) và đưa về như cũ cũng lỗi (${message(rollbackError)}). Dữ liệu cũ nằm ở database "${livePutAside ? previous : live}"; cần người quản trị máy chủ can thiệp.`, false, { cause: error });
    }
    throw new DatabaseSwapError(`Không đổi được sang bản phục hồi: ${message(error)}. Dữ liệu vẫn như trước khi bấm phục hồi.`, true, { cause: error });
  }
}
