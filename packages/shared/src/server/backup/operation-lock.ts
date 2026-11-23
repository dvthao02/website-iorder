import { mkdir, open } from "node:fs/promises";
import path from "node:path";

type OpenFile = (file: string, flags: string) => Promise<{ close(): Promise<void> }>;

/**
 * Khóa tệp .lock trong thư mục sao lưu, cùng tệp mà scripts/backup.ps1 (lịch tự động 21:00, `pnpm backup:local`)
 * mở độc quyền: trên Windows hai bên không mở chung được, nên CMS không thể phục hồi/sao lưu giữa lúc script
 * đang dump. Trả về hàm nhả khóa, hoặc null nếu đang có lượt khác giữ.
 */
export async function acquireBackupFileLock(backupDir: string, openFile: OpenFile = open): Promise<(() => Promise<void>) | null> {
  await mkdir(backupDir, { recursive: true });
  try {
    const handle = await openFile(path.join(backupDir, ".lock"), "a+");
    return async () => { await handle.close().catch(() => undefined); };
  } catch (error) {
    // EBUSY = vi phạm chia sẻ tệp (script đang giữ). Lỗi khác (quyền, ổ đĩa) phải báo thật, không giả làm "đang bận".
    if ((error as NodeJS.ErrnoException).code === "EBUSY") return null;
    throw error;
  }
}
