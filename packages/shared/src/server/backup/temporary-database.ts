import { randomUUID } from "node:crypto";

/** Chỉ dọn database sau khi chính lượt này đã tạo thành công. */
export async function withTemporaryDatabase<T>(operations: {
  create: (name: string) => Promise<void>;
  use: (name: string) => Promise<T>;
  remove: (name: string) => Promise<void>;
}): Promise<T> {
  const name = `iorder_restore_check_${randomUUID().replaceAll("-", "")}`;
  await operations.create(name);
  try {
    return await operations.use(name);
  } finally {
    await operations.remove(name).catch(() => undefined);
  }
}
